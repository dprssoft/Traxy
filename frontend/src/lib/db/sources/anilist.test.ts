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
		(fetch as any).mockResolvedValue({
			ok: true,
			json: async () => ({
				data: { Page: { media: [anilistItem({ coverImage: { large: 'https://example.com/large.jpg' } })] } },
			}),
		});

		const [result] = await discoverAnilistTrending('ANIME');

		expect(result.posterUrl).toBe('https://example.com/large.jpg');
	});

	it('detail results fall back to "extraLarge" (DETAIL_QUERY does not request "large")', async () => {
		(fetch as any).mockResolvedValue({
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

describe('anime series chain (Tokyo Revengers)', () => {
	const edge = (relationType: string, id: number, format = 'TV') => ({
		relationType,
		node: { id, type: 'ANIME', format },
	});
	const relations: Record<number, unknown> = {
		120120: { id: 120120, format: 'TV', status: 'FINISHED', episodes: 24, relations: { edges: [edge('SEQUEL', 142853), edge('SPIN_OFF', 132467, 'ONA')] } },
		142853: { id: 142853, format: 'TV', status: 'FINISHED', episodes: 13, relations: { edges: [edge('PREQUEL', 120120), edge('SEQUEL', 163329)] } },
		163329: { id: 163329, format: 'TV', status: 'FINISHED', episodes: 13, relations: { edges: [edge('PREQUEL', 142853), edge('SEQUEL', 178083), edge('SEQUEL', 999, 'MOVIE')] } },
		178083: { id: 178083, format: 'TV', status: 'RELEASING', episodes: null, relations: { edges: [edge('PREQUEL', 163329)] } },
	};

	beforeEach(async () => {
		vi.clearAllMocks();
		vi.stubGlobal(
			'fetch',
			vi.fn(async (_url: string, init: { body: string }) => {
				const { variables } = JSON.parse(init.body);
				return { ok: true, json: async () => ({ data: { Media: relations[variables.id] } }) };
			}),
		);
	});

	it('walks from any season to the whole TV chain, skipping spin-offs and movies', async () => {
		const { resolveAnilistSeriesChain } = await import('./anilist');
		const chain = await resolveAnilistSeriesChain(163329);
		expect(chain?.map((n) => n.id)).toEqual([120120, 142853, 163329, 178083]);
		expect(chain?.map((n) => n.episodes)).toEqual([24, 13, 13, 0]);
	});

	it('does not cache a chain cut short by a failed request', async () => {
		const { resolveAnilistSeriesChain } = await import('./anilist');
		const { setCache } = await import('../apiCache');
		(fetch as Mock).mockImplementation(async (_url: string, init: { body: string }) => {
			const { variables } = JSON.parse(init.body);
			if (variables.id === 163329) return { ok: false, status: 429, json: async () => ({}) };
			return { ok: true, json: async () => ({ data: { Media: relations[variables.id] } }) };
		});
		await expect(resolveAnilistSeriesChain(120120)).rejects.toThrow();
		expect(setCache).not.toHaveBeenCalled();
	});

	it('returns null for a standalone entry', async () => {
		const { resolveAnilistSeriesChain } = await import('./anilist');
		(fetch as Mock).mockResolvedValue({
			ok: true,
			json: async () => ({ data: { Media: { id: 5, format: 'MOVIE', episodes: 1, relations: { edges: [] } } } }),
		});
		expect(await resolveAnilistSeriesChain(5)).toBeNull();
	});
});
