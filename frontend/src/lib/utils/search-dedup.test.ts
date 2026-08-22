import { describe, it, expect } from 'vitest';
import { normalizeTitle, deduplicateResults } from './search-dedup';
import type { SearchResult } from '$lib/types/mediaTypes';

function make(overrides: Partial<SearchResult> & { title: string; source: string; type: string }): SearchResult {
	return {
		externalId: '1',
		...overrides,
	} as SearchResult;
}

describe('normalizeTitle', () => {
	it('lowercases and strips punctuation', () => {
		expect(normalizeTitle('Jujutsu Kaisen!')).toBe('jujutsu kaisen');
		expect(normalizeTitle('Attack on Titan')).toBe('attack on titan');
	});

	it('strips diacritics', () => {
		expect(normalizeTitle('Café')).toBe('cafe');
	});

	it('collapses whitespace', () => {
		expect(normalizeTitle('  Naruto   ')).toBe('naruto');
	});
});

describe('deduplicateResults', () => {
	it('suppresses TMDB tv result when AniList has same title as anime', () => {
		const results = [
			make({ title: 'Jujutsu Kaisen', source: 'anilist', type: 'anime', externalId: '113415' }),
			make({ title: 'Jujutsu Kaisen', source: 'tmdb', type: 'tv', externalId: '94954' }),
		];
		const out = deduplicateResults(results);
		expect(out).toHaveLength(1);
		expect(out[0].source).toBe('anilist');
	});

	it('suppresses OpenLibrary book result when AniList has same title as manga', () => {
		const results = [
			make({ title: 'Berserk', source: 'anilist', type: 'manga', externalId: '97' }),
			make({ title: 'Berserk', source: 'openlibrary', type: 'book', externalId: '/works/OL123W' }),
		];
		const out = deduplicateResults(results);
		expect(out).toHaveLength(1);
		expect(out[0].source).toBe('anilist');
	});

	it('keeps both when TMDB has a film and a title is NOT in AniList', () => {
		const results = [
			make({ title: 'Dune', source: 'tmdb', type: 'film', externalId: '438631' }),
			make({ title: 'Dune', source: 'openlibrary', type: 'book', externalId: '/works/OL893795W' }),
		];
		const out = deduplicateResults(results);
		expect(out).toHaveLength(2);
	});

	it('keeps both TMDB tv and ComicVine comic for Walking Dead (neither is anime/manga)', () => {
		const results = [
			make({ title: 'The Walking Dead', source: 'tmdb', type: 'tv', externalId: '1402' }),
			make({ title: 'The Walking Dead', source: 'comicvine', type: 'comic', externalId: '18166' }),
		];
		const out = deduplicateResults(results);
		expect(out).toHaveLength(2);
	});

	it('places AniList results first', () => {
		const results = [
			make({ title: 'Naruto', source: 'tmdb', type: 'tv', externalId: '46260' }),
			make({ title: 'Naruto', source: 'anilist', type: 'anime', externalId: '20' }),
		];
		const out = deduplicateResults(results);
		expect(out[0].source).toBe('anilist');
	});

	it('handles case/punctuation variation across sources', () => {
		const results = [
			make({ title: 'Attack on Titan', source: 'anilist', type: 'anime', externalId: '16498' }),
			make({ title: 'Attack on Titan', source: 'tmdb', type: 'tv', externalId: '1429' }),
		];
		const out = deduplicateResults(results);
		expect(out).toHaveLength(1);
		expect(out[0].source).toBe('anilist');
	});

	it('suppresses TMDB tv even when a tv-type filter is applied after dedup', () => {
		// Simulate the real Searchbar flow: dedup on full raw, then filter by 'tv'.
		const raw = [
			make({ title: 'Jujutsu Kaisen', source: 'anilist', type: 'anime', externalId: '113415' }),
			make({ title: 'Jujutsu Kaisen', source: 'tmdb', type: 'tv', externalId: '94954' }),
		];
		const deduped = deduplicateResults(raw);
		const tvOnly = deduped.filter(r => r.type === 'tv');
		expect(tvOnly).toHaveLength(0);
	});

	it('suppresses OpenLibrary volume entries when AniList has the series (Gantz Volume 1, 2…)', () => {
		const raw = [
			make({ title: 'Gantz', source: 'anilist', type: 'manga', externalId: '1' }),
			make({ title: 'Gantz Volume 1', source: 'openlibrary', type: 'book', externalId: '/works/OL1W' }),
			make({ title: 'Gantz Volume 2', source: 'openlibrary', type: 'book', externalId: '/works/OL2W' }),
		];
		const out = deduplicateResults(raw);
		expect(out).toHaveLength(1);
		expect(out[0].source).toBe('anilist');
	});

	it('suppresses "Berserk Vol 38" when AniList has "Berserk"', () => {
		const raw = [
			make({ title: 'Berserk', source: 'anilist', type: 'manga', externalId: '97' }),
			make({ title: 'Berserk Vol 38', source: 'openlibrary', type: 'book', externalId: '/works/OL3W' }),
		];
		const out = deduplicateResults(raw);
		expect(out).toHaveLength(1);
	});

	it('keeps a real book with the same name as a manga when subtitle is not a volume number', () => {
		// "Gantz: A Cultural Study" is a distinct work, not a volume of the manga.
		const raw = [
			make({ title: 'Gantz', source: 'anilist', type: 'manga', externalId: '1' }),
			make({ title: 'Gantz: A Cultural Study', source: 'openlibrary', type: 'book', externalId: '/works/OL99W' }),
		];
		const out = deduplicateResults(raw);
		// The cultural study should survive; only the AniList series is kept for the series itself.
		expect(out.some(r => r.source === 'openlibrary')).toBe(true);
	});
});
