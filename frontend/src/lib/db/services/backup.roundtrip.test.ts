import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SQLiteDBConnection } from '@capacitor-community/sqlite';
import { createTestDb } from '../testDb';
import { exportDatabaseJson, importDatabaseJson } from './backup.service';

let db: SQLiteDBConnection;

vi.mock('../index', async (importOriginal) => ({
	...(await importOriginal<typeof import('../index')>()),
	getDb: () => db,
}));

async function titles(): Promise<string[]> {
	const result = await db.query('SELECT title FROM Media ORDER BY title');
	return (result.values as { title: string }[]).map((r) => r.title);
}

async function activityCount(): Promise<number> {
	const result = await db.query('SELECT COUNT(*) AS n FROM ActivityLog');
	return (result.values?.[0] as { n: number }).n;
}

describe('backup round trip (real schema)', () => {
	beforeEach(async () => {
		db = await createTestDb();
		await db.run(
			"INSERT INTO Media (id, source, externalId, type, title) VALUES ('m1', 'manual', 'x', 'film', 'Heat')",
		);
		await db.run(
			"INSERT INTO ActivityLog (id, mediaId, eventType, payload, occurredAt) VALUES ('a1', 'm1', 'status_changed', '{}', '2026-01-01')",
		);
	});

	it('restores what it exported', async () => {
		const json = await exportDatabaseJson();
		await db.run('DELETE FROM Media');
		await db.run('DELETE FROM ActivityLog');

		await importDatabaseJson(json);

		expect(await titles()).toEqual(['Heat']);
		expect(await activityCount()).toBe(1);
	});

	it('ignores columns the current schema no longer has', async () => {
		const backup = JSON.parse(await exportDatabaseJson());
		backup.data.Media[0].droppedColumn = 'legacy';

		await importDatabaseJson(JSON.stringify(backup));

		expect(await titles()).toEqual(['Heat']);
	});

	it('leaves the library untouched when a row fails to insert', async () => {
		const backup = JSON.parse(await exportDatabaseJson());
		// Duplicate primary key makes the second Media insert fail after earlier tables were cleared.
		backup.data.Media.push({ ...backup.data.Media[0] });

		await expect(importDatabaseJson(JSON.stringify(backup))).rejects.toThrow();

		expect(await titles()).toEqual(['Heat']);
		expect(await activityCount()).toBe(1);
	});
});
