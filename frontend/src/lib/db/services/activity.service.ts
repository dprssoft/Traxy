import { getDb } from '../index';
import type { ActivityLog } from '$lib/db/schema';
import type { ActivityItem, ActivityPayload } from '$lib/types/activityTypes';
import type { HeatmapDay } from '$lib/types/statsTypes';
import { v4 as uuidv4 } from 'uuid';

function rowToItem(row: any): ActivityItem {
	let id, mediaId, mediaTitle, mediaPosterUrl, mediaType, eventType, payload, occurredAt;
	if (Array.isArray(row)) {
		[id, mediaId, mediaTitle, mediaPosterUrl, mediaType, eventType, payload, occurredAt] = row;
	} else {
		({ id, mediaId, mediaTitle, mediaPosterUrl, mediaType, eventType, payload, occurredAt } = row);
	}
	return {
		id,
		mediaId,
		mediaTitle,
		mediaPosterUrl: mediaPosterUrl ?? undefined,
		mediaType: mediaType as ActivityItem['mediaType'],
		eventType: eventType as ActivityItem['eventType'],
		payload: payload ? (typeof payload === 'string' ? JSON.parse(payload) : payload) as ActivityPayload : {} as ActivityPayload,
		occurredAt,
	};
}

/**
 * Write a new event to the ActivityLog.
 * Called by tracking.service and cycle.service after every meaningful change.
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
			entry.mediaId,
			entry.mediaTitle,
			entry.mediaPosterUrl ?? null,
			entry.mediaType,
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