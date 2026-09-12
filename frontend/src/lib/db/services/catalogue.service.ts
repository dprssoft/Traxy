/**
 * Catalogue discovery service — orchestrates fetching media items
 * from various source adapters by category and media type.
 */
import type { SearchResult } from '$lib/types/mediaTypes';
import type { MediaType } from '$lib/db/schema';
import { getCached, getCachedBatch } from '../apiCache';

// In-memory cache for fast catalogue navigation
interface MemoryCacheEntry {
	data: SearchResult[];
	timestamp: number;
}
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const memoryCache = new Map<string, MemoryCacheEntry>();

function getMemoryCacheKey(type: MediaType | 'all', category: DiscoverCategory): string {
	return `${type}:${category}`;
}

export function getMemoryCacheBatch(
	type: MediaType | 'all',
	categories: DiscoverCategory[]
): Partial<Record<DiscoverCategory, SearchResult[]>> {
	const result: Partial<Record<DiscoverCategory, SearchResult[]>> = {};
	const now = Date.now();
	for (const cat of categories) {
		const key = getMemoryCacheKey(type, cat);
		const entry = memoryCache.get(key);
		if (entry && now - entry.timestamp < CACHE_TTL) {
			result[cat] = entry.data;
		}
	}
	return result;
}

export function setMemoryCache(
	type: MediaType | 'all',
	category: DiscoverCategory,
	data: SearchResult[]
) {
	memoryCache.set(getMemoryCacheKey(type, category), {
		data,
		timestamp: Date.now()
	});
}

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
	discoverIgdbRandom,
} from '$lib/db/sources/rawg';

// OpenLibrary
import {
	discoverOpenLibraryTrending,
	discoverOpenLibraryNew,
	discoverOpenLibraryTopRated,
	discoverOpenLibraryRandom,
} from '$lib/db/sources/openlibrary';

// ComicVine
import {
	discoverComicVineNew,
	discoverComicVineTrending,
	discoverComicVineTopRated,
	discoverComicVineRandom,
} from '$lib/db/sources/comicvine';

import { getDb } from '../index';
import type { LocalMedia } from '$lib/types/mediaTypes';

export type DiscoverCategory = 'trending' | 'new' | 'top_rated' | 'random' | 'visited';

export interface CategoryDefinition {
	id: DiscoverCategory;
	label: string;
	icon: string;
}

export const CATEGORIES: CategoryDefinition[] = [
	{ id: 'trending', label: 'Trending', icon: '🔥' },
	{ id: 'new', label: 'New Releases', icon: '✨' },
	{ id: 'top_rated', label: 'Top Rated', icon: '⭐' },
	{ id: 'random', label: 'Random', icon: '🎲' },
	{ id: 'visited', label: 'Visited Earlier', icon: '🕒' },
];

const VISITED_MEDIA_KEY = 'traxy:visited_media';

/**
 * Persist a recently visited media item into history.
 */
export function recordVisitedMedia(item: SearchResult | LocalMedia): void {
	if (typeof window === 'undefined' || !item || !item.title) return;
	try {
		const raw = localStorage.getItem(VISITED_MEDIA_KEY);
		let list: SearchResult[] = raw ? JSON.parse(raw) : [];
		// Deduplicate
		list = list.filter(
			(x) => !(x.source === item.source && x.externalId === item.externalId) && x.title !== item.title,
		);
		const entry: SearchResult = {
			source: item.source,
			externalId: item.externalId,
			type: item.type,
			title: item.title,
			year: item.year,
			posterUrl: item.posterUrl,
			description: item.description,
			totalEpisodes: item.totalEpisodes,
			totalSeasons: item.totalSeasons,
			totalPages: item.totalPages,
		};
		list.unshift(entry);
		if (list.length > 30) list = list.slice(0, 30);
		localStorage.setItem(VISITED_MEDIA_KEY, JSON.stringify(list));
	} catch (e) {
		console.warn('Failed to record visited media', e);
	}
}

/**
 * Retrieve visited media items, falling back to recent local records if empty.
 */
export async function getVisitedMedia(type: MediaType | 'all' = 'all'): Promise<SearchResult[]> {
	let results: SearchResult[] = [];
	if (typeof window !== 'undefined') {
		try {
			const raw = localStorage.getItem(VISITED_MEDIA_KEY);
			if (raw) {
				const parsed = JSON.parse(raw) as SearchResult[];
				if (Array.isArray(parsed)) {
					results = parsed;
				}
			}
		} catch (e) {
			console.warn('Failed to load visited media from localStorage', e);
		}
	}

	// If no visited media recorded yet, fallback to recently added media in local DB
	if (results.length === 0) {
		try {
			const db = getDb();
			if (db) {
				const queryResult = await db.query('SELECT * FROM Media ORDER BY rowid DESC LIMIT 20');
				if (queryResult?.values && queryResult.values.length > 0) {
					results = queryResult.values.map((row: unknown) => {
						const isArr = Array.isArray(row);
						const arr = isArr ? (row as unknown[]) : [];
						const obj = !isArr && typeof row === 'object' && row !== null ? (row as Record<string, unknown>) : {};

						const source = (isArr ? (arr[1] as string) : (obj.source as string)) || 'manual';
						const externalId = (isArr ? (arr[2] as string) : (obj.externalId as string)) || (isArr ? (arr[0] as string) : (obj.id as string)) || '';
						const type = (isArr ? (arr[3] as MediaType) : (obj.type as MediaType)) || 'film';
						const title = (isArr ? (arr[4] as string) : (obj.title as string)) || '';
						const year = isArr ? (arr[5] as number | undefined) : (obj.year as number | undefined);
						const posterUrl = isArr ? (arr[6] as string | undefined) : (obj.posterUrl as string | undefined);
						const description = isArr ? (arr[7] as string | undefined) : (obj.description as string | undefined);
						const totalEpisodes = isArr ? (arr[8] as number | undefined) : (obj.totalEpisodes as number | undefined);
						const totalSeasons = isArr ? (arr[9] as number | undefined) : (obj.totalSeasons as number | undefined);
						const totalPages = isArr ? (arr[11] as number | undefined) : (obj.totalPages as number | undefined);

						return {
							source: source as SearchResult['source'],
							externalId,
							type,
							title,
							year,
							posterUrl,
							description,
							totalEpisodes,
							totalSeasons,
							totalPages,
						} as SearchResult;
					});
				}
			}
		} catch {
			// DB might not be initialized or query failed
		}
	}

	if (type !== 'all') {
		results = results.filter((item) => item.type === type);
	}

	return results;
}

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
 * Build the set of SQLite cache keys for a given type + category.
 * Returns an empty array for categories that are never cached.
 */
function getCacheKeysForTypeAndCategory(
	type: MediaType | 'all',
	category: DiscoverCategory,
): string[] {
	if (category === 'visited' || category === 'random') return [];

	if (type === 'all') {
		const anilistSort =
			category === 'trending' ? 'TRENDING_DESC' : category === 'new' ? 'START_DATE_DESC' : 'SCORE_DESC';
		const anilistStatus = category === 'new' ? 'RELEASING' : 'any';
		return [
			`tmdb:${category}:film:en-US:1`,
			`tmdb:${category}:tv:en-US:1`,
			`anilist:discover:ANIME:${anilistSort}:${anilistStatus}:1`,
			`igdb:discover:${category}`,
			`openlibrary:discover:${category}`,
			`comicvine:discover:${category === 'new' ? 'new' : 'trending'}`,
		];
	}

	switch (type) {
		case 'film':
		case 'tv':
			return [`tmdb:${category}:${type}:en-US:1`];
		case 'anime':
		case 'manga':
		case 'manhwa':
		case 'manhua': {
			const aniType = toAnilistMediaType(type);
			if (!aniType) return [];
			const sort =
				category === 'trending' ? 'TRENDING_DESC' : category === 'new' ? 'START_DATE_DESC' : 'SCORE_DESC';
			const status = category === 'new' ? 'RELEASING' : 'any';
			return [`anilist:discover:${aniType}:${sort}:${status}:1`];
		}
		case 'game':
			return [`igdb:discover:${category}`];
		case 'book':
			return [`openlibrary:discover:${category}`];
		case 'comic':
			return [`comicvine:discover:${category === 'new' ? 'new' : 'trending'}`];
		default:
			return [];
	}
}

/**
 * Fast-path: reads cache for a single category. Kept for backwards compat.
 */
export async function getCatalogueFromCache(
	type: MediaType | 'all',
	category: DiscoverCategory,
): Promise<SearchResult[] | null> {
	if (category === 'visited' || category === 'random') return null;
	const keys = getCacheKeysForTypeAndCategory(type, category);
	if (keys.length === 0) return null;
	const batch = await getCachedBatch<SearchResult[]>(keys);
	const hits = keys.map((k) => batch.get(k)).filter((v): v is SearchResult[] => v != null && v.length > 0);
	if (hits.length === 0) return null;
	if (type === 'all') return interleaveBySource(hits.flat());
	return hits[0];
}

/**
 * Batch fast-path: warms all requested categories from SQLite in a SINGLE query.
 * Returns a map of category → results (only categories with cache hits are present).
 * Use this on page mount to avoid N separate round-trips.
 */
export async function getCatalogueCacheBatch(
	type: MediaType | 'all',
	categories: DiscoverCategory[],
): Promise<Partial<Record<DiscoverCategory, SearchResult[]>>> {
	// Collect all cache keys across all categories
	const keysByCat = new Map<DiscoverCategory, string[]>();
	const allKeys: string[] = [];
	for (const cat of categories) {
		const keys = getCacheKeysForTypeAndCategory(type, cat);
		if (keys.length > 0) {
			keysByCat.set(cat, keys);
			allKeys.push(...keys);
		}
	}

	if (allKeys.length === 0) return {};

	// Single DB round-trip for all keys
	const batch = await getCachedBatch<SearchResult[]>(allKeys);

	const out: Partial<Record<DiscoverCategory, SearchResult[]>> = {};
	for (const [cat, keys] of keysByCat) {
		const hits = keys.map((k) => batch.get(k)).filter((v): v is SearchResult[] => v != null && v.length > 0);
		if (hits.length === 0) continue;
		out[cat] = type === 'all' ? interleaveBySource(hits.flat()) : hits[0];
	}
	return out;
}

/**
 * Fetches discovery results for a given media type and category.
 * Returns empty array if the source doesn't support that category.
 */
export async function discoverMedia(
	type: MediaType | 'all',
	category: DiscoverCategory,
	forceRefresh = false,
): Promise<SearchResult[]> {
	if (forceRefresh) {
		memoryCache.delete(getMemoryCacheKey(type, category));
	} else {
		const mem = memoryCache.get(getMemoryCacheKey(type, category));
		if (mem && Date.now() - mem.timestamp < CACHE_TTL) {
			return mem.data;
		}
	}

	let result: SearchResult[];

	if (category === 'visited') {
		result = await getVisitedMedia(type);
	} else if (type === 'all') {
		result = await discoverAll(category, forceRefresh);
	} else {
		switch (type) {
			case 'film':
			case 'tv':
				result = await discoverTmdbByCategory(type, category, forceRefresh);
				break;
			case 'anime':
			case 'manga':
			case 'manhwa':
			case 'manhua':
				result = await discoverAnilistByCategory(type, category, forceRefresh);
				break;
			case 'game':
				result = await discoverIgdbByCategory(category, forceRefresh);
				break;
			case 'book':
				result = await discoverOpenLibraryByCategory(category, forceRefresh);
				break;
			case 'comic':
				result = await discoverComicByCategory(category, forceRefresh);
				break;
			default:
				result = [];
		}
	}

	if (result.length > 0 || category === 'visited') {
		setMemoryCache(type, category, result);
	}

	return result;
}

/**
 * Run up to `limit` async tasks concurrently from `fns`, resolving when all finish.
 * Avoids saturating the browser's per-host connection pool (max 6).
 */
async function pooled<T>(fns: (() => Promise<T>)[], limit = 4): Promise<PromiseSettledResult<T>[]> {
	const results: PromiseSettledResult<T>[] = [];
	const queue = [...fns];

	async function run() {
		while (queue.length > 0) {
			const fn = queue.shift()!;
			try {
				results.push({ status: 'fulfilled', value: await fn() });
			} catch (reason) {
				results.push({ status: 'rejected', reason });
			}
		}
	}

	const workers = Array.from({ length: Math.min(limit, fns.length) }, run);
	await Promise.all(workers);
	return results;
}

/** When "All" is selected, fetch from all major sources and merge — max 4 concurrent. */
async function discoverAll(category: DiscoverCategory, forceRefresh = false): Promise<SearchResult[]> {
	const fns: (() => Promise<SearchResult[]>)[] = [
		() => discoverTmdbByCategory('film', category, forceRefresh),
		() => discoverTmdbByCategory('tv', category, forceRefresh),
		() => discoverAnilistByCategory('anime', category, forceRefresh),
		() => discoverIgdbByCategory(category, forceRefresh),
		() => discoverOpenLibraryByCategory(category, forceRefresh),
		() => discoverComicByCategory(category, forceRefresh),
	];

	const settled = await pooled(fns, 4);
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
	forceRefresh = false,
): Promise<SearchResult[]> {
	switch (category) {
		case 'trending':
			return discoverTmdbTrending(type, 'en-US', 1, forceRefresh);
		case 'new':
			return discoverTmdbNew(type, 'en-US', 1, forceRefresh);
		case 'top_rated':
			return discoverTmdbTopRated(type, 'en-US', 1, forceRefresh);
		case 'random':
			// Random page from trending
			return discoverTmdbTrending(type, 'en-US', Math.floor(Math.random() * 5) + 1, forceRefresh);
		default:
			return Promise.resolve([]);
	}
}

function discoverAnilistByCategory(
	type: MediaType,
	category: DiscoverCategory,
	forceRefresh = false,
): Promise<SearchResult[]> {
	const aniType = toAnilistMediaType(type);
	if (!aniType) return Promise.resolve([]);

	switch (category) {
		case 'trending':
			return discoverAnilistTrending(aniType, 1, forceRefresh);
		case 'new':
			return discoverAnilistNew(aniType, 1, forceRefresh);
		case 'top_rated':
			return discoverAnilistTopRated(aniType, 1, forceRefresh);
		case 'random':
			return discoverAnilistRandom(aniType);
		default:
			return Promise.resolve([]);
	}
}

function discoverIgdbByCategory(category: DiscoverCategory, forceRefresh = false): Promise<SearchResult[]> {
	switch (category) {
		case 'trending':
			return discoverIgdbTrending(forceRefresh);
		case 'new':
			return discoverIgdbNew(forceRefresh);
		case 'top_rated':
			return discoverIgdbTopRated(forceRefresh);
		case 'random':
			return discoverIgdbRandom();
		default:
			return Promise.resolve([]);
	}
}

function discoverOpenLibraryByCategory(category: DiscoverCategory, forceRefresh = false): Promise<SearchResult[]> {
	switch (category) {
		case 'trending':
			return discoverOpenLibraryTrending(forceRefresh);
		case 'new':
			return discoverOpenLibraryNew(forceRefresh);
		case 'top_rated':
			return discoverOpenLibraryTopRated(forceRefresh);
		case 'random':
			return discoverOpenLibraryRandom();
		default:
			return Promise.resolve([]);
	}
}

function discoverComicByCategory(category: DiscoverCategory, forceRefresh = false): Promise<SearchResult[]> {
	switch (category) {
		case 'trending':
			return discoverComicVineTrending(forceRefresh);
		case 'new':
			return discoverComicVineNew(forceRefresh);
		case 'top_rated':
			return discoverComicVineTopRated(forceRefresh);
		case 'random':
			return discoverComicVineRandom();
		default:
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
