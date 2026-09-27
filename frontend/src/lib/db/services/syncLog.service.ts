/**
 * Change tracking for sync. Rows are matched across devices by a stable key rather than their
 * local id (each device gives the same title its own UUID), and deletions leave a tombstone so
 * another device's copy doesn't bring the row back.
 */
import { getDb } from '../index';

export type SyncTable =
	| 'TrackingStatus'
	| 'WatchCycle'
	| 'Collection'
	| 'CollectionItem'
	| 'ActivityLog'
	| 'AppSettings';

/** Media is matched by provider link; manual titles by their own external id. */
export const mediaKey = (m: { source: string; externalId: string }) =>
	`${m.source}:${m.externalId}`;

/** System collections (favorites/wishlist per type) exist on every device under different ids. */
export const collectionKey = (c: {
	id: string;
	systemKey?: string | null;
	mediaType?: string | null;
}) => (c.systemKey ? `sys:${c.systemKey}:${c.mediaType}` : c.id);

export const collectionItemKey = (collection: string, media: string) => `${collection}|${media}`;

/** The sync key of a local media row, or null if it's gone. */
export async function mediaKeyById(mediaId: string): Promise<string | null> {
	const res = await getDb().query('SELECT source, externalId FROM Media WHERE id = ?', [mediaId]);
	const row = res.values?.[0] as { source: string; externalId: string } | undefined;
	return row ? mediaKey(row) : null;
}

/** Remember that a row was deleted, so the next sync removes it on other devices too. */
export async function recordDeletion(table: SyncTable, rowKey: string | null): Promise<void> {
	if (!rowKey) return;
	await getDb().run(
		'INSERT OR REPLACE INTO SyncTombstone (tableName, rowKey, deletedAt) VALUES (?, ?, ?)',
		[table, rowKey, new Date().toISOString()],
	);
}
