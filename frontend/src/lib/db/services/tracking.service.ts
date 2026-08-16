import { getDb } from '../index';
import type { LocalTrackingStatus, LocalWatchCycle, TrackingListItem } from '$lib/types/trackingTypes';
import type { TrackingStatusType } from '$lib/db/schema';
import { v4 as uuidv4 } from 'uuid';
import { logActivity } from './activity.service';
import { getMediaById } from './media.service';
import { createCycle, closeCycle } from './cycle.service';

// Progress field → ActivityLog event type mapping
const PROGRESS_EVENT_MAP: Partial<Record<keyof LocalTrackingStatus, string>> = {
	currentEpisode: 'episode_watched',
	currentSeason:  'episode_watched',
	currentChapter: 'chapter_read',
	currentVolume:  'chapter_read',
	currentPage:    'pages_updated',
	currentIssue:   'issue_read',
	hoursPlayed:    'hours_updated',
};

function rowToTracking(row: any): LocalTrackingStatus {
	let id, mediaId, status, score, note, currentEpisode, currentSeason,
		currentChapter, currentVolume, currentPage, currentIssue,
		hoursPlayed, completionTier, createdAt, updatedAt;
	if (Array.isArray(row)) {
		[id, mediaId, status, score, note, currentEpisode, currentSeason,
			currentChapter, currentVolume, currentPage, currentIssue,
			hoursPlayed, completionTier, createdAt, updatedAt] = row;
	} else {
		({ id, mediaId, status, score, note, currentEpisode, currentSeason,
			currentChapter, currentVolume, currentPage, currentIssue,
			hoursPlayed, completionTier, createdAt, updatedAt } = row);
	}
	return {
		id, mediaId,
		status: status as TrackingStatusType,
		score: score ?? undefined,
		note: note ?? undefined,
		currentEpisode: currentEpisode ?? undefined,
		currentSeason:  currentSeason  ?? undefined,
		currentChapter: currentChapter ?? undefined,
		currentVolume:  currentVolume  ?? undefined,
		currentPage:    currentPage    ?? undefined,
		currentIssue:   currentIssue   ?? undefined,
		hoursPlayed:    hoursPlayed    ?? undefined,
		completionTier: completionTier ? (completionTier as LocalTrackingStatus['completionTier']) : undefined,
		createdAt, updatedAt,
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

/** Fetch tracking records joined with their media, for the My List page. */
export async function getTrackingWithMedia(): Promise<TrackingListItem[]> {
	const tracking = await getAllTracking();
	const items: TrackingListItem[] = [];
	for (const t of tracking) {
		const media = await getMediaById(t.mediaId);
		if (!media) continue;
		items.push({ media, tracking: t });
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
				updated.score ?? null, updated.note ?? null,
				updated.currentEpisode ?? null, updated.currentSeason ?? null,
				updated.currentChapter ?? null, updated.currentVolume ?? null,
				updated.currentPage ?? null, updated.currentIssue ?? null,
				updated.hoursPlayed ?? null, updated.completionTier ?? null,
				now, data.mediaId,
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
				id, data.mediaId, newStatus,
				data.score ?? null, data.note ?? null,
				data.currentEpisode ?? null, data.currentSeason ?? null,
				data.currentChapter ?? null, data.currentVolume ?? null,
				data.currentPage ?? null, data.currentIssue ?? null,
				data.hoursPlayed ?? null, data.completionTier ?? null,
				now, now,
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
 */
export async function updateProgress(
	mediaId: string,
	field: keyof LocalTrackingStatus,
	value: number | string,
): Promise<void> {
	const db = getDb();
	const media = await getMediaById(mediaId);
	const now = new Date().toISOString();

	await db.run(
		`UPDATE TrackingStatus SET ${field} = ?, updatedAt = ? WHERE mediaId = ?`,
		[value, now, mediaId],
	);

	const eventType = (PROGRESS_EVENT_MAP[field] ?? 'status_changed') as import('$lib/db/schema').ActivityEventType;
	const payload: Record<string, unknown> = {};
	if (field === 'currentEpisode') payload.episode = value;
	else if (field === 'currentSeason') payload.season = value;
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
export async function updateScore(mediaId: string, score: number | null): Promise<LocalTrackingStatus> {
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
		await db.run('UPDATE TrackingStatus SET note = ?, updatedAt = ? WHERE mediaId = ?', [note || null, now, mediaId]);

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
