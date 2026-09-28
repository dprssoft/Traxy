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

/** Type filters offered by the search UI; 'comic' also covers manga, manhwa and manhua. */
export const SEARCH_TYPES: SearchType[] = ['all', 'film', 'tv', 'game', 'anime', 'book', 'comic'];

const COMIC_TYPES = ['manga', 'manhwa', 'manhua', 'comic'];

/**
 * Query every provider that can return `type` in parallel, merge cross-provider duplicates and
 * keep only results of that type. A failing provider is logged and skipped.
 */
export async function searchAll(
	query: string,
	type: SearchType,
	prefs: SearchPrefs,
): Promise<SearchResult[]> {
	const q = query.trim();
	if (!q) return [];
	const t = type;
	const promises: Promise<SearchResult[]>[] = [];

	// Always include AniList when the filter could include anime or manga,
	// so the deduplicator has enough context to suppress TMDB/OL duplicates.
	if (t === 'all' || t === 'film' || t === 'tv') promises.push(searchTmdb(q));
	if (t === 'all' || t === 'game') promises.push(searchIgdb(q));
	if ((t === 'all' || t === 'game') && prefs.flashpointEnabled) promises.push(searchFlashpoint(q));
	if (t === 'all' || t === 'anime' || t === 'tv') promises.push(searchAnilist(q, 'ANIME'));
	if (t === 'all' || t === 'comic' || t === 'book') promises.push(searchAnilist(q, 'MANGA'));
	if (t === 'all' || t === 'comic') promises.push(searchComicVine(q));
	if (t === 'all' || t === 'book') promises.push(searchOpenLibrary(q));

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

	if (t === 'all') return deduped;
	if (t === 'comic') return deduped.filter((r) => COMIC_TYPES.includes(r.type));
	return deduped.filter((r) => r.type === t);
}
