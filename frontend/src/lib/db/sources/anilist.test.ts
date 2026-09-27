import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { discoverAnilistTrending, getAnilistDetails } from './anilist';

vi.mock('../apiCache', () => ({
	getCached: vi.fn(async () => null),
	setCache: vi.fn(async () => {}),
}));

function anilistItem(overrides: Record<string, unknown> = {}) {
	return {
		id: 1,
		title: { romaji: 'Test', english: 'Test', native: 'Test' },
		type: 'ANIME',
		format: 'TV',
		status: 'FINISHED',
		episodes: 12,
		chapters: null,
		volumes: null,
		startDate: { year: 2020 },
		endDate: { year: 2020 },
		description: null,
		countryOfOrigin: 'JP',
		genres: [],
		duration: null,
		staff: { edges: [] },
		coverImage: {},
		...overrides,
	};
}

describe('anilist posterUrl mapping', () => {
	beforeEach(() => {
		vi.stubGlobal('fetch', vi.fn());
	});

	it('discover results use the smaller "large" cover requested by DISCOVER_QUERY', async () => {
		(fetch as Mock).mockResolvedValue({
			ok: true,
			json: async () => ({
				data: {
					Page: {
						media: [anilistItem({ coverImage: { large: 'https://example.com/large.jpg' } })],
					},
				},
			}),
		});

		const [result] = await discoverAnilistTrending('ANIME');

		expect(result.posterUrl).toBe('https://example.com/large.jpg');
	});

	it('detail results fall back to "extraLarge" (DETAIL_QUERY does not request "large")', async () => {
		(fetch as Mock).mockResolvedValue({
			ok: true,
			json: async () => ({
				data: { Media: anilistItem({ coverImage: { extraLarge: 'https://example.com/xl.jpg' } }) },
			}),
		});

		const result = await getAnilistDetails(1);

		expect(result?.posterUrl).toBe('https://example.com/xl.jpg');
	});

	it('flags adult media from the isAdult field or the Hentai genre', async () => {
		(fetch as Mock).mockResolvedValue({
			ok: true,
			json: async () => ({
				data: {
					Page: {
						media: [
							anilistItem({ id: 1, isAdult: true }),
							anilistItem({ id: 2, isAdult: false, genres: ['Hentai'] }),
							anilistItem({ id: 3, isAdult: false, genres: ['Action'] }),
						],
					},
				},
			}),
		});

		const results = await discoverAnilistTrending('ANIME');

		expect(results.map((r) => r.isAdult)).toEqual([true, true, false]);
	});
});
