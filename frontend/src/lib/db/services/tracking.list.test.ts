import { describe, it, expect, vi } from 'vitest';
import type { SQLiteDBConnection } from '@capacitor-community/sqlite';
import { createTestDb } from '../testDb';
import { getTrackingWithMedia, upsertTracking } from './tracking.service';

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
