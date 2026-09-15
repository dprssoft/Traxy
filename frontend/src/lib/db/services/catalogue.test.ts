import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	CATEGORIES,
	recordVisitedMedia,
	getVisitedMedia,
	getCatalogueCacheBatch,
	discoverMedia,
	discoverCategoriesPooled,
} from './catalogue.service';
import type { SearchResult } from '$lib/types/mediaTypes';

vi.mock('../index', () => ({
	getDb: vi.fn(() => null),
}));

const mockGetCachedBatch = vi.fn(async (_keys: string[]) => new Map<string, SearchResult[]>());
vi.mock('../apiCache', () => ({
	getCached: vi.fn(async () => null),
	getCachedBatch: (keys: string[]) => mockGetCachedBatch(keys),
	setCache: vi.fn(async () => {}),
}));

const mockDiscoverTmdbTrending = vi.fn(async () => [] as SearchResult[]);
const mockDiscoverTmdbNew = vi.fn(async () => [] as SearchResult[]);
const mockDiscoverTmdbTopRated = vi.fn(async () => [] as SearchResult[]);
vi.mock('$lib/db/sources/tmdb', () => ({
	discoverTmdbTrending: () => mockDiscoverTmdbTrending(),
	discoverTmdbNew: () => mockDiscoverTmdbNew(),
	discoverTmdbTopRated: () => mockDiscoverTmdbTopRated(),
}));
vi.mock('$lib/db/sources/anilist', () => ({
	discoverAnilistTrending: vi.fn(async () => []),
	discoverAnilistNew: vi.fn(async () => []),
	discoverAnilistTopRated: vi.fn(async () => []),
	discoverAnilistRandom: vi.fn(async () => []),
}));
vi.mock('$lib/db/sources/igdb', () => ({
	discoverIgdbTrending: vi.fn(async () => []),
	discoverIgdbNew: vi.fn(async () => []),
	discoverIgdbTopRated: vi.fn(async () => []),
	discoverIgdbRandom: vi.fn(async () => []),
}));
vi.mock('$lib/db/sources/openlibrary', () => ({
	discoverOpenLibraryTrending: vi.fn(async () => []),
	discoverOpenLibraryNew: vi.fn(async () => []),
	discoverOpenLibraryTopRated: vi.fn(async () => []),
	discoverOpenLibraryRandom: vi.fn(async () => []),
}));
vi.mock('$lib/db/sources/comicvine', () => ({
	discoverComicVineNew: vi.fn(async () => []),
	discoverComicVineTrending: vi.fn(async () => []),
	discoverComicVineTopRated: vi.fn(async () => []),
	discoverComicVineRandom: vi.fn(async () => []),
}));

describe('Catalogue Service', () => {
	beforeEach(() => {
		localStorage.clear();
		mockGetCachedBatch.mockClear();
		mockDiscoverTmdbTrending.mockClear();
	});

	it('defines the 5 categories in wireframe order with clean labels', () => {
		expect(CATEGORIES.map((c) => c.id)).toEqual([
			'trending',
			'new',
			'top_rated',
			'random',
			'visited',
		]);
		expect(CATEGORIES.map((c) => c.label)).toEqual([
			'Trending',
			'New Releases',
			'Top Rated',
			'Random',
			'Visited Earlier',
		]);
	});

	it('records and retrieves visited media from localStorage', async () => {
		const item1: SearchResult = {
			source: 'tmdb',
			externalId: '101',
			type: 'film',
			title: 'Inception',
			year: 2010,
		};
		const item2: SearchResult = {
			source: 'tmdb',
			externalId: '102',
			type: 'tv',
			title: 'Breaking Bad',
			year: 2008,
		};

		recordVisitedMedia(item1);
		recordVisitedMedia(item2);

		const allVisited = await getVisitedMedia('all');
		expect(allVisited).toHaveLength(2);
		expect(allVisited[0].title).toBe('Breaking Bad');
		expect(allVisited[1].title).toBe('Inception');

		// Filter by film
		const filmVisited = await getVisitedMedia('film');
		expect(filmVisited).toHaveLength(1);
		expect(filmVisited[0].title).toBe('Inception');

		// Filter by tv
		const tvVisited = await getVisitedMedia('tv');
		expect(tvVisited).toHaveLength(1);
		expect(tvVisited[0].title).toBe('Breaking Bad');
	});

	it('deduplicates visited items and moves latest to the top', async () => {
		const item1: SearchResult = {
			source: 'tmdb',
			externalId: '101',
			type: 'film',
			title: 'Inception',
			year: 2010,
		};
		const item2: SearchResult = {
			source: 'tmdb',
			externalId: '102',
			type: 'film',
			title: 'Interstellar',
			year: 2014,
		};

		recordVisitedMedia(item1);
		recordVisitedMedia(item2);
		recordVisitedMedia(item1); // Re-visit item1

		const visited = await getVisitedMedia('all');
		expect(visited).toHaveLength(2);
		expect(visited[0].title).toBe('Inception');
		expect(visited[1].title).toBe('Interstellar');
	});

	describe('getCatalogueCacheBatch', () => {
		it('marks a category complete when every one of its source cache keys was a hit', async () => {
			const item: SearchResult = { source: 'tmdb', externalId: '1', type: 'film', title: 'X' };
			mockGetCachedBatch.mockResolvedValueOnce(new Map([['tmdb:trending:film:en-US:1', [item]]]));

			const { data, complete } = await getCatalogueCacheBatch('film', ['trending']);

			expect(complete.trending).toBe(true);
			expect(data.trending).toEqual([item]);
		});

		it('marks a category incomplete when only some of its source cache keys were hits', async () => {
			const item: SearchResult = { source: 'tmdb', externalId: '1', type: 'film', title: 'X' };
			// type: 'all' + category: 'trending' probes 6 keys (tmdb film/tv, anilist, igdb, openlibrary, comicvine).
			// Deliberately omit the comicvine key so this is a 5-of-6 partial hit.
			mockGetCachedBatch.mockResolvedValueOnce(
				new Map([
					['tmdb:trending:film:en-US:1', [item]],
					['tmdb:trending:tv:en-US:1', [item]],
					['anilist:discover:ANIME:TRENDING_DESC:any:1', [item]],
					['igdb:discover:trending', [item]],
					['openlibrary:discover:trending', [item]],
				]),
			);

			const { data, complete } = await getCatalogueCacheBatch('all', ['trending']);

			expect(complete.trending).toBe(false);
			// Still shown immediately from the partial data — just not safe to promote
			// into the in-memory cache, since some sources weren't actually cached.
			expect(data.trending).toBeDefined();
		});

		it('reports no hit and incomplete when the batch has nothing cached', async () => {
			mockGetCachedBatch.mockResolvedValueOnce(new Map());

			const { data, complete } = await getCatalogueCacheBatch('film', ['trending']);

			expect(complete.trending).toBe(false);
			expect(data.trending).toBeUndefined();
		});
	});

	describe('discoverMedia memory-cache short-circuit', () => {
		it('skips the source fetch entirely when the category is already memory-cached', async () => {
			const item: SearchResult = { source: 'tmdb', externalId: '1', type: 'film', title: 'X' };
			const { setMemoryCache } = await import('./catalogue.service');
			setMemoryCache('film', 'trending', [item]);

			const result = await discoverMedia('film', 'trending');

			expect(result).toEqual([item]);
			expect(mockDiscoverTmdbTrending).not.toHaveBeenCalled();
		});

		it('calls the source fetch when the category is not memory-cached', async () => {
			mockDiscoverTmdbTrending.mockResolvedValueOnce([]);

			await discoverMedia('tv', 'trending');

			expect(mockDiscoverTmdbTrending).toHaveBeenCalled();
		});
	});

	describe('discoverCategoriesPooled', () => {
		it('runs categories concurrently but never more than `limit` at once', async () => {
			let concurrent = 0;
			let maxConcurrent = 0;
			const track = async () => {
				concurrent++;
				maxConcurrent = Math.max(maxConcurrent, concurrent);
				await new Promise((r) => setTimeout(r, 20));
				concurrent--;
				return [] as SearchResult[];
			};
			// 'new' -> discoverTmdbNew, 'top_rated' -> discoverTmdbTopRated,
			// 'random' -> discoverTmdbTrending (see discoverTmdbByCategory's random branch).
			mockDiscoverTmdbNew.mockImplementationOnce(track);
			mockDiscoverTmdbTopRated.mockImplementationOnce(track);
			mockDiscoverTmdbTrending.mockImplementationOnce(track);

			const results = await discoverCategoriesPooled(
				'film',
				['new', 'top_rated', 'random'],
				false,
				2,
			);

			expect(maxConcurrent).toBeLessThanOrEqual(2);
			// Proves real parallelism happened (not accidentally serialized down to 1).
			expect(maxConcurrent).toBeGreaterThan(1);
			expect(results).toHaveLength(3);
			expect(results.every((r) => !r.error)).toBe(true);
		});

		it('attaches the originating category to a failed fetch instead of losing it', async () => {
			mockDiscoverTmdbNew.mockRejectedValueOnce(new Error('boom'));
			mockDiscoverTmdbTopRated.mockResolvedValueOnce([]);

			const results = await discoverCategoriesPooled('film', ['new', 'top_rated'], false, 2);

			const failed = results.find((r) => r.cat === 'new');
			expect(failed?.error).toBe(true);
			expect(failed?.data).toEqual([]);
			expect(results.find((r) => r.cat === 'top_rated')?.error).toBe(false);
		});
	});
});
