import type { SearchResult } from '$lib/types/mediaTypes';
import { setCache } from '../apiCache';
import { withCache, fetchJson } from '../fetchUtils';
import { hasAdultKeywords } from '$lib/utils/contentFilter';

const BASE_URL = 'https://openlibrary.org';
const IMAGE_BASE = 'https://covers.openlibrary.org/b/id';
// Down from the original 15s — long enough for OpenLibrary's public API without holding up
// a whole catalogue category row as long as the old timeout did.
const OPENLIBRARY_TIMEOUT_MS = 8000;
// search.json only returns `subject` when asked for it explicitly.
const SEARCH_FIELDS = 'key,title,first_publish_year,cover_i,subject';

/** Open Library has no adult flag — fall back to keywords in the subject tags. */
function subjectsAreAdult(subjects?: string[]): boolean {
	return hasAdultKeywords(...(subjects ?? []));
}

/** Search books. No key needed. Empty on error. */
export async function searchOpenLibrary(query: string): Promise<SearchResult[]> {
	if (!query.trim()) return [];

	const cacheKey = `openlibrary:search:${query}`;
	try {
		return await withCache(cacheKey, async () => {
			const data = await fetchJson<{ docs: unknown[] }>(
				`${BASE_URL}/search.json?q=${encodeURIComponent(query)}&limit=10&fields=${SEARCH_FIELDS}`,
				OPENLIBRARY_TIMEOUT_MS,
			);

			return data.docs.map((item: any) => ({
				externalId: item.key, // e.g. /works/OL82563W
				source: 'openlibrary',
				type: 'book',
				title: item.title,
				year: item.first_publish_year,
				posterUrl: item.cover_i ? `${IMAGE_BASE}/${item.cover_i}-M.jpg` : undefined,
				isAdult: subjectsAreAdult(item.subject),
				// authors: item.author_name ? item.author_name.join(', ') : undefined, // future enhancement
			}));
		});
	} catch {
		return [];
	}
}

interface OpenLibraryWorkDetail {
	key: string;
	title: string;
	first_publish_date?: string;
	covers?: number[];
	description?: string | { value?: string };
	subjects?: string[];
}

/** Full work details; `id` is the full work key, e.g. `/works/OL82563W`. Null on error. */
export async function getOpenLibraryDetails(id: string): Promise<SearchResult | null> {
	// id is expected to be the full key, e.g. "/works/OL82563W"
	const cacheKey = `openlibrary:detail:${id}`;
	try {
		return await withCache(cacheKey, async () => {
			const item = await fetchJson<OpenLibraryWorkDetail>(`${BASE_URL}${id}.json`, OPENLIBRARY_TIMEOUT_MS);

			const description = typeof item.description === 'string'
				? item.description
				: item.description?.value;

			const result: SearchResult = {
				externalId: item.key,
				source: 'openlibrary',
				type: 'book',
				title: item.title,
				year: item.first_publish_date ? parseInt(item.first_publish_date.split(' ')[2] || item.first_publish_date) : undefined,
				posterUrl: item.covers && item.covers.length > 0 ? `${IMAGE_BASE}/${item.covers[0]}-M.jpg` : undefined,
				description: description || undefined,
				isAdult: subjectsAreAdult(item.subjects),
			};

			return result;
		});
	} catch {
		return null;
	}
}

// ── Discovery / Catalogue endpoints ──────────────────────────────────────────

/** Trending books from OpenLibrary's daily trending endpoint. */
export async function discoverOpenLibraryTrending(forceRefresh = false): Promise<SearchResult[]> {
	const cacheKey = 'openlibrary:discover:trending';
	const fetcher = async (): Promise<SearchResult[]> => {
		const data = await fetchJson<{ works?: unknown[] }>(
			`${BASE_URL}/trending/daily.json?limit=20`,
			OPENLIBRARY_TIMEOUT_MS,
		);

		return (data.works ?? []).map((item: any) => ({
			externalId: item.key, // e.g. /works/OL82563W
			source: 'openlibrary' as const,
			type: 'book' as const,
			title: item.title,
			year: item.first_publish_year,
			posterUrl: item.cover_i ? `${IMAGE_BASE}/${item.cover_i}-M.jpg` : undefined,
		}));
	};

	try {
		if (forceRefresh) {
			const result = await fetcher();
			await setCache(cacheKey, result);
			return result;
		}
		return await withCache(cacheKey, fetcher);
	} catch {
		return [];
	}
}

/** Newly added books sorted by new. */
export async function discoverOpenLibraryNew(forceRefresh = false): Promise<SearchResult[]> {
	const cacheKey = 'openlibrary:discover:new';
	const fetcher = async (): Promise<SearchResult[]> => {
		const data = await fetchJson<{ docs: unknown[] }>(
			`${BASE_URL}/search.json?sort=new&limit=20&has_fulltext=false&fields=${SEARCH_FIELDS}`,
			OPENLIBRARY_TIMEOUT_MS,
		);

		return data.docs.map((item: any) => ({
			externalId: item.key,
			source: 'openlibrary' as const,
			type: 'book' as const,
			title: item.title,
			year: item.first_publish_year,
			posterUrl: item.cover_i ? `${IMAGE_BASE}/${item.cover_i}-M.jpg` : undefined,
			isAdult: subjectsAreAdult(item.subject),
		}));
	};

	try {
		if (forceRefresh) {
			const result = await fetcher();
			await setCache(cacheKey, result);
			return result;
		}
		return await withCache(cacheKey, fetcher);
	} catch {
		return [];
	}
}

/**
 * Proxy for Top Rated: OpenLibrary yearly trending books.
 * This gives a popularity-ranked list that serves as a reasonable "top rated" proxy.
 */
export async function discoverOpenLibraryTopRated(forceRefresh = false): Promise<SearchResult[]> {
	const cacheKey = 'openlibrary:discover:top_rated';
	const fetcher = async (): Promise<SearchResult[]> => {
		const data = await fetchJson<{ works?: unknown[] }>(
			`${BASE_URL}/trending/yearly.json?limit=20`,
			OPENLIBRARY_TIMEOUT_MS,
		);

		return (data.works ?? []).map((item: any) => ({
			externalId: item.key,
			source: 'openlibrary' as const,
			type: 'book' as const,
			title: item.title,
			year: item.first_publish_year,
			posterUrl: item.cover_i ? `${IMAGE_BASE}/${item.cover_i}-M.jpg` : undefined,
		}));
	};

	try {
		if (forceRefresh) {
			const result = await fetcher();
			await setCache(cacheKey, result);
			return result;
		}
		return await withCache(cacheKey, fetcher);
	} catch {
		return [];
	}
}

/**
 * Random books: fetch trending with a random page offset.
 */
export async function discoverOpenLibraryRandom(): Promise<SearchResult[]> {
	// Offset logic: OpenLibrary uses `page` for pagination.
	const randomPage = Math.floor(Math.random() * 50) + 1;

	try {
		const data = await fetchJson<{ works?: unknown[] }>(
			`${BASE_URL}/trending/daily.json?limit=20&page=${randomPage}`,
			OPENLIBRARY_TIMEOUT_MS,
		);

		const results: SearchResult[] = (data.works ?? []).map((item: any) => ({
			externalId: item.key,
			source: 'openlibrary' as const,
			type: 'book' as const,
			title: item.title,
			year: item.first_publish_year,
			posterUrl: item.cover_i ? `${IMAGE_BASE}/${item.cover_i}-M.jpg` : undefined,
		}));

		// Shuffle results
		for (let i = results.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[results[i], results[j]] = [results[j], results[i]];
		}

		return results;
	} catch {
		return [];
	}
}
