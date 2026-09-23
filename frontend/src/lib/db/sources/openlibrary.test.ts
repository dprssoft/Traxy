import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { discoverOpenLibraryTrending, searchOpenLibrary } from './openlibrary';

vi.mock('../apiCache', () => ({
	getCached: vi.fn(async () => null),
	setCache: vi.fn(async () => {}),
}));

describe('discoverOpenLibraryTrending', () => {
	beforeEach(() => {
		vi.stubGlobal('fetch', vi.fn());
		vi.clearAllMocks();
	});

	it('skips the network fetch on a cache hit', async () => {
		const { getCached } = await import('../apiCache');
		(getCached as any).mockResolvedValueOnce([{ title: 'Cached Book' }]);

		const result = await discoverOpenLibraryTrending();

		expect(result).toEqual([{ title: 'Cached Book' }]);
		expect(fetch).not.toHaveBeenCalled();
	});

	it('fetches and caches on a cache miss', async () => {
		(fetch as any).mockResolvedValue({
			ok: true,
			json: async () => ({ works: [{ key: '/works/OL1W', title: 'New Book', first_publish_year: 2020 }] }),
		});

		const result = await discoverOpenLibraryTrending();

		expect(result).toEqual([
			{ externalId: '/works/OL1W', source: 'openlibrary', type: 'book', title: 'New Book', year: 2020, posterUrl: undefined },
		]);
		const { setCache } = await import('../apiCache');
		expect(setCache).toHaveBeenCalledWith('openlibrary:discover:trending', result);
	});

	it('bypasses the cache and re-fetches when forceRefresh is true', async () => {
		const { getCached } = await import('../apiCache');
		(getCached as any).mockResolvedValueOnce([{ title: 'Stale' }]);
		(fetch as any).mockResolvedValue({ ok: true, json: async () => ({ works: [] }) });

		await discoverOpenLibraryTrending(true);

		expect(getCached).not.toHaveBeenCalled();
		expect(fetch).toHaveBeenCalled();
	});
});

describe('searchOpenLibrary adult flag', () => {
	beforeEach(async () => {
		vi.stubGlobal('fetch', vi.fn());
		const { getCached } = await import('../apiCache');
		(getCached as Mock).mockReset().mockResolvedValue(null);
	});

	it('requests subjects and flags books with adult subject tags', async () => {
		(fetch as Mock).mockResolvedValue({
			ok: true,
			json: async () => ({
				docs: [
					{ key: '/works/OL1W', title: 'Shades', subject: ['Romance', 'Fiction, erotica'] },
					{ key: '/works/OL2W', title: 'Affairs', subject: ['Adultery'] },
					{ key: '/works/OL3W', title: 'No Subjects' },
				],
			}),
		});

		const results = await searchOpenLibrary('shades');

		expect(results.map((r) => r.isAdult)).toEqual([true, false, false]);
		expect((fetch as Mock).mock.calls[0][0]).toContain('fields=');
		expect((fetch as Mock).mock.calls[0][0]).toContain('subject');
	});
});
