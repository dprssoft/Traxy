import { getDb } from '../index';
import type { ActivityLog } from '$lib/db/schema';
import type { ActivityItem, ActivityPayload } from '$lib/types/activityTypes';
import type { HeatmapDay } from '$lib/types/statsTypes';
import { v4 as uuidv4 } from 'uuid';

function getCategoryForEventType(eventType: ActivityItem['eventType']): ActivityItem['category'] {
	if (
		eventType === 'backup_created' ||
		eventType === 'backup_failed' ||
		eventType === 'import_completed' ||
		eventType === 'import_failed' ||
		eventType === 'app_error' ||
		eventType === 'app_warning' ||
		eventType === 'mal_import' ||
		eventType === 'anilist_import' ||
		eventType === 'tmdb_import'
	) {
		return 'system';
	}
	if (
		eventType === 'media_new_episode' ||
		eventType === 'media_new_season' ||
		eventType === 'media_new_chapter' ||
		eventType === 'media_new_volume' ||
		eventType === 'media_dropped' ||
		eventType === 'media_hiatus'
	) {
		return 'media_update';
	}
	return 'user_action';
}

function rowToItem(row: any): ActivityItem {
	let id, mediaId, mediaTitle, mediaPosterUrl, mediaType, eventType, payload, occurredAt;
	if (Array.isArray(row)) {
		[id, mediaId, mediaTitle, mediaPosterUrl, mediaType, eventType, payload, occurredAt] = row;
	} else {
		({ id, mediaId, mediaTitle, mediaPosterUrl, mediaType, eventType, payload, occurredAt } = row);
	}
	const parsedPayload = payload
		? (typeof payload === 'string' ? JSON.parse(payload) : payload) as ActivityPayload
		: {} as ActivityPayload;

	const evt = eventType as ActivityItem['eventType'];
	const category = getCategoryForEventType(evt);

	return {
		id,
		mediaId: mediaId ?? undefined,
		mediaTitle: mediaTitle ?? undefined,
		mediaPosterUrl: mediaPosterUrl ?? undefined,
		mediaType: mediaType ? (mediaType as ActivityItem['mediaType']) : undefined,
		eventType: evt,
		category,
		body: parsedPayload.note || parsedPayload.message || undefined,
		details: parsedPayload.details || undefined,
		payload: parsedPayload,
		occurredAt,
	};
}

/**
 * Handle a decrement in progress by removing logs above the new value,
 * and ensuring there is a log for the new value if needed.
 */
export async function handleProgressDecrement(
	mediaId: string,
	eventType: ActivityItem['eventType'],
	payloadKey: keyof ActivityPayload,
	newValue: number
): Promise<{ highestRemaining: number }> {
	const db = getDb();
	const logs = await getActivityForMedia(mediaId);
	const targetLogs = logs.filter(l => l.eventType === eventType);

	let highestRemaining = 0;
	const toDelete: string[] = [];

	for (const log of targetLogs) {
		const val = log.payload?.[payloadKey] as number | undefined;
		if (typeof val === 'number') {
			if (val > newValue) {
				toDelete.push(log.id);
			} else if (val > highestRemaining) {
				highestRemaining = val;
			}
		}
	}

	if (toDelete.length > 0) {
		for (const id of toDelete) {
			await db.run('DELETE FROM ActivityLog WHERE id = ?', [id]);
		}
	}

	return { highestRemaining };
}

/**
 * Write a new event to the ActivityLog.
 * Called by tracking.service, cycle.service, and system events after every meaningful change.
 */
export async function logActivity(
	entry: Omit<ActivityLog, 'id' | 'occurredAt' | 'payload'> & { payload: ActivityPayload },
): Promise<void> {
	const db = getDb();
	await db.run(
		`INSERT INTO ActivityLog (id, mediaId, mediaTitle, mediaPosterUrl, mediaType, eventType, payload, occurredAt)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			uuidv4(),
			entry.mediaId ?? null,
			entry.mediaTitle ?? null,
			entry.mediaPosterUrl ?? null,
			entry.mediaType ?? null,
			entry.eventType,
			JSON.stringify(entry.payload),
			new Date().toISOString(),
		],
	);
}

/** Return a paginated, newest-first list of activity items. */
export async function getActivityFeed(limit = 20, offset = 0): Promise<ActivityItem[]> {
	const db = getDb();
	const result = await db.query(
		'SELECT * FROM ActivityLog ORDER BY occurredAt DESC LIMIT ? OFFSET ?',
		[limit, offset],
	);
	if (!result.values) return [];
	return result.values.map(rowToItem);
}

/** Return all activity events for a specific media item, newest first. */
export async function getActivityForMedia(mediaId: string): Promise<ActivityItem[]> {
	const db = getDb();
	const result = await db.query(
		'SELECT * FROM ActivityLog WHERE mediaId = ? ORDER BY occurredAt DESC',
		[mediaId],
	);
	if (!result.values) return [];
	return result.values.map(rowToItem);
}

/**
 * Aggregate activity events by calendar day for the given year.
 * Returns one entry per day that has at least one event.
 */
export async function getActivityHeatmap(year: number): Promise<HeatmapDay[]> {
	const db = getDb();
	const result = await db.query(
		`SELECT date(occurredAt) as date, COUNT(*) as count
		 FROM ActivityLog
		 WHERE occurredAt >= ? AND occurredAt < ?
		 GROUP BY date(occurredAt)
		 ORDER BY date ASC`,
		[`${year}-01-01`, `${year + 1}-01-01`],
	);
	if (!result.values) return [];
	return result.values.map((row: any) => {
		if (Array.isArray(row)) {
			return {
				date: row[0] as string,
				count: row[1] as number,
			};
		} else {
			return {
				date: row.date as string,
				count: row.count as number,
			};
		}
	});
}