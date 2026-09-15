import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	exportDatabaseJson,
	importDatabaseJson,
	resetAllUserData,
	clearMediaCache,
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

let executedQueries: { type: 'query' | 'run'; sql: string; values?: any[] }[] = [];

vi.mock('../index', () => ({
	getDb: () => ({
		query: vi.fn(async (sql: string, values: any[] = []) => {
			executedQueries.push({ type: 'query', sql, values });
			return { values: [] };
		}),
		run: vi.fn(async (sql: string, values: any[] = []) => {
			executedQueries.push({ type: 'run', sql, values });
			return { changes: 0 };
		}),
	}),
}));

describe('backup.service', () => {
	beforeEach(() => {
		executedQueries = [];
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
