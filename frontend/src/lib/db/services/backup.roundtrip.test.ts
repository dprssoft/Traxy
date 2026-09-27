import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SQLiteDBConnection } from '@capacitor-community/sqlite';
import { createTestDb } from '../testDb';
import {
	clearMediaCache,
	exportDatabaseJson,
	getMediaCacheSize,
	importDatabaseJson,
} from './backup.service';

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
		const media = backup.data.Media;
		media.columns.push('droppedColumn');
		media.rows[0][media.columns.length - 1] = 'legacy';

		await importDatabaseJson(JSON.stringify(backup));

		expect(await titles()).toEqual(['Heat']);
	});

	it('leaves the library untouched when a row fails to insert', async () => {
		const backup = JSON.parse(await exportDatabaseJson());
		// Duplicate primary key makes the second Media insert fail after earlier tables were cleared.
		backup.data.Media.rows.push([...backup.data.Media.rows[0]]);

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

describe('slim v3 backup (real schema)', () => {
	const description = 'A long synopsis. '.repeat(50);

	beforeEach(async () => {
		db = await createTestDb();
		await db.run(
			`INSERT INTO Media (id, source, externalId, type, title, year, posterUrl, totalEpisodes, description, genres, seasonData)
			 VALUES ('p1', 'tmdb', '1396', 'tv', 'Breaking Bad', 2008, 'https://img/bb.jpg', 62, ?, '["Drama"]', '[{"season":1}]'),
			        ('u1', 'manual', 'x', 'book', 'My Zine', 2020, NULL, NULL, 'Hand-written', '["Art"]', NULL)`,
			[description],
		);
		await db.run(
			"INSERT INTO TrackingStatus (id, mediaId, status, currentEpisode, note) VALUES ('t1', 'p1', 'in_progress', 12, 'great')",
		);
		await db.run(
			`INSERT INTO ActivityLog (id, mediaId, mediaTitle, mediaPosterUrl, mediaType, eventType, payload, occurredAt)
			 VALUES ('a1', 'p1', 'Breaking Bad', 'https://img/bb.jpg', 'tv', 'episode_watched', '{"episode":12}', '2026-01-02'),
			        ('a2', 'gone', 'Deleted Show', NULL, 'tv', 'status_changed', '{}', '2026-01-01')`,
		);
	});

	async function media(id: string) {
		const result = await db.query('SELECT * FROM Media WHERE id = ?', [id]);
		return result.values?.[0] as Record<string, unknown>;
	}

	it('drops provider details but keeps manual titles whole', async () => {
		const backup = JSON.parse(await exportDatabaseJson());
		const { columns, rows } = backup.data.Media;
		const row = (id: string) =>
			Object.fromEntries(
				columns.map((c: string, i: number) => [c, rows.find((r: unknown[]) => r[0] === id)[i]]),
			);

		expect(backup.version).toBe(3);
		expect(row('p1')).toMatchObject({ title: 'Breaking Bad', year: 2008, totalEpisodes: 62 });
		expect(row('p1').description).toBeUndefined();
		expect(row('u1')).toMatchObject({ description: 'Hand-written', genres: '["Art"]' });
		expect(columns).not.toContain('detailsPending');
	});

	it('restores the library and marks provider titles for a details reload', async () => {
		const json = await exportDatabaseJson();

		await importDatabaseJson(json);

		expect(await media('p1')).toMatchObject({
			title: 'Breaking Bad',
			posterUrl: 'https://img/bb.jpg',
			totalEpisodes: 62,
			description: null,
			detailsPending: 1,
		});
		expect(await media('u1')).toMatchObject({ description: 'Hand-written', detailsPending: null });
		const tracking = await db.query('SELECT * FROM TrackingStatus');
		expect(tracking.values?.[0]).toMatchObject({ currentEpisode: 12, note: 'great' });
	});

	it('leaves copied titles out of feed rows and restores them from the library', async () => {
		const backup = JSON.parse(await exportDatabaseJson());
		expect(JSON.stringify(backup.data.ActivityLog)).not.toContain('https://img/bb.jpg');

		await importDatabaseJson(JSON.stringify(backup));

		const feed = await db.query(
			'SELECT id, mediaTitle, mediaPosterUrl, mediaType FROM ActivityLog ORDER BY id',
		);
		expect(feed.values).toEqual([
			{
				id: 'a1',
				mediaTitle: 'Breaking Bad',
				mediaPosterUrl: 'https://img/bb.jpg',
				mediaType: 'tv',
			},
			{ id: 'a2', mediaTitle: 'Deleted Show', mediaPosterUrl: null, mediaType: 'tv' },
		]);
	});

	it('still restores full details from an older backup', async () => {
		const old = {
			version: 2,
			data: {
				Media: [
					{
						id: 'p1',
						source: 'tmdb',
						externalId: '1396',
						type: 'tv',
						title: 'Breaking Bad',
						description,
					},
				],
			},
		};

		await importDatabaseJson(JSON.stringify(old));

		expect(await media('p1')).toMatchObject({ description, detailsPending: null });
	});

	it('keeps only the latest feed entries from an older backup', async () => {
		const ActivityLog = Array.from({ length: 150 }, (_, i) => ({
			id: `e${i}`,
			eventType: 'status_changed',
			payload: '{}',
			occurredAt: `2026-01-01T00:00:${String(i % 60).padStart(2, '0')}.${String(i).padStart(3, '0')}Z`,
		}));

		await importDatabaseJson(JSON.stringify({ version: 2, data: { ActivityLog } }));

		expect(await activityCount()).toBe(100);
	});

	it('is much smaller than the old pretty-printed format', async () => {
		for (let i = 0; i < 200; i++) {
			await db.run(
				`INSERT INTO Media (id, source, externalId, type, title, year, posterUrl, description, genres, seasonData)
				 VALUES (?, 'anilist', ?, 'anime', ?, 2020, ?, ?, '["Action","Drama"]', ?)`,
				[
					`m${i}`,
					String(i),
					`Show ${i}`,
					`https://img/${i}.jpg`,
					description,
					JSON.stringify(
						Array.from({ length: 4 }, (_, s) => ({
							season: s + 1,
							episodes: 12,
							title: `Season ${s + 1}`,
						})),
					),
				],
			);
			await db.run(
				"INSERT INTO TrackingStatus (id, mediaId, status, currentEpisode, createdAt, updatedAt) VALUES (?, ?, 'completed', 12, '2026-01-01', '2026-01-01')",
				[`tr${i}`, `m${i}`],
			);
		}
		const oldFormat: Record<string, unknown> = {};
		for (const table of ['Media', 'TrackingStatus', 'ActivityLog']) {
			oldFormat[table] = (await db.query(`SELECT * FROM ${table}`)).values;
		}
		const oldSize = JSON.stringify({ version: 2, data: oldFormat }, null, 2).length;

		const newSize = (await exportDatabaseJson()).length;

		expect(newSize).toBeLessThan(oldSize * 0.15);
	});
});

describe('clearMediaCache (real schema)', () => {
	beforeEach(async () => {
		db = await createTestDb();
		await db.run(
			`INSERT INTO Media (id, source, externalId, type, title, year, posterUrl, totalEpisodes, description, genres)
			 VALUES ('p1', 'tmdb', '1396', 'tv', 'Breaking Bad', 2008, 'https://img/bb.jpg', 62, 'Chemistry.', '["Drama"]'),
			        ('u1', 'manual', 'x', 'book', 'My Zine', 2020, NULL, NULL, 'Hand-written', NULL)`,
		);
		await db.run(
			"INSERT INTO TrackingStatus (id, mediaId, status, currentEpisode) VALUES ('t1', 'p1', 'in_progress', 12)",
		);
		await db.run(
			"INSERT INTO ActivityLog (id, mediaId, mediaTitle, eventType, payload, occurredAt) VALUES ('a1', 'p1', 'Breaking Bad', 'episode_watched', '{}', '2026-01-01')",
		);
		await db.run("INSERT INTO Collection (id, name) VALUES ('c1', 'Favourites')");
		await db.run(
			"INSERT INTO ApiCache (cacheKey, data, cachedAt) VALUES ('k', '{\"big\":1}', '2026-01-01')",
		);
	});

	it('clears provider details and the API cache, and keeps user data', async () => {
		expect(await getMediaCacheSize()).toBeGreaterThan(0);

		await clearMediaCache();

		const media = (await db.query('SELECT * FROM Media ORDER BY id')).values as Record<
			string,
			unknown
		>[];
		expect(media[0]).toMatchObject({
			id: 'p1',
			title: 'Breaking Bad',
			posterUrl: 'https://img/bb.jpg',
			totalEpisodes: 62,
			description: null,
			genres: null,
			detailsPending: 1,
		});
		expect(media[1]).toMatchObject({ id: 'u1', description: 'Hand-written', detailsPending: null });
		expect(await activityCount()).toBe(1);
		expect((await db.query('SELECT * FROM TrackingStatus')).values).toHaveLength(1);
		expect((await db.query('SELECT * FROM Collection')).values).toHaveLength(1);
		expect((await db.query('SELECT * FROM ApiCache')).values).toHaveLength(0);
		expect(await getMediaCacheSize()).toBe(0);
	});
});
