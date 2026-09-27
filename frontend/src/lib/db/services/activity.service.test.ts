import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SQLiteDBConnection } from '@capacitor-community/sqlite';
import { createTestDb } from '../testDb';
import {
	ACTIVITY_LOG_LIMIT,
	getActivityFeed,
	logActivity,
	pruneActivityLog,
} from './activity.service';

let db: SQLiteDBConnection;

vi.mock('../index', async (importOriginal) => ({
	...(await importOriginal<typeof import('../index')>()),
	getDb: () => db,
}));

async function count(): Promise<number> {
	const result = await db.query('SELECT COUNT(*) AS n FROM ActivityLog');
	return (result.values?.[0] as { n: number }).n;
}

async function insertEvents(n: number) {
	for (let i = 0; i < n; i++) {
		const day = String(1 + (i % 28)).padStart(2, '0');
		const month = String(1 + Math.floor(i / 28)).padStart(2, '0');
		await db.run(
			"INSERT INTO ActivityLog (id, eventType, payload, occurredAt) VALUES (?, 'status_changed', '{}', ?)",
			[`e${i}`, `2026-${month}-${day}T00:00:00.000Z`],
		);
	}
}

describe('activity log cap (real schema)', () => {
	beforeEach(async () => {
		db = await createTestDb();
	});

	it('trims to the newest events', async () => {
		await insertEvents(ACTIVITY_LOG_LIMIT + 30);

		await pruneActivityLog();

		expect(await count()).toBe(ACTIVITY_LOG_LIMIT);
		const oldest = await db.query('SELECT MIN(occurredAt) AS t FROM ActivityLog');
		const kept = await db.query(
			'SELECT occurredAt AS t FROM ActivityLog ORDER BY occurredAt DESC LIMIT 1 OFFSET ?',
			[ACTIVITY_LOG_LIMIT - 1],
		);
		expect((oldest.values?.[0] as { t: string }).t).toBe((kept.values?.[0] as { t: string }).t);
	});

	it('keeps the log capped as new events are written', async () => {
		await insertEvents(ACTIVITY_LOG_LIMIT);

		await logActivity({ eventType: 'status_changed', payload: {}, mediaTitle: 'Newest' });

		expect(await count()).toBe(ACTIVITY_LOG_LIMIT);
		const [latest] = await getActivityFeed(1);
		expect(latest.mediaTitle).toBe('Newest');
	});

	it('leaves a short log alone', async () => {
		await insertEvents(5);
		await pruneActivityLog();
		expect(await count()).toBe(5);
	});
});
