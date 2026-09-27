import { getDb } from '../index';
import type { LocalWatchCycle } from '$lib/types/trackingTypes';
import type { MediaType } from '$lib/db/schema';
import { v4 as uuidv4 } from 'uuid';
import { logActivity } from './activity.service';
import { getMediaById } from './media.service';

interface CycleRow {
	id: string;
	mediaId: string;
	cycleNumber: number;
	startedAt: string | null;
	finishedAt: string | null;
}

function rowToCycle(row: CycleRow): LocalWatchCycle {
	return {
		id: row.id,
		mediaId: row.mediaId,
		cycleNumber: row.cycleNumber,
		startedAt: row.startedAt ?? undefined,
		finishedAt: row.finishedAt ?? undefined,
	};
}

/** Return all cycles for a media item, ordered oldest first. */
export async function getCycles(mediaId: string): Promise<LocalWatchCycle[]> {
	const db = getDb();
	const result = await db.query(
		'SELECT * FROM WatchCycle WHERE mediaId = ? ORDER BY cycleNumber ASC',
		[mediaId],
	);
	if (!result.values) return [];
	return (result.values as CycleRow[]).map(rowToCycle);
}

/** Create a new cycle with the next available cycleNumber. */
export async function createCycle(mediaId: string, startedAt?: string): Promise<LocalWatchCycle> {
	const db = getDb();
	const maxResult = await db.query(
		'SELECT MAX(cycleNumber) AS maxCycle FROM WatchCycle WHERE mediaId = ?',
		[mediaId],
	);
	const prevMax = (maxResult.values?.[0] as { maxCycle: number | null } | undefined)?.maxCycle ?? 0;
	const cycleNumber = prevMax + 1;
	const id = uuidv4();
	const resolvedStart = startedAt ?? new Date().toISOString().slice(0, 10);

	await db.run(
		'INSERT INTO WatchCycle (id, mediaId, cycleNumber, startedAt, finishedAt) VALUES (?, ?, ?, ?, NULL)',
		[id, mediaId, cycleNumber, resolvedStart],
	);
	return { id, mediaId, cycleNumber, startedAt: resolvedStart };
}

/**
 * Close the currently open cycle (finishedAt IS NULL) for a media item. Media that is marked
 * completed without ever being in progress (imports, scoring an untracked title) has no cycle
 * yet — it gets one finished cycle so the timeline and rewatch counts include it.
 */
export async function closeCycle(mediaId: string, finishedAt?: string): Promise<void> {
	const db = getDb();
	const resolved = finishedAt ?? new Date().toISOString().slice(0, 10);
	const result = await db.run(
		'UPDATE WatchCycle SET finishedAt = ? WHERE mediaId = ? AND finishedAt IS NULL',
		[resolved, mediaId],
	);
	if ((result.changes?.changes ?? 0) > 0) return;

	const existing = await db.query('SELECT 1 FROM WatchCycle WHERE mediaId = ? LIMIT 1', [mediaId]);
	if (existing.values?.length) return;
	await db.run(
		'INSERT INTO WatchCycle (id, mediaId, cycleNumber, startedAt, finishedAt) VALUES (?, ?, 1, ?, ?)',
		[uuidv4(), mediaId, resolved, resolved],
	);
}

/** Edit the start/end dates of a specific cycle (for manual backfill). */
export async function updateCycleDates(
	id: string,
	startedAt?: string,
	finishedAt?: string,
): Promise<void> {
	const db = getDb();
	if (startedAt !== undefined) {
		await db.run('UPDATE WatchCycle SET startedAt = ? WHERE id = ?', [startedAt, id]);
	}
	if (finishedAt !== undefined) {
		await db.run('UPDATE WatchCycle SET finishedAt = ? WHERE id = ?', [finishedAt, id]);
	}
}

/**
 * Start a rewatch/reread/replay:
 * 1. Creates a new cycle
 * 2. Resets progress on TrackingStatus
 * 3. Sets status back to in_progress
 * 4. Logs a 'rewatch_started' activity event
 */
export async function startRewatch(
	mediaId: string,
	mediaType: MediaType,
): Promise<LocalWatchCycle> {
	const db = getDb();

	// Create new cycle
	const cycle = await createCycle(mediaId);

	// Reset progress fields and set status = in_progress
	await db.run(
		`UPDATE TrackingStatus SET
			status = 'in_progress',
			currentEpisode = NULL, currentSeason = NULL,
			currentChapter = NULL, currentVolume = NULL,
			currentPage = NULL, currentIssue = NULL,
			hoursPlayed = NULL, completionTier = NULL,
			updatedAt = ?
		 WHERE mediaId = ?`,
		[new Date().toISOString(), mediaId],
	);

	// Log event
	const media = await getMediaById(mediaId);
	await logActivity({
		mediaId,
		mediaTitle: media?.title ?? mediaId,
		mediaPosterUrl: media?.posterUrl,
		mediaType,
		eventType: 'rewatch_started',
		payload: { cycleNumber: cycle.cycleNumber },
	});

	return cycle;
}
