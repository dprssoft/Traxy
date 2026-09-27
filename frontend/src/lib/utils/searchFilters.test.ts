import { describe, it, expect } from 'vitest';
import {
	applySearchFilters,
	countSheetFilters,
	DEFAULT_SEARCH_FILTERS,
	parseSearchFilters,
	platformOptions,
	searchFiltersParams,
	yearPresets,
	type SearchFilters,
} from './searchFilters';
import type { SearchResult } from '$lib/types/mediaTypes';
import type { MediaType } from '$lib/db/schema';

const TYPES: MediaType[] = ['film', 'tv', 'game', 'anime', 'book'];

function item(title: string, extra: Partial<SearchResult> = {}): SearchResult {
	return { source: 'tmdb', externalId: title, type: 'film', title, ...extra };
}

const filters = (patch: Partial<SearchFilters>): SearchFilters => ({
	...DEFAULT_SEARCH_FILTERS,
	...patch,
});

describe('search filter URL', () => {
	it('round-trips every filter', () => {
		const f = filters({
			types: ['film', 'tv'],
			yearFrom: 2010,
			yearTo: 2019,
			sort: 'newest',
			library: 'untracked',
			platforms: ['PC', 'Nintendo Switch'],
		});
		const qs = searchFiltersParams('dune', f);
		const params = new URLSearchParams(qs.slice(1));

		expect(params.get('q')).toBe('dune');
		expect(parseSearchFilters(params, TYPES)).toEqual(f);
	});

	it('leaves defaults out of the URL', () => {
		expect(searchFiltersParams('dune & co', DEFAULT_SEARCH_FILTERS)).toBe('?q=dune+%26+co');
	});

	it('drops unknown or malformed values', () => {
		const params = new URLSearchParams(
			'q=x&type=film&type=bogus&type=film&from=abc&to=1999&sort=weird&lib=nope',
		);
		expect(parseSearchFilters(params, TYPES)).toEqual(filters({ types: ['film'], yearTo: 1999 }));
	});
});

describe('applySearchFilters', () => {
	const results = [
		item('Heat', { year: 1995 }),
		item('Dune', { year: 2021 }),
		item('Arrival', { year: 2016 }),
		item('Undated'),
		item('Hades', { type: 'game', source: 'igdb', year: 2020, platforms: ['PC', 'Switch'] }),
		item('Halo', { type: 'game', source: 'igdb', year: 2001, platforms: ['Xbox'] }),
	];
	const titles = (r: SearchResult[]) => r.map((x) => x.title);
	const none = new Set<string>();

	it('keeps everything in provider order by default', () => {
		expect(applySearchFilters(results, DEFAULT_SEARCH_FILTERS, none)).toEqual(results);
	});

	it('filters by an inclusive year range and drops undated results', () => {
		expect(titles(applySearchFilters(results, filters({ yearFrom: 2016 }), none))).toEqual([
			'Dune',
			'Arrival',
			'Hades',
		]);
		expect(
			titles(applySearchFilters(results, filters({ yearFrom: 2001, yearTo: 2016 }), none)),
		).toEqual(['Arrival', 'Halo']);
	});

	it('filters by library membership', () => {
		const tracked = new Set(['tmdb:Dune', 'igdb:Halo']);
		expect(titles(applySearchFilters(results, filters({ library: 'tracked' }), tracked))).toEqual([
			'Dune',
			'Halo',
		]);
		expect(titles(applySearchFilters(results, filters({ library: 'untracked' }), tracked))).toEqual(
			['Heat', 'Arrival', 'Undated', 'Hades'],
		);
	});

	it('filters games by platform and leaves other types alone', () => {
		expect(titles(applySearchFilters(results, filters({ platforms: ['Switch'] }), none))).toEqual([
			'Heat',
			'Dune',
			'Arrival',
			'Undated',
			'Hades',
		]);
	});

	it('sorts by year with undated results last, or by title', () => {
		expect(titles(applySearchFilters(results, filters({ sort: 'newest' }), none))).toEqual([
			'Dune',
			'Hades',
			'Arrival',
			'Halo',
			'Heat',
			'Undated',
		]);
		expect(titles(applySearchFilters(results, filters({ sort: 'oldest' }), none))[0]).toBe('Heat');
		expect(titles(applySearchFilters(results, filters({ sort: 'title' }), none))).toEqual([
			'Arrival',
			'Dune',
			'Hades',
			'Halo',
			'Heat',
			'Undated',
		]);
	});
});

describe('helpers', () => {
	it('lists game platforms, most common first', () => {
		const games = [
			item('A', { type: 'game', platforms: ['PC', 'Switch'] }),
			item('B', { type: 'game', platforms: ['PC'] }),
			item('C', { platforms: ['Ignored'] }),
		];
		expect(platformOptions(games)).toEqual(['PC', 'Switch']);
	});

	it('counts active sheet filters, ignoring type', () => {
		expect(countSheetFilters(filters({ types: ['film'] }))).toBe(0);
		expect(
			countSheetFilters(
				filters({ yearFrom: 2000, yearTo: 2009, sort: 'title', platforms: ['PC'] }),
			),
		).toBe(3);
	});

	it('builds year presets around the current year', () => {
		const presets = yearPresets(new Date('2026-06-01'));
		expect(presets[0]).toMatchObject({ label: 'This year', from: 2026, to: 2026 });
		expect(presets.at(-1)).toMatchObject({ label: 'Older', to: 1999 });
	});
});
