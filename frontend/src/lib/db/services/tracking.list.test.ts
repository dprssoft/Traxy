import { describe, it, expect, vi } from 'vitest';
import type { SQLiteDBConnection } from '@capacitor-community/sqlite';
import { createTestDb } from '../testDb';
import { getTrackedExternalKeys, getTrackingWithMedia, upsertTracking } from './tracking.service';

let db: SQLiteDBConnection;

vi.mock('../index', async (importOriginal) => ({
	...(await importOriginal<typeof import('../index')>()),
	getDb: () => db,
}));

describe('getTrackingWithMedia (real schema)', () => {
	it('returns tracked media joined with every Media column', async () => {
		db = await createTestDb();
		await db.run(
			"INSERT INTO Media (id, source, externalId, type, title) VALUES ('m1', 'manual', 'x', 'game', 'Hades')",
		);
		await upsertTracking({ mediaId: 'm1', status: 'in_progress' });

		const items = await getTrackingWithMedia();
		expect(items).toHaveLength(1);
		expect(items[0].media.title).toBe('Hades');
		expect(items[0].tracking.status).toBe('in_progress');
	});
});

describe('getTrackedExternalKeys (real schema)', () => {
	it('lists only tracked media, keyed by source and external id', async () => {
		db = await createTestDb();
		await db.run(
			"INSERT INTO Media (id, source, externalId, type, title) VALUES ('m1', 'igdb', '42', 'game', 'Hades'), ('m2', 'tmdb', '7', 'film', 'Heat')",
		);
		await upsertTracking({ mediaId: 'm1', status: 'in_progress' });

		expect(await getTrackedExternalKeys()).toEqual(new Set(['igdb:42']));
	});
});
