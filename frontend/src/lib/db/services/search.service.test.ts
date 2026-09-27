import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchAll, expandSearchType, collapseToSearchType } from './search.service';
import { DEFAULT_SEARCH_PREFS } from './settings.service';
import { searchTmdb } from '../sources/tmdb';
import { searchIgdb } from '../sources/igdb';
import { searchAnilist } from '../sources/anilist';
import { searchComicVine } from '../sources/comicvine';
import { searchOpenLibrary } from '../sources/openlibrary';
import { searchFlashpoint } from '../sources/flashpoint';
import type { SearchResult } from '$lib/types/mediaTypes';

vi.mock('../sources/tmdb', () => ({ searchTmdb: vi.fn() }));
vi.mock('../sources/igdb', () => ({ searchIgdb: vi.fn() }));
vi.mock('../sources/anilist', () => ({ searchAnilist: vi.fn() }));
vi.mock('../sources/comicvine', () => ({ searchComicVine: vi.fn() }));
vi.mock('../sources/openlibrary', () => ({ searchOpenLibrary: vi.fn() }));
vi.mock('../sources/flashpoint', () => ({ searchFlashpoint: vi.fn() }));

function result(source: SearchResult['source'], type: SearchResult['type'], title: string) {
	return { source, externalId: title, type, title } as SearchResult;
}

const prefs = { ...DEFAULT_SEARCH_PREFS, flashpointEnabled: false };

describe('searchAll', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.clearAllMocks();
		vi.mocked(searchTmdb).mockResolvedValue([
			result('tmdb', 'film', 'Heat'),
			result('tmdb', 'tv', 'Severance'),
		]);
		vi.mocked(searchIgdb).mockResolvedValue([result('igdb', 'game', 'Hades')]);
		vi.mocked(searchAnilist).mockImplementation(async (_q, kind) =>
			kind === 'ANIME'
				? [result('anilist', 'anime', 'Frieren')]
				: [result('anilist', 'manga', 'Berserk')],
		);
		vi.mocked(searchComicVine).mockResolvedValue([result('comicvine', 'comic', 'Saga')]);
		vi.mocked(searchOpenLibrary).mockResolvedValue([result('openlibrary', 'book', 'Dune')]);
		vi.mocked(searchFlashpoint).mockResolvedValue([]);
	});

	it('returns nothing and calls no provider for a blank query', async () => {
		expect(await searchAll('   ', [], prefs)).toEqual([]);
		expect(searchTmdb).not.toHaveBeenCalled();
	});

	it('merges every provider for "all"', async () => {
		const titles = (await searchAll('x', [], prefs)).map((r) => r.title).sort();
		expect(titles).toEqual(['Berserk', 'Dune', 'Frieren', 'Hades', 'Heat', 'Saga', 'Severance']);
		expect(searchFlashpoint).not.toHaveBeenCalled();
	});

	it('only queries the providers a type needs and keeps that type', async () => {
		const games = await searchAll('x', ['game'], { ...prefs, flashpointEnabled: true });
		expect(games.map((r) => r.title)).toEqual(['Hades']);
		expect(searchFlashpoint).toHaveBeenCalledWith('x');
		expect(searchTmdb).not.toHaveBeenCalled();
		expect(searchOpenLibrary).not.toHaveBeenCalled();
	});

	it('treats manga as part of the comic filter', async () => {
		const titles = (await searchAll('x', expandSearchType('comic'), prefs))
			.map((r) => r.title)
			.sort();
		expect(titles).toEqual(['Berserk', 'Saga']);
	});

	it('skips a provider that fails', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.mocked(searchTmdb).mockRejectedValueOnce(new Error('offline'));
		const titles = (await searchAll('x', ['film'], prefs)).map((r) => r.title);
		expect(titles).toEqual([]);
		expect(console.error).toHaveBeenCalled();
	});

	it('combines several types', async () => {
		const titles = (await searchAll('x', ['film', 'book'], prefs)).map((r) => r.title).sort();
		expect(titles).toEqual(['Dune', 'Heat']);
		expect(searchIgdb).not.toHaveBeenCalled();
	});
});

describe('search type mapping', () => {
	it('expands the search-bar filters into media types', () => {
		expect(expandSearchType('all')).toEqual([]);
		expect(expandSearchType('film')).toEqual(['film']);
		expect(expandSearchType('comic')).toEqual(['manga', 'manhwa', 'manhua', 'comic']);
	});

	it('collapses media types back to a search-bar filter when one matches', () => {
		expect(collapseToSearchType(['comic', 'manga', 'manhua', 'manhwa'])).toBe('comic');
		expect(collapseToSearchType(['tv'])).toBe('tv');
		expect(collapseToSearchType(['film', 'tv'])).toBe('all');
		expect(collapseToSearchType([])).toBe('all');
	});
});
