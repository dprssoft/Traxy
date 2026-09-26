import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { fetchWikidataEnrichment, pickBestMatch } from './wikipedia';
import { getCached, setCache } from '../apiCache';

vi.mock('../apiCache', () => ({
	getCached: vi.fn(async () => null),
	setCache: vi.fn(async () => {}),
}));

const ok = (body: unknown) => ({ ok: true, json: async () => body });

describe('pickBestMatch', () => {
	it('prefers the hit whose description matches the media type', () => {
		const hits = [
			{ id: 'Q1', label: 'Dune', description: 'planet in a novel' },
			{ id: 'Q2', label: 'Dune', description: '2021 film by Denis Villeneuve' },
		];
		expect(pickBestMatch(hits, 'Dune', 'film')).toBe('Q2');
	});

	it('ignores an exact label match whose description is another media type', () => {
		const hits = [
			{ id: 'Q12008802', label: 'Vagabond', description: 'Norwegian musical group' },
			{ id: 'Q2298257', label: 'Vagabond', description: '1985 film directed by Agnès Varda' },
		];
		expect(pickBestMatch(hits, 'Vagabond', 'manga')).toBeNull();
	});

	it('returns null when no hit scores, so the fuzzy fallback runs', () => {
		const hits = [{ id: 'Q1', label: 'Something else', description: 'river in France' }];
		expect(pickBestMatch(hits, 'Dune', 'film')).toBeNull();
	});
});

describe('fetchWikidataEnrichment', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal('fetch', vi.fn());
	});

	it('returns a cached result without touching the network', async () => {
		(getCached as Mock).mockResolvedValueOnce({ result: null });
		expect(await fetchWikidataEnrichment('Dune', 'film')).toBeNull();
		expect(fetch).not.toHaveBeenCalled();
	});

	it('builds enrichment with labels and the article link, then caches it', async () => {
		(fetch as Mock)
			.mockResolvedValueOnce(ok({ search: [{ id: 'Q2', label: 'Dune', description: '2021 film' }] }))
			.mockResolvedValueOnce(
				ok({
					entities: {
						Q2: {
							claims: {
								P57: [{ mainsnak: { datavalue: { type: 'wikibase-entityid', value: { id: 'Q10' } } } }],
								P495: [{ mainsnak: { datavalue: { type: 'wikibase-entityid', value: { id: 'Q30' } } } }],
								P2047: [{ mainsnak: { datavalue: { type: 'quantity', value: { amount: '+155' } } } }],
							},
							descriptions: { en: { value: '2021 film' } },
							sitelinks: { enwiki: { url: 'https://en.wikipedia.org/wiki/Dune_(2021_film)' } },
						},
					},
				}),
			)
			.mockResolvedValueOnce(
				ok({
					entities: {
						Q10: { labels: { en: { value: 'Denis Villeneuve' } } },
						Q30: { labels: { en: { value: 'United States' } } },
					},
				}),
			);

		const result = await fetchWikidataEnrichment('Dune', 'film');

		expect(result).toMatchObject({
			wikidataId: 'Q2',
			wikipediaUrl: 'https://en.wikipedia.org/wiki/Dune_(2021_film)',
			author: 'Denis Villeneuve',
			country: 'United States',
			description: '2021 film',
			runtimeMinutes: 155,
		});
		expect(fetch).toHaveBeenCalledTimes(3);
		expect(setCache).toHaveBeenCalledWith('wikidata:v2:en:film:dune', { result });
	});

	it('rejects without caching when the network fails', async () => {
		(fetch as Mock).mockRejectedValueOnce(new Error('offline'));
		await expect(fetchWikidataEnrichment('Dune', 'film')).rejects.toThrow('offline');
		expect(setCache).not.toHaveBeenCalled();
	});
});
