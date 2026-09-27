import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SQLiteDBConnection } from '@capacitor-community/sqlite';
import { createTestDb } from '../testDb';
import { collectionKey, mediaKey } from './syncLog.service';
import { deleteTracking, upsertTracking } from './tracking.service';
import {
	addToCollection,
	createCollection,
	deleteCollection,
	ensureSystemCollection,
	removeFromCollection,
	updateEntryNote,
} from './collection.service';
import { createCycle, updateCycleDates } from './cycle.service';
import { setAppSetting, setBottomNavIds } from './settings.service';

let db: SQLiteDBConnection;

vi.mock('../index', async (importOriginal) => ({
	...(await importOriginal<typeof import('../index')>()),
	getDb: () => db,
}));

async function tombstones() {
	const res = await db.query('SELECT tableName, rowKey FROM SyncTombstone ORDER BY tableName');
	return res.values as { tableName: string; rowKey: string }[];
}

async function updatedAt(sql: string): Promise<unknown> {
	return ((await db.query(sql)).values?.[0] as { updatedAt?: string } | undefined)?.updatedAt;
}

describe('sync change tracking (real schema)', () => {
	beforeEach(async () => {
		db = await createTestDb();
		await db.run(
			"INSERT INTO Media (id, source, externalId, type, title) VALUES ('m1', 'tmdb', '949', 'film', 'Heat')",
		);
	});

	it('builds device-independent keys', () => {
		expect(mediaKey({ source: 'tmdb', externalId: '949' })).toBe('tmdb:949');
		expect(collectionKey({ id: 'x', systemKey: 'favorites', mediaType: 'film' })).toBe(
			'sys:favorites:film',
		);
		expect(collectionKey({ id: 'abc', systemKey: null })).toBe('abc');
	});

	it('records a tombstone when tracking is removed', async () => {
		await upsertTracking({ mediaId: 'm1', status: 'planned' });
		await deleteTracking('m1');
		expect(await tombstones()).toEqual([{ tableName: 'TrackingStatus', rowKey: 'tmdb:949' }]);
	});

	it('stamps collection items and records their removal', async () => {
		const favorites = await ensureSystemCollection('favorites', 'film');
		await addToCollection(favorites.id, 'm1');
		expect(await updatedAt('SELECT updatedAt FROM CollectionItem')).toBeTruthy();

		await db.run('UPDATE CollectionItem SET updatedAt = NULL');
		await updateEntryNote(favorites.id, 'm1', 'cinema');
		expect(await updatedAt('SELECT updatedAt FROM CollectionItem')).toBeTruthy();

		await removeFromCollection(favorites.id, 'm1');
		expect(await tombstones()).toEqual([
			{ tableName: 'CollectionItem', rowKey: 'sys:favorites:film|tmdb:949' },
		]);
	});

	it('records a tombstone when a collection is deleted', async () => {
		const list = await createCollection({ name: 'Heists', mediaType: null, isRanked: false });
		await deleteCollection(list.id);
		expect(await tombstones()).toEqual([{ tableName: 'Collection', rowKey: list.id }]);
	});

	it('stamps rewatch cycles when created or edited', async () => {
		const cycle = await createCycle('m1');
		expect(await updatedAt('SELECT updatedAt FROM WatchCycle')).toBeTruthy();

		await db.run('UPDATE WatchCycle SET updatedAt = NULL');
		await updateCycleDates(cycle.id, '2026-01-01');
		expect(await updatedAt('SELECT updatedAt FROM WatchCycle')).toBeTruthy();
	});

	it('stamps settings and records a removed setting', async () => {
		await setAppSetting('tracking_view', 'grid');
		expect(await updatedAt('SELECT updatedAt FROM AppSettings')).toBeTruthy();

		await setBottomNavIds(null);
		expect(await tombstones()).toEqual([{ tableName: 'AppSettings', rowKey: 'bottom_nav_items' }]);
	});
});
