import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SQLiteDBConnection } from '@capacitor-community/sqlite';
import { createTestDb } from './testDb';
import { getCached, getCachedBatch, setCache } from './apiCache';

let db: SQLiteDBConnection;

vi.mock('./index', async (importOriginal) => ({
	...(await importOriginal<typeof import('./index')>()),
	getDb: () => db,
}));

describe('apiCache', () => {
	beforeEach(async () => {
		db = await createTestDb();
	});

	it('returns a stored entry', async () => {
		await setCache('tmdb:1', { title: 'Heat' });
		expect(await getCached('tmdb:1')).toEqual({ title: 'Heat' });
	});

	it('misses on unknown and expired keys', async () => {
		await db.run('INSERT INTO ApiCache (cacheKey, data, cachedAt) VALUES (?, ?, ?)', [
			'old',
			'{}',
			'2000-01-01T00:00:00.000Z',
		]);
		expect(await getCached('missing')).toBeNull();
		expect(await getCached('old')).toBeNull();
	});

	it('batch-reads only fresh hits', async () => {
		await setCache('a', 1);
		await setCache('b', 2);
		const hits = await getCachedBatch<number>(['a', 'b', 'c']);
		expect(Object.fromEntries(hits)).toEqual({ a: 1, b: 2 });
	});
});
