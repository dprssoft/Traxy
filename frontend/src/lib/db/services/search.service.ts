import { searchTmdb } from '../sources/tmdb';
import { searchIgdb } from '../sources/igdb';
import { searchAnilist } from '../sources/anilist';
import { searchComicVine } from '../sources/comicvine';
import { searchOpenLibrary } from '../sources/openlibrary';
import { searchFlashpoint } from '../sources/flashpoint';
import { deduplicateResults } from '$lib/utils/search-dedup';
import type { SearchPrefs } from './settings.service';
import type { SearchResult } from '$lib/types/mediaTypes';
import type { MediaType } from '../schema';

export type SearchType = MediaType | 'all';

/** Type filters offered by the search bar; 'comic' also covers manga, manhwa and manhua. */
export const SEARCH_TYPES: SearchType[] = ['all', 'film', 'tv', 'game', 'anime', 'book', 'comic'];

/** Every media type a search can return, in display order. */
export const RESULT_TYPES: MediaType[] = [
	'film',
	'tv',
	'anime',
	'game',
	'book',
	'manga',
	'manhwa',
	'manhua',
	'comic',
];

const COMIC_TYPES: MediaType[] = ['manga', 'manhwa', 'manhua', 'comic'];

/** The media types a search-bar filter stands for; empty means every type. */
export function expandSearchType(type: SearchType): MediaType[] {
	if (type === 'all') return [];
	return type === 'comic' ? COMIC_TYPES : [type];
}

/** The search-bar filter matching exactly `types`, or 'all' when none does. */
export function collapseToSearchType(types: MediaType[]): SearchType {
	const key = [...types].sort().join();
	return SEARCH_TYPES.find((t) => [...expandSearchType(t)].sort().join() === key) ?? 'all';
}

/**
 * Query every provider that can return one of `types` (empty = every type) in parallel, merge
 * cross-provider duplicates and keep only results of those types. A failing provider is logged
 * and skipped.
 */
export async function searchAll(
	query: string,
	types: MediaType[],
	prefs: SearchPrefs,
): Promise<SearchResult[]> {
	const q = query.trim();
	if (!q) return [];
	const wanted = (...ts: MediaType[]) => types.length === 0 || ts.some((t) => types.includes(t));
	const promises: Promise<SearchResult[]>[] = [];

	// Always include AniList when the filter could include anime or manga,
	// so the deduplicator has enough context to suppress TMDB/OL duplicates.
	if (wanted('film', 'tv')) promises.push(searchTmdb(q));
	if (wanted('game')) promises.push(searchIgdb(q));
	if (wanted('game') && prefs.flashpointEnabled) promises.push(searchFlashpoint(q));
	if (wanted('anime', 'tv')) promises.push(searchAnilist(q, 'ANIME'));
	if (wanted(...COMIC_TYPES, 'book')) promises.push(searchAnilist(q, 'MANGA'));
	if (wanted('comic')) promises.push(searchComicVine(q));
	if (wanted('book')) promises.push(searchOpenLibrary(q));

	const raw = (
		await Promise.all(
			promises.map((p) =>
				p.catch((e) => {
					console.error(e);
					return [] as SearchResult[];
				}),
			),
		)
	).flat();

	// Deduplicate first on the full raw set so AniList anime/manga entries are
	// present to suppress TMDB/OL/CV duplicates — even when the active filter
	// would later hide the AniList result itself (e.g. user filters by 'tv').
	const deduped = deduplicateResults(raw, prefs);

	return types.length === 0 ? deduped : deduped.filter((r) => types.includes(r.type));
}
