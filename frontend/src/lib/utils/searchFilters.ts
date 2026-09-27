import type { MediaType } from '$lib/db/schema';
import type { SearchResult } from '$lib/types/mediaTypes';

export type SearchSort = 'relevance' | 'newest' | 'oldest' | 'title';
export type LibraryFilter = 'all' | 'tracked' | 'untracked';

/** Everything the results page can narrow or order results by; all of it lives in the URL. */
export interface SearchFilters {
	/** Empty means every type. */
	types: MediaType[];
	yearFrom?: number;
	yearTo?: number;
	sort: SearchSort;
	library: LibraryFilter;
	/** Game platforms; a game matches when it's on any of them. Empty means any platform. */
	platforms: string[];
}

export const DEFAULT_SEARCH_FILTERS: SearchFilters = {
	types: [],
	sort: 'relevance',
	library: 'all',
	platforms: [],
};

const SORTS: SearchSort[] = ['relevance', 'newest', 'oldest', 'title'];
const LIBRARY_FILTERS: LibraryFilter[] = ['all', 'tracked', 'untracked'];

export const SORT_LABELS: Record<SearchSort, string> = {
	relevance: 'Relevance',
	newest: 'Newest',
	oldest: 'Oldest',
	title: 'Title A–Z',
};

export const LIBRARY_LABELS: Record<LibraryFilter, string> = {
	all: 'All',
	tracked: 'In my library',
	untracked: 'Not in my library',
};

export interface YearPreset {
	id: string;
	label: string;
	from?: number;
	to?: number;
}

/** Quick year ranges; `now` is injectable for tests. */
export function yearPresets(now = new Date()): YearPreset[] {
	const year = now.getFullYear();
	return [
		{ id: 'this-year', label: 'This year', from: year, to: year },
		{ id: '2020s', label: '2020s', from: 2020, to: 2029 },
		{ id: '2010s', label: '2010s', from: 2010, to: 2019 },
		{ id: '2000s', label: '2000s', from: 2000, to: 2009 },
		{ id: 'older', label: 'Older', to: 1999 },
	];
}

function parseYear(value: string | null): number | undefined {
	if (!value) return undefined;
	const year = Number(value);
	return Number.isInteger(year) && year > 0 && year < 10000 ? year : undefined;
}

/** Read the filters from the results page URL, dropping anything unknown or malformed. */
export function parseSearchFilters(
	params: URLSearchParams,
	validTypes: MediaType[],
): SearchFilters {
	const sort = params.get('sort') as SearchSort | null;
	const library = params.get('lib') as LibraryFilter | null;
	return {
		types: [...new Set(params.getAll('type'))].filter((t): t is MediaType =>
			validTypes.includes(t as MediaType),
		),
		yearFrom: parseYear(params.get('from')),
		yearTo: parseYear(params.get('to')),
		sort: sort && SORTS.includes(sort) ? sort : 'relevance',
		library: library && LIBRARY_FILTERS.includes(library) ? library : 'all',
		platforms: [...new Set(params.getAll('platform').filter(Boolean))],
	};
}

/** Query string for the results page; default filters are left out to keep URLs short. */
export function searchFiltersParams(
	query: string,
	filters: Partial<SearchFilters> = {},
): `?${string}` {
	const params = new URLSearchParams({ q: query });
	for (const type of filters.types ?? []) params.append('type', type);
	if (filters.yearFrom !== undefined) params.set('from', String(filters.yearFrom));
	if (filters.yearTo !== undefined) params.set('to', String(filters.yearTo));
	if (filters.sort && filters.sort !== 'relevance') params.set('sort', filters.sort);
	if (filters.library && filters.library !== 'all') params.set('lib', filters.library);
	for (const platform of filters.platforms ?? []) params.append('platform', platform);
	return `?${params}`;
}

/** How many sheet filters (everything but type) differ from the defaults. */
export function countSheetFilters(filters: SearchFilters): number {
	return (
		(filters.yearFrom !== undefined || filters.yearTo !== undefined ? 1 : 0) +
		(filters.sort !== 'relevance' ? 1 : 0) +
		(filters.library !== 'all' ? 1 : 0) +
		(filters.platforms.length > 0 ? 1 : 0)
	);
}

export const resultKey = (item: Pick<SearchResult, 'source' | 'externalId'>) =>
	`${item.source}:${item.externalId}`;

/**
 * Narrow and order search results. Types are already applied by the search itself; this handles
 * year range (results without a year drop out while it's set), library membership, game
 * platforms (non-game results are unaffected) and sort. Relevance keeps the providers' order.
 */
export function applySearchFilters(
	results: SearchResult[],
	filters: SearchFilters,
	trackedKeys: Set<string>,
): SearchResult[] {
	const { yearFrom, yearTo, library, platforms, sort } = filters;
	const filtered = results.filter((r) => {
		if (yearFrom !== undefined || yearTo !== undefined) {
			if (r.year === undefined) return false;
			if (yearFrom !== undefined && r.year < yearFrom) return false;
			if (yearTo !== undefined && r.year > yearTo) return false;
		}
		if (library !== 'all' && trackedKeys.has(resultKey(r)) !== (library === 'tracked')) {
			return false;
		}
		if (platforms.length > 0 && r.type === 'game') {
			if (!r.platforms?.some((p) => platforms.includes(p))) return false;
		}
		return true;
	});

	if (sort === 'relevance') return filtered;
	const byYear = (a: SearchResult, b: SearchResult, dir: 1 | -1) => {
		if (a.year === b.year) return 0;
		if (a.year === undefined) return 1;
		if (b.year === undefined) return -1;
		return (a.year - b.year) * dir;
	};
	return [...filtered].sort((a, b) => {
		if (sort === 'newest') return byYear(a, b, -1);
		if (sort === 'oldest') return byYear(a, b, 1);
		return a.title.localeCompare(b.title);
	});
}

/** Platforms of the game results, most common first, for the platform filter. */
export function platformOptions(results: SearchResult[]): string[] {
	const counts = new Map<string, number>();
	for (const r of results) {
		if (r.type !== 'game') continue;
		for (const p of r.platforms ?? []) counts.set(p, (counts.get(p) ?? 0) + 1);
	}
	return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([p]) => p);
}
