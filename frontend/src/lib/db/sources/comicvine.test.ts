import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { discoverComicVineNew } from './comicvine';

vi.mock('../apiCache', () => ({
	getCached: vi.fn(async () => null),
	setCache: vi.fn(async () => {}),
}));

vi.mock('$lib/stores/apiKeys.svelte', () => ({
	apiKeyStore: { current: { comicvine: 'test-api-key' } },
}));

describe('discoverComicVineNew', () => {
	beforeEach(() => {
		vi.stubGlobal('fetch', vi.fn());
		vi.clearAllMocks();
	});

	it('skips the network fetch on a cache hit', async () => {
		const { getCached } = await import('../apiCache');
		(getCached as Mock).mockResolvedValueOnce([{ title: 'Cached Comic' }]);

		const result = await discoverComicVineNew();

		expect(result).toEqual([{ title: 'Cached Comic' }]);
		expect(fetch).not.toHaveBeenCalled();
	});

	it('fetches and caches on a cache miss', async () => {
		(fetch as Mock).mockResolvedValue({
			ok: true,
			json: async () => ({ results: [{ id: 1, name: 'New Comic', start_year: '2022' }] }),
		});

		const result = await discoverComicVineNew();

		expect(result[0]).toMatchObject({ externalId: '1', source: 'comicvine', title: 'New Comic', year: 2022 });
		const { setCache } = await import('../apiCache');
		expect(setCache).toHaveBeenCalledWith('comicvine:discover:new', result);
	});

	it('flags volumes whose title or blurbs contain adult keywords', async () => {
		(fetch as Mock).mockResolvedValue({
			ok: true,
			json: async () => ({
				results: [
					{ id: 1, name: 'Night Tales', deck: 'An erotic anthology' },
					{ id: 2, name: 'Hero', description: '<p>For <b>adults only</b>.</p>' },
					{ id: 3, name: 'Batman', deck: 'The Dark Knight returns' },
				],
			}),
		});

		const results = await discoverComicVineNew();

		expect(results.map((r) => r.isAdult)).toEqual([true, true, false]);
	});

	it('bypasses the cache and re-fetches when forceRefresh is true', async () => {
		const { getCached } = await import('../apiCache');
		(getCached as Mock).mockResolvedValueOnce([{ title: 'Stale' }]);
		(fetch as Mock).mockResolvedValue({ ok: true, json: async () => ({ results: [] }) });

		await discoverComicVineNew(true);

		expect(getCached).not.toHaveBeenCalled();
		expect(fetch).toHaveBeenCalled();
	});
});
