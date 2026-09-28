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

	describe('settings', () => {
		beforeEach(async () => {
			localStorage.clear();
			await db.run("INSERT INTO AppSettings (key, value) VALUES ('feat_adult_filter', 'false')");
			await db.run("INSERT INTO AppSettings (key, value) VALUES ('anime_merge_pending', '1')");
			localStorage.setItem('traxy:goals:2026', '{"watchCount":80}');
			localStorage.setItem('traxy_sidebar_collapsed', 'true');
			localStorage.setItem('traxy:apiKeys', '{"tmdb":"secret"}');
			localStorage.setItem('traxy:recent_searches', '["heat"]');
		});

		async function appSettings(): Promise<Record<string, string>> {
			const result = await db.query('SELECT key, value FROM AppSettings');
			const rows = result.values as { key: string; value: string }[];
			return Object.fromEntries(rows.map((r) => [r.key, r.value]));
		}

		it('exports settings but not API keys, caches or anime merge leftovers', async () => {
			const { settings } = JSON.parse(await exportDatabaseJson());

			expect(settings.appSettings).toEqual({ feat_adult_filter: 'false' });
			expect(settings.localStorage).toEqual({
				'traxy:goals:2026': '{"watchCount":80}',
				traxy_sidebar_collapsed: 'true',
			});
		});

		it('restores settings and keeps the current API keys', async () => {
			const json = await exportDatabaseJson();
			await db.run("UPDATE AppSettings SET value = 'true' WHERE key = 'feat_adult_filter'");
			await db.run("INSERT INTO AppSettings (key, value) VALUES ('bottom_nav_items', '[]')");
			localStorage.setItem('traxy:goals:2027', '{"watchCount":5}');
			localStorage.setItem('traxy_sidebar_collapsed', 'false');
			localStorage.setItem('traxy:apiKeys', '{"tmdb":"new"}');

			await importDatabaseJson(json);

			expect(await appSettings()).toEqual({ feat_adult_filter: 'false' });
			expect(localStorage.getItem('traxy:goals:2026')).toBe('{"watchCount":80}');
			expect(localStorage.getItem('traxy:goals:2027')).toBeNull();
			expect(localStorage.getItem('traxy_sidebar_collapsed')).toBe('true');
			expect(localStorage.getItem('traxy:apiKeys')).toBe('{"tmdb":"new"}');
		});

		it('keeps current settings when restoring a version 1 backup', async () => {
			const backup = JSON.parse(await exportDatabaseJson());
			delete backup.settings;
			backup.version = 1;

			await importDatabaseJson(JSON.stringify(backup));

			expect(await appSettings()).toEqual({
				feat_adult_filter: 'false',
				anime_merge_pending: '1',
			});
			expect(localStorage.getItem('traxy_sidebar_collapsed')).toBe('true');
		});

		it('restores settings from a data.AppSettings backup', async () => {
			const backup = JSON.parse(await exportDatabaseJson());
			delete backup.settings;
			backup.data.AppSettings = [{ key: 'bottom_nav_items', value: '["/stats"]' }];

			await importDatabaseJson(JSON.stringify(backup));

			expect(await appSettings()).toEqual({ bottom_nav_items: '["/stats"]' });
		});
	});
});
