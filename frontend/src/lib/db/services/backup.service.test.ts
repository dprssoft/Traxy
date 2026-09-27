import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	exportDatabaseJson,
	importDatabaseJson,
	resetAllUserData,
	clearMediaCache,
	restoreAnimeMergeBackupIfPresent,
} from './backup.service';

// Real table names, per the CREATE TABLE statements in db/index.ts. backup.service.ts
// previously hardcoded stale names ('LocalMedia', 'CustomCollection') that don't exist in
// the schema — these tests pin the SQL to the real tables and catch that regression.
const REAL_TABLES = [
	'Media',
	'TrackingStatus',
	'WatchCycle',
	'Collection',
	'CollectionItem',
	'ActivityLog',
	'Goal',
];
const STALE_TABLE_NAMES = ['LocalMedia', 'CustomCollection'];

let executedQueries: { type: 'query' | 'run'; sql: string; values?: unknown[] }[] = [];
// Rows returned for `PRAGMA table_info(...)` — one entry per column in the live table.
let tableColumns: unknown[] = [];
// Rows returned for AppSettings reads.
let appSettingsRows: unknown[] = [];

vi.mock('../index', () => ({
	getDb: () => ({
		query: vi.fn(async (sql: string, values: any[] = []) => {
			executedQueries.push({ type: 'query', sql, values });
			if (sql.startsWith('PRAGMA table_info')) return { values: tableColumns };
			if (sql.includes('FROM AppSettings')) return { values: appSettingsRows };
			return { values: [] };
		}),
		run: vi.fn(async (sql: string, values: any[] = []) => {
			executedQueries.push({ type: 'run', sql, values });
			return { changes: 0 };
		}),
		// Restores run as one transactional set — record each statement like a `run`.
		executeSet: vi.fn(async (set: { statement: string; values?: unknown[] }[]) => {
			for (const { statement, values } of set) {
				executedQueries.push({ type: 'run', sql: statement, values });
			}
			return { changes: 0 };
		}),
	}),
}));

describe('backup.service', () => {
	beforeEach(() => {
		executedQueries = [];
		tableColumns = [];
	});

	describe('exportDatabaseJson', () => {
		it('queries every real table and none of the stale/nonexistent ones', async () => {
			await exportDatabaseJson();

			for (const table of REAL_TABLES) {
				expect(executedQueries.some((q) => q.sql === `SELECT * FROM ${table}`)).toBe(true);
			}
			for (const stale of STALE_TABLE_NAMES) {
				expect(executedQueries.some((q) => q.sql.includes(stale))).toBe(false);
			}
		});

		it('includes the Goal table so saved goals survive a backup', async () => {
			await exportDatabaseJson();
			expect(executedQueries.some((q) => q.sql === 'SELECT * FROM Goal')).toBe(true);
		});

		it('returns a JSON payload keyed by table name', async () => {
			const json = JSON.parse(await exportDatabaseJson());
			expect(json.version).toBe(1);
			for (const table of REAL_TABLES) {
				expect(json.data).toHaveProperty(table);
			}
		});
	});

	describe('importDatabaseJson', () => {
		it('deletes and repopulates every real table and none of the stale ones', async () => {
			const backup = { data: Object.fromEntries(REAL_TABLES.map((t) => [t, []])) };
			await importDatabaseJson(JSON.stringify(backup));

			for (const table of REAL_TABLES) {
				expect(executedQueries.some((q) => q.sql === `DELETE FROM ${table}`)).toBe(true);
			}
			for (const stale of STALE_TABLE_NAMES) {
				expect(executedQueries.some((q) => q.sql.includes(stale))).toBe(false);
			}
		});

		it('rejects a payload without a data property', async () => {
			await expect(importDatabaseJson(JSON.stringify({ version: 1 }))).rejects.toThrow(
				'Invalid backup format',
			);
		});

		it('inserts rows for a table that has data in the backup', async () => {
			const backup = {
				data: {
					...Object.fromEntries(REAL_TABLES.map((t) => [t, []])),
					Goal: [['goal-1', 'game', 10, 2026, '2026-01-01T00:00:00.000Z']],
				},
			};
			await importDatabaseJson(JSON.stringify(backup));

			expect(
				executedQueries.some(
					(q) => q.type === 'run' && q.sql.startsWith('INSERT INTO Goal'),
				),
			).toBe(true);
		});

		it('pads rows from older backups that predate newly added columns', async () => {
			tableColumns = new Array(6).fill({});
			const backup = {
				data: {
					...Object.fromEntries(REAL_TABLES.map((t) => [t, []])),
					Goal: [['goal-1', 'game', 10, 2026, '2026-01-01T00:00:00.000Z']],
				},
			};
			await importDatabaseJson(JSON.stringify(backup));

			const insert = executedQueries.find((q) => q.sql.startsWith('INSERT INTO Goal'));
			expect(insert?.values).toHaveLength(6);
			expect(insert?.values?.[5]).toBeNull();
		});
	});

	describe('resetAllUserData', () => {
		it('deletes every real table (including settings/cache) and none of the stale ones', async () => {
			await resetAllUserData();

			for (const table of [...REAL_TABLES, 'ApiCache', 'AppSettings']) {
				expect(executedQueries.some((q) => q.sql === `DELETE FROM ${table}`)).toBe(true);
			}
			for (const stale of STALE_TABLE_NAMES) {
				expect(executedQueries.some((q) => q.sql.includes(stale))).toBe(false);
			}
		});
	});

	describe('clearMediaCache', () => {
		it('deletes only from ApiCache', async () => {
			await clearMediaCache();
			expect(executedQueries).toEqual([
				{ type: 'run', sql: 'DELETE FROM ApiCache', values: [] },
			]);
		});
	});
});

describe('restoreAnimeMergeBackupIfPresent', () => {
	beforeEach(() => {
		executedQueries = [];
		tableColumns = [];
		appSettingsRows = [];
	});

	it('does nothing when the merge never ran', async () => {
		expect(await restoreAnimeMergeBackupIfPresent()).toBe(false);
		expect(executedQueries.filter((q) => q.type === 'run')).toEqual([]);
	});

	it('restores the pre-merge library and drops the merge settings', async () => {
		const backup = { version: 1, data: { Media: [['m1', 'anilist', '142853']] } };
		appSettingsRows = [[JSON.stringify({ db: JSON.stringify(backup), seriesIds: [] })]];
		tableColumns = [{}, {}, {}];

		expect(await restoreAnimeMergeBackupIfPresent()).toBe(true);

		const runs = executedQueries.filter((q) => q.type === 'run');
		expect(runs).toContainEqual(
			expect.objectContaining({ sql: 'INSERT INTO Media VALUES (?, ?, ?)', values: ['m1', 'anilist', '142853'] }),
		);
		const deletedKeys = runs
			.filter((q) => q.sql.startsWith('DELETE FROM AppSettings'))
			.map((q) => q.values?.[0]);
		expect(deletedKeys).toEqual([
			'anime_merge_backup',
			'anime_merge_pending',
			'anime_series_ids',
			'feat_merge_anime_seasons',
		]);
	});
});
