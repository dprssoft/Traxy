import type { SearchResult } from '$lib/types/mediaTypes';
import { getCached, setCache } from '../apiCache';

const BASE_URL = 'https://openlibrary.org';
const IMAGE_BASE = 'https://covers.openlibrary.org/b/id';

export async function searchOpenLibrary(query: string): Promise<SearchResult[]> {
	if (!query.trim()) return [];

	const cacheKey = `openlibrary:search:${query}`;
	const cached = await getCached<SearchResult[]>(cacheKey);
	if (cached) return cached;

	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 4000);
		const res = await fetch(
			`${BASE_URL}/search.json?q=${encodeURIComponent(query)}&limit=10`,
			{ signal: controller.signal }
		);
		clearTimeout(timeout);
		if (!res.ok) return [];
		const data = await res.json();

		const results: SearchResult[] = data.docs.map((item: any) => ({
			externalId: item.key, // e.g. /works/OL82563W
			source: 'openlibrary',
			type: 'book',
			title: item.title,
			year: item.first_publish_year,
			posterUrl: item.cover_i ? `${IMAGE_BASE}/${item.cover_i}-M.jpg` : undefined,
			// authors: item.author_name ? item.author_name.join(', ') : undefined, // future enhancement
		}));

		await setCache(cacheKey, results);
		return results;
	} catch {
		return [];
	}
}

export async function getOpenLibraryDetails(id: string): Promise<SearchResult | null> {
	// id is expected to be the full key, e.g. "/works/OL82563W"
	const cacheKey = `openlibrary:detail:${id}`;
	const cached = await getCached<SearchResult>(cacheKey);
	if (cached) return cached;

	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 4000);
		const res = await fetch(`${BASE_URL}${id}.json`, { signal: controller.signal });
		clearTimeout(timeout);
		if (!res.ok) return null;
		const item = await res.json();

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
		};

		await setCache(cacheKey, result);
		return result;
	} catch {
		return null;
	}
}
