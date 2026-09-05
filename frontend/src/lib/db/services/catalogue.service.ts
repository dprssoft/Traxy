/**
 * Catalogue discovery service — orchestrates fetching media items
 * from various source adapters by category and media type.
 */
import type { SearchResult } from '$lib/types/mediaTypes';
import type { MediaType } from '$lib/db/schema';

// TMDB
import {
	discoverTmdbTrending,
	discoverTmdbNew,
	discoverTmdbTopRated,
} from '$lib/db/sources/tmdb';

// AniList
import {
	discoverAnilistTrending,
	discoverAnilistNew,
	discoverAnilistTopRated,
	discoverAnilistRandom,
} from '$lib/db/sources/anilist';

// IGDB
import {
	discoverIgdbTrending,
	discoverIgdbNew,
	discoverIgdbTopRated,
} from '$lib/db/sources/rawg';

// OpenLibrary
import {
	discoverOpenLibraryTrending,
	discoverOpenLibraryNew,
} from '$lib/db/sources/openlibrary';

// ComicVine
import { discoverComicVineNew } from '$lib/db/sources/comicvine';

export type DiscoverCategory = 'new' | 'trending' | 'top_rated' | 'random';

export interface CategoryDefinition {
	id: DiscoverCategory;
	label: string;
	icon: string;
}

export const CATEGORIES: CategoryDefinition[] = [
	{ id: 'trending', label: '🔥 Trending', icon: '🔥' },
	{ id: 'new', label: '✨ New Releases', icon: '✨' },
	{ id: 'top_rated', label: '⭐ Top Rated', icon: '⭐' },
	{ id: 'random', label: '🎲 Random', icon: '🎲' },
];

/**
 * Which media types map to which AniList media type for discovery queries.
 */
function toAnilistMediaType(type: MediaType): 'ANIME' | 'MANGA' | null {
	switch (type) {
		case 'anime':
			return 'ANIME';
		case 'manga':
		case 'manhwa':
		case 'manhua':
			return 'MANGA';
		default:
			return null;
	}
}

/**
 * Fetches discovery results for a given media type and category.
 * Returns empty array if the source doesn't support that category.
 */
export async function discoverMedia(
	type: MediaType | 'all',
	category: DiscoverCategory,
): Promise<SearchResult[]> {
	if (type === 'all') {
		return discoverAll(category);
	}

	switch (type) {
		case 'film':
		case 'tv':
			return discoverTmdbByCategory(type, category);
		case 'anime':
		case 'manga':
		case 'manhwa':
		case 'manhua':
			return discoverAnilistByCategory(type, category);
		case 'game':
			return discoverIgdbByCategory(category);
		case 'book':
			return discoverOpenLibraryByCategory(category);
		case 'comic':
			return discoverComicByCategory(category);
		default:
			return [];
	}
}

/** When "All" is selected, fetch from all major sources in parallel and merge. */
async function discoverAll(category: DiscoverCategory): Promise<SearchResult[]> {
	const promises: Promise<SearchResult[]>[] = [
		discoverTmdbByCategory('film', category),
		discoverTmdbByCategory('tv', category),
		discoverAnilistByCategory('anime', category),
		discoverIgdbByCategory(category),
		discoverOpenLibraryByCategory(category),
	];

	const settled = await Promise.allSettled(promises);
	const results: SearchResult[] = [];
	for (const result of settled) {
		if (result.status === 'fulfilled') {
			results.push(...result.value);
		}
	}

	// Interleave results from different sources for variety
	return interleaveBySource(results);
}

function discoverTmdbByCategory(
	type: 'film' | 'tv',
	category: DiscoverCategory,
): Promise<SearchResult[]> {
	switch (category) {
		case 'trending':
			return discoverTmdbTrending(type);
		case 'new':
			return discoverTmdbNew(type);
		case 'top_rated':
			return discoverTmdbTopRated(type);
		case 'random':
			// Random page from trending
			return discoverTmdbTrending(type, 'en-US', Math.floor(Math.random() * 5) + 1);
		default:
			return Promise.resolve([]);
	}
}

function discoverAnilistByCategory(
	type: MediaType,
	category: DiscoverCategory,
): Promise<SearchResult[]> {
	const aniType = toAnilistMediaType(type);
	if (!aniType) return Promise.resolve([]);

	switch (category) {
		case 'trending':
			return discoverAnilistTrending(aniType);
		case 'new':
			return discoverAnilistNew(aniType);
		case 'top_rated':
			return discoverAnilistTopRated(aniType);
		case 'random':
			return discoverAnilistRandom(aniType);
		default:
			return Promise.resolve([]);
	}
}

function discoverIgdbByCategory(category: DiscoverCategory): Promise<SearchResult[]> {
	switch (category) {
		case 'trending':
			return discoverIgdbTrending();
		case 'new':
			return discoverIgdbNew();
		case 'top_rated':
			return discoverIgdbTopRated();
		case 'random':
			// Reuse trending with some variety
			return discoverIgdbTrending();
		default:
			return Promise.resolve([]);
	}
}

function discoverOpenLibraryByCategory(category: DiscoverCategory): Promise<SearchResult[]> {
	switch (category) {
		case 'trending':
			return discoverOpenLibraryTrending();
		case 'new':
			return discoverOpenLibraryNew();
		default:
			// OpenLibrary doesn't support top_rated or random
			return Promise.resolve([]);
	}
}

function discoverComicByCategory(category: DiscoverCategory): Promise<SearchResult[]> {
	switch (category) {
		case 'new':
			return discoverComicVineNew();
		default:
			// ComicVine only supports new releases discovery
			return Promise.resolve([]);
	}
}

/**
 * Interleave results from different sources so the "All" view
 * shows variety rather than blocks of one source.
 */
function interleaveBySource(items: SearchResult[]): SearchResult[] {
	const buckets = new Map<string, SearchResult[]>();
	for (const item of items) {
		const key = item.source;
		if (!buckets.has(key)) buckets.set(key, []);
		buckets.get(key)!.push(item);
	}

	const result: SearchResult[] = [];
	const iterators = [...buckets.values()].map((b) => ({ items: b, index: 0 }));

	let added = true;
	while (added) {
		added = false;
		for (const it of iterators) {
			if (it.index < it.items.length) {
				result.push(it.items[it.index++]);
				added = true;
			}
		}
	}

	return result;
}
