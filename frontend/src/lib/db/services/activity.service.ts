import { getDb } from '../index';
import type { ActivityLog } from '$lib/db/schema';
import type { ActivityItem, ActivityPayload } from '$lib/types/activityTypes';
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

// ActivityLog columns plus the linked media's adult flag, so feed posters can be blurred.
const ACTIVITY_SELECT =
	'SELECT a.*, m.isAdult AS mediaIsAdult FROM ActivityLog a LEFT JOIN Media m ON m.id = a.mediaId';

// One row of ACTIVITY_SELECT. `payload` is JSON text as stored.
interface ActivityRow {
	id: string;
	mediaId: string | null;
	mediaTitle: string | null;
	mediaPosterUrl: string | null;
	mediaType: string | null;
	eventType: string;
	payload: string | ActivityPayload | null;
	occurredAt: string;
	mediaIsAdult: number | null;
}

function rowToItem(row: ActivityRow): ActivityItem {
	const {
		id,
		mediaId,
		mediaTitle,
		mediaPosterUrl,
		mediaType,
		eventType,
		payload,
		occurredAt,
		mediaIsAdult,
	} = row;
	const parsedPayload = payload
		? ((typeof payload === 'string' ? JSON.parse(payload) : payload) as ActivityPayload)
		: ({} as ActivityPayload);

	const evt = eventType as ActivityItem['eventType'];
	const category = getCategoryForEventType(evt);

	return {
		id,
		mediaId: mediaId ?? undefined,
		mediaTitle: mediaTitle ?? undefined,
		mediaPosterUrl: mediaPosterUrl ?? undefined,
		mediaIsAdult: mediaIsAdult == null ? undefined : Boolean(mediaIsAdult),
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
	newValue: number,
): Promise<{ highestRemaining: number; highestRemainingOccurredAt: string | null }> {
	const db = getDb();
	const logs = await getActivityForMedia(mediaId);
	const targetLogs = logs.filter((l) => l.eventType === eventType);

	let highestRemaining = 0;
	let highestRemainingOccurredAt: string | null = null;
	const toDelete: string[] = [];

	for (const log of targetLogs) {
		const val = log.payload?.[payloadKey] as number | undefined;
		if (typeof val === 'number') {
			if (val > newValue) {
				toDelete.push(log.id);
			} else if (val > highestRemaining) {
				highestRemaining = val;
				highestRemainingOccurredAt = log.occurredAt;
			}
		}
	}

	if (toDelete.length > 0) {
		const placeholders = toDelete.map(() => '?').join(',');
		await db.run(`DELETE FROM ActivityLog WHERE id IN (${placeholders})`, toDelete);
	}

	return { highestRemaining, highestRemainingOccurredAt };
}

/**
 * Write a new event to the ActivityLog.
 * Called by tracking.service, cycle.service, and system events after every meaningful change.
 * Pass `occurredAt` to backdate the log (e.g. when continuing a session after a correction).
 */
export async function logActivity(
	entry: Omit<ActivityLog, 'id' | 'occurredAt' | 'payload'> & {
		payload: ActivityPayload;
		occurredAt?: string;
	},
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
			entry.occurredAt ?? new Date().toISOString(),
		],
	);
}

/** Return a paginated, newest-first list of activity items. */
export async function getActivityFeed(limit = 20, offset = 0): Promise<ActivityItem[]> {
	const db = getDb();
	const result = await db.query(
		`${ACTIVITY_SELECT} ORDER BY a.occurredAt DESC, a.rowid DESC LIMIT ? OFFSET ?`,
		[limit, offset],
	);
	if (!result.values) return [];
	return (result.values as ActivityRow[]).map(rowToItem);
}

/** Return all activity events for a specific media item, newest first. */
export async function getActivityForMedia(mediaId: string): Promise<ActivityItem[]> {
	const db = getDb();
	const result = await db.query(
		`${ACTIVITY_SELECT} WHERE a.mediaId = ? ORDER BY a.occurredAt DESC, a.rowid DESC`,
		[mediaId],
	);
	if (!result.values) return [];
	return (result.values as ActivityRow[]).map(rowToItem);
}
