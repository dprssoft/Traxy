import { getDb } from '../index';
import type {
	LocalTrackingStatus,
	LocalWatchCycle,
	TrackingListItem,
} from '$lib/types/trackingTypes';
import type { TrackingStatusType } from '$lib/db/schema';
import { v4 as uuidv4 } from 'uuid';
import { logActivity } from './activity.service';
import { getMediaById, rowToMedia, MEDIA_COLUMNS } from './media.service';
import { createCycle, closeCycle } from './cycle.service';
import { handleProgressDecrement } from './activity.service';
import type { ActivityPayload } from '$lib/types/activityTypes';

// Progress field → ActivityLog event type mapping
const PROGRESS_EVENT_MAP: Partial<Record<keyof LocalTrackingStatus, string>> = {
	currentEpisode: 'episode_watched',
	currentSeason: 'episode_watched',
	currentChapter: 'chapter_read',
	currentVolume: 'chapter_read',
	currentPage: 'pages_updated',
	currentIssue: 'issue_read',
	hoursPlayed: 'hours_updated',
};

function rowToTracking(row: any): LocalTrackingStatus {
	let id,
		mediaId,
		status,
		score,
		note,
		currentEpisode,
		currentSeason,
		currentChapter,
		currentVolume,
		currentPage,
		currentIssue,
		hoursPlayed,
		completionTier,
		createdAt,
		updatedAt;
	if (Array.isArray(row)) {
		[
			id,
			mediaId,
			status,
			score,
			note,
			currentEpisode,
			currentSeason,
			currentChapter,
			currentVolume,
			currentPage,
			currentIssue,
			hoursPlayed,
			completionTier,
			createdAt,
			updatedAt,
		] = row;
	} else {
		({
			id,
			mediaId,
			status,
			score,
			note,
			currentEpisode,
			currentSeason,
			currentChapter,
			currentVolume,
			currentPage,
			currentIssue,
			hoursPlayed,
			completionTier,
			createdAt,
			updatedAt,
		} = row);
	}
	return {
		id,
		mediaId,
		status: status as TrackingStatusType,
		score: score ?? undefined,
		note: note ?? undefined,
		currentEpisode: currentEpisode ?? undefined,
		currentSeason: currentSeason ?? undefined,
		currentChapter: currentChapter ?? undefined,
		currentVolume: currentVolume ?? undefined,
		currentPage: currentPage ?? undefined,
		currentIssue: currentIssue ?? undefined,
		hoursPlayed: hoursPlayed ?? undefined,
		completionTier: completionTier
			? (completionTier as LocalTrackingStatus['completionTier'])
			: undefined,
		createdAt,
		updatedAt,
	};
}

/** Fetch the tracking record for a media item, or null if not tracked. */
export async function getTracking(mediaId: string): Promise<LocalTrackingStatus | null> {
	const db = getDb();
	const result = await db.query('SELECT * FROM TrackingStatus WHERE mediaId = ?', [mediaId]);
	if (!result.values || result.values.length === 0) return null;
	return rowToTracking(result.values[0]);
}

/** Fetch every tracking record. */
export async function getAllTracking(): Promise<LocalTrackingStatus[]> {
	const db = getDb();
	const result = await db.query('SELECT * FROM TrackingStatus ORDER BY updatedAt DESC');
	if (!result.values) return [];
	return result.values.map(rowToTracking);
}

// Column names in the order the JOIN below selects them — used to split each joined row
// back into its TrackingStatus and Media halves. `t.id` is aliased to avoid colliding with
// `m.id` (the only column name shared by both tables) when the driver returns named rows.
const TRACKING_COLUMNS = [
	'id', 'mediaId', 'status', 'score', 'note',
	'currentEpisode', 'currentSeason', 'currentChapter', 'currentVolume',
	'currentPage', 'currentIssue', 'hoursPlayed', 'completionTier',
	'createdAt', 'updatedAt',
];

/**
 * Fetch tracking records joined with their media, for the My List page.
 * A single SQL JOIN, rather than one getMediaById() call per tracking row, to avoid an
 * N+1 query pattern. Rows whose mediaId has no matching Media record (a data-integrity
 * problem, not an expected case) are skipped with a warning instead of silently dropped.
 */
export async function getTrackingWithMedia(): Promise<TrackingListItem[]> {
	const db = getDb();
	const result = await db.query(
		`SELECT
			t.id as trackingId, t.mediaId, t.status, t.score, t.note,
			t.currentEpisode, t.currentSeason, t.currentChapter, t.currentVolume,
			t.currentPage, t.currentIssue, t.hoursPlayed, t.completionTier,
			t.createdAt, t.updatedAt,
			m.id, m.source, m.externalId, m.type, m.title, m.year, m.posterUrl,
			m.description, m.originalTitle, m.serializationYears, m.author, m.country,
			m.genres, m.releaseStatus, m.totalEpisodes, m.totalSeasons,
			m.totalVolumes, m.totalChapters, m.platforms, m.totalPages, m.seasonData,
			m.timeToBeat, m.runtimeMinutes
		FROM TrackingStatus t
		JOIN Media m ON t.mediaId = m.id
		ORDER BY t.updatedAt DESC`,
	);
	if (!result.values) return [];

	const items: TrackingListItem[] = [];
	for (const row of result.values) {
		const values = Array.isArray(row) ? row : Object.values(row as Record<string, unknown>);
		if (values.length !== TRACKING_COLUMNS.length + MEDIA_COLUMNS.length) {
			console.error('getTrackingWithMedia: unexpected joined row shape', row);
			continue;
		}
		const tracking = rowToTracking(values.slice(0, TRACKING_COLUMNS.length));
		const media = rowToMedia(values.slice(TRACKING_COLUMNS.length));
		items.push({ media, tracking });
	}
	return items;
}

/**
 * Create or update a tracking record.
 * Handles all WatchCycle lifecycle transitions and ActivityLog writes.
 */
export async function upsertTracking(
	data: Partial<LocalTrackingStatus> & { mediaId: string },
): Promise<LocalTrackingStatus> {
	const db = getDb();
	const prev = await getTracking(data.mediaId);
	const now = new Date().toISOString();
	const media = await getMediaById(data.mediaId);

	if (prev) {
		// Update existing record
		const updated: LocalTrackingStatus = {
			...prev,
			...data,
			updatedAt: now,
		};

		await db.run(
			`UPDATE TrackingStatus SET
				status = ?, score = ?, note = ?,
				currentEpisode = ?, currentSeason = ?, currentChapter = ?,
				currentVolume = ?, currentPage = ?, currentIssue = ?,
				hoursPlayed = ?, completionTier = ?, updatedAt = ?
			WHERE mediaId = ?`,
			[
				updated.status,
				updated.score ?? null,
				updated.note ?? null,
				updated.currentEpisode ?? null,
				updated.currentSeason ?? null,
				updated.currentChapter ?? null,
				updated.currentVolume ?? null,
				updated.currentPage ?? null,
				updated.currentIssue ?? null,
				updated.hoursPlayed ?? null,
				updated.completionTier ?? null,
				now,
				data.mediaId,
			],
		);

		// Status transition side-effects
		if (data.status && data.status !== prev.status) {
			if (data.status === 'in_progress' && prev.status !== 'in_progress') {
				await createCycle(data.mediaId);
			}
			if (data.status === 'completed' && prev.status !== 'completed') {
				await closeCycle(data.mediaId);
			}
			await logActivity({
				mediaId: data.mediaId,
				mediaTitle: media?.title ?? data.mediaId,
				mediaPosterUrl: media?.posterUrl,
				mediaType: media?.type ?? 'film',
				eventType: 'status_changed',
				payload: { from: prev.status, to: data.status },
			});
		}

		return updated;
	} else {
		// Insert new record
		const id = uuidv4();
		const newStatus = data.status ?? 'planned';
		const record: LocalTrackingStatus = {
			id,
			mediaId: data.mediaId,
			status: newStatus,
			score: data.score,
			note: data.note,
			createdAt: now,
			updatedAt: now,
		};

		await db.run(
			`INSERT INTO TrackingStatus
				(id, mediaId, status, score, note,
				 currentEpisode, currentSeason, currentChapter, currentVolume,
				 currentPage, currentIssue, hoursPlayed, completionTier,
				 createdAt, updatedAt)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				id,
				data.mediaId,
				newStatus,
				data.score ?? null,
				data.note ?? null,
				data.currentEpisode ?? null,
				data.currentSeason ?? null,
				data.currentChapter ?? null,
				data.currentVolume ?? null,
				data.currentPage ?? null,
				data.currentIssue ?? null,
				data.hoursPlayed ?? null,
				data.completionTier ?? null,
				now,
				now,
			],
		);

		if (newStatus === 'in_progress') {
			await createCycle(data.mediaId);
		}

		await logActivity({
			mediaId: data.mediaId,
			mediaTitle: media?.title ?? data.mediaId,
			mediaPosterUrl: media?.posterUrl,
			mediaType: media?.type ?? 'film',
			eventType: 'status_changed',
			payload: { from: undefined, to: newStatus },
		});

		return record;
	}
}

/**
 * Update a single progress field (episode, chapter, page, etc.) and write the
 * corresponding ActivityLog event.
 *
 * Rules:
 * - currentSeason changes never emit their own event (they accompany an episode update).
 * - Progress-type events (episode/chapter/page) are only logged when the value is > 0
 *   AND greater than the previous stored value (forward progress only — no decrements).
 */
export async function updateProgress(
	mediaId: string,
	field: keyof LocalTrackingStatus,
	value: number | string,
): Promise<void> {
	// `field` is interpolated directly into the SQL below, so it must be restricted to the
	// known progress columns — never widened to arbitrary LocalTrackingStatus keys (e.g. 'id').
	if (!(field in PROGRESS_EVENT_MAP)) {
		throw new Error(`updateProgress: unsupported field "${String(field)}"`);
	}

	const db = getDb();
	const prev = await getTracking(mediaId);
	const media = await getMediaById(mediaId);
	const now = new Date().toISOString();

	await db.run(`UPDATE TrackingStatus SET ${field} = ?, updatedAt = ? WHERE mediaId = ?`, [
		value,
		now,
		mediaId,
	]);

	// Season changes are side-effects of episode changes — never log separately.
	if (field === 'currentSeason') return;

	const numValue = typeof value === 'number' ? value : parseFloat(value as string);
	const prevNumValue = prev ? ((prev[field] as number | undefined) ?? 0) : 0;

	// Only log for numeric progress events when the value is >= 0 and represents forward progress.
	const isProgressField = field in PROGRESS_EVENT_MAP;
	if (isProgressField) {
		if (isNaN(numValue) || numValue < 0) return;

		const payloadKey =
			field === 'currentEpisode'
				? 'episode'
				: field === 'currentChapter'
					? 'chapter'
					: field === 'currentVolume'
						? 'volume'
						: field === 'currentPage'
							? 'page'
							: field === 'currentIssue'
								? 'issue'
								: field === 'hoursPlayed'
									? 'hours'
									: null;

		if (numValue <= prevNumValue) {
			// Decrement: delete higher logs so feed reflects correct state
			if (payloadKey) {
				const evtType = (PROGRESS_EVENT_MAP[field] ??
					'status_changed') as import('$lib/db/schema').ActivityEventType;
				await handleProgressDecrement(
					mediaId,
					evtType,
					payloadKey as keyof ActivityPayload,
					numValue,
				);
			}
			return;
		}
	}

	const eventType = (PROGRESS_EVENT_MAP[field] ??
		'status_changed') as import('$lib/db/schema').ActivityEventType;
	const payload: Record<string, unknown> = {};
	if (field === 'currentEpisode') payload.episode = value;
	else if (field === 'currentChapter') payload.chapter = value;
	else if (field === 'currentVolume') payload.volume = value;
	else if (field === 'currentPage') payload.page = value;
	else if (field === 'currentIssue') payload.issue = value;
	else if (field === 'hoursPlayed') payload.hours = value;

	await logActivity({
		mediaId,
		mediaTitle: media?.title ?? mediaId,
		mediaPosterUrl: media?.posterUrl,
		mediaType: media?.type ?? 'film',
		eventType,
		payload,
	});
}

/** Update the user's score for a media item. */
export async function updateScore(
	mediaId: string,
	score: number | null,
): Promise<LocalTrackingStatus> {
	const db = getDb();
	const prev = await getTracking(mediaId);
	const media = await getMediaById(mediaId);
	const now = new Date().toISOString();

	if (prev) {
		await db.run('UPDATE TrackingStatus SET score = ?, updatedAt = ? WHERE mediaId = ?', [
			score ?? null,
			now,
			mediaId,
		]);

		await logActivity({
			mediaId,
			mediaTitle: media?.title ?? mediaId,
			mediaPosterUrl: media?.posterUrl,
			mediaType: media?.type ?? 'film',
			eventType: prev.score != null ? 'score_changed' : 'score_set',
			payload: { from: prev.score?.toString(), score: score ?? undefined },
		});

		return {
			...prev,
			score: score ?? undefined,
			updatedAt: now,
		};
	} else {
		return upsertTracking({
			mediaId,
			score: score ?? undefined,
			status: 'completed',
		});
	}
}

/** Update the user's personal note for a media item. */
export async function updateNote(mediaId: string, note: string): Promise<LocalTrackingStatus> {
	const db = getDb();
	const prev = await getTracking(mediaId);
	const media = await getMediaById(mediaId);
	const now = new Date().toISOString();

	if (prev) {
		await db.run('UPDATE TrackingStatus SET note = ?, updatedAt = ? WHERE mediaId = ?', [
			note || null,
			now,
			mediaId,
		]);

		await logActivity({
			mediaId,
			mediaTitle: media?.title ?? mediaId,
			mediaPosterUrl: media?.posterUrl,
			mediaType: media?.type ?? 'film',
			eventType: 'note_updated',
			payload: {},
		});

		return {
			...prev,
			note: note || undefined,
			updatedAt: now,
		};
	} else {
		return upsertTracking({
			mediaId,
			note: note || undefined,
			status: 'planned',
		});
	}
}

/** Remove all tracking data (status, progress) for a media item. Does not delete cycles. */
export async function deleteTracking(mediaId: string): Promise<void> {
	const db = getDb();
	await db.run('DELETE FROM TrackingStatus WHERE mediaId = ?', [mediaId]);
}
