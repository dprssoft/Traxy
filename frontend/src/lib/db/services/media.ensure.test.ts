import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SQLiteDBConnection } from '@capacitor-community/sqlite';
import type { SearchResult } from '$lib/types/mediaTypes';
import { createTestDb } from '../testDb';
import { ensureLocalMedia, getMediaById } from './media.service';

let db: SQLiteDBConnection;

vi.mock('../index', async (importOriginal) => ({
	...(await importOriginal<typeof import('../index')>()),
	getDb: () => db,
}));

const mockGetTmdbDetails = vi.fn();
vi.mock('../sources/tmdb', () => ({
	getTmdbDetails: (...args: unknown[]) => mockGetTmdbDetails(...args),
}));

const searchHit: SearchResult = { source: 'tmdb', externalId: '949', type: 'film', title: 'Heat' };

describe('ensureLocalMedia', () => {
	beforeEach(async () => {
		db = await createTestDb();
		mockGetTmdbDetails.mockReset();
	});

	it('stores every detail the provider returns', async () => {
		mockGetTmdbDetails.mockResolvedValue({
			...searchHit,
			author: 'Michael Mann',
			country: 'US',
			genres: ['Crime', 'Thriller'],
			originalTitle: 'Heat',
			releaseStatus: 'Released',
			runtimeMinutes: 170,
		});

		const media = await ensureLocalMedia(searchHit);
		const stored = await getMediaById(media.id);

		expect(stored).toMatchObject({
			author: 'Michael Mann',
			country: 'US',
			genres: ['Crime', 'Thriller'],
			originalTitle: 'Heat',
			releaseStatus: 'Released',
			runtimeMinutes: 170,
		});
	});

	it('falls back to the search result when the provider has nothing', async () => {
		mockGetTmdbDetails.mockResolvedValue(null);

		const media = await ensureLocalMedia(searchHit);

		expect((await getMediaById(media.id))?.title).toBe('Heat');
	});

	it('returns the existing record without calling the provider again', async () => {
		mockGetTmdbDetails.mockResolvedValue(null);
		const first = await ensureLocalMedia(searchHit);
		mockGetTmdbDetails.mockClear();

		const second = await ensureLocalMedia(searchHit);

		expect(second.id).toBe(first.id);
		expect(mockGetTmdbDetails).not.toHaveBeenCalled();
	});
});
