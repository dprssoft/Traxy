// Flashpoint Archive — public Flashpoint Database search API, no API key required.
// Same backend as https://flashpointproject.github.io/flashpoint-database/
//
// Searches return Flash, HTML5, Shockwave, and other preserved browser-game entries.
// We restrict to library=arcade to exclude the theatre (animation) library.

import type { SearchResult } from '$lib/types/mediaTypes';
import { withCache } from '../fetchUtils';
import { hasAdultKeywords } from '$lib/utils/contentFilter';

const API_BASE = 'https://db-api.unstable.life/search';
const IMAGE_BASE = 'https://infinity.unstable.life/Flashpoint/Data/Images';
// Fields fetched for search results; the description is left out to keep large result sets light.
const SEARCH_FIELDS = 'id,title,alternateTitles,developer,publisher,platform,releaseDate,tags';
// The API returns matches in id order, not by relevance — fetch a wide set and rank locally.
const SEARCH_FETCH_LIMIT = 1000;
const SEARCH_RESULT_LIMIT = 20;
// Flashpoint tags that mark adult entries (the API's own `filter=true` hides these server-side).
const ADULT_TAGS = new Set(['Adult', 'Sexual Content', 'Nudity']);

// ── Raw API types ─────────────────────────────────────────────────────────────

interface FpGame {
	id: string;
	title: string;
	alternateTitles?: string;
	developer?: string;
	publisher?: string;
	platform?: string;
	releaseDate?: string;
	originalDescription?: string;
	tags?: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function releaseYear(dateStr?: string): number | undefined {
	if (!dateStr) return undefined;
	const match = dateStr.match(/^(\d{4})/);
	return match ? parseInt(match[1]) : undefined;
}

function posterUrl(id: string): string {
	return `${IMAGE_BASE}/Logos/${id.slice(0, 2)}/${id.slice(2, 4)}/${id}.png`;
}

function splitList(str?: string): string[] {
	if (!str) return [];
	return str
		.split(';')
		.map((s) => s.trim())
		.filter(Boolean);
}

/** Lower is better: exact title, then prefix, then word-prefix, then any other match. */
function relevance(g: FpGame, q: string): number {
	const title = g.title.toLowerCase();
	if (title === q) return 0;
	if (title.startsWith(q)) return 1;
	if (title.split(/\W+/).some((w) => w.startsWith(q))) return 2;
	return 3;
}

function isAdultGame(g: FpGame): boolean {
	const tags = g.tags ?? [];
	return tags.some((t) => ADULT_TAGS.has(t)) || hasAdultKeywords(g.title, ...tags);
}

function mapGame(g: FpGame): SearchResult {
	return {
		externalId: g.id,
		source: 'flashpoint',
		type: 'game',
		title: g.title,
		originalTitle: g.alternateTitles || undefined,
		year: releaseYear(g.releaseDate),
		description: g.originalDescription || undefined,
		posterUrl: posterUrl(g.id),
		author: [g.developer, g.publisher].filter(Boolean).join(' / ') || undefined,
		platforms: splitList(g.platform),
		genres: (g.tags ?? []).filter((t) => t !== 'Auto-zipped'),
		isAdult: isAdultGame(g),
	};
}

// ── Exports ───────────────────────────────────────────────────────────────────

/**
 * Search the Flashpoint Archive for games matching `query`.
 * Only returns arcade-library entries (excludes animations/theatre), ranked by title match.
 */
export async function searchFlashpoint(query: string): Promise<SearchResult[]> {
	if (!query.trim()) return [];

	try {
		return await withCache(`flashpoint:v2:search:${query.toLowerCase()}`, async () => {
			const url = new URL(API_BASE);
			url.searchParams.set('title', query.trim());
			url.searchParams.set('library', 'arcade');
			// Unfiltered: adult entries are flagged via `isAdult` and hidden by the content filter.
			url.searchParams.set('filter', 'false');
			url.searchParams.set('fields', SEARCH_FIELDS);
			url.searchParams.set('limit', String(SEARCH_FETCH_LIMIT));

			const res = await fetch(url.toString());
			if (!res.ok) throw new Error(`Flashpoint API error: HTTP ${res.status}`);

			const games: FpGame[] = await res.json();
			const q = query.trim().toLowerCase();
			const ranked = games
				.map((g) => ({ g, rank: relevance(g, q) }))
				.sort((a, b) => a.rank - b.rank || a.g.title.localeCompare(b.g.title))
				.map(({ g }) => mapGame(g));
			// Keep adult entries in their ranked place, but still fill SEARCH_RESULT_LIMIT
			// non-adult slots so hiding them doesn't leave the list short.
			const results: SearchResult[] = [];
			let safe = 0;
			for (const r of ranked) {
				if (safe >= SEARCH_RESULT_LIMIT) break;
				results.push(r);
				if (!r.isAdult) safe++;
			}
			return results;
		});
	} catch (err) {
		console.error('[flashpoint] search failed', err);
		return [];
	}
}

/**
 * Fetch full details for a single Flashpoint entry by UUID.
 */
export async function getFlashpointDetails(id: string): Promise<SearchResult | null> {
	try {
		return await withCache(`flashpoint:v2:detail:${id}`, async () => {
			const url = `${API_BASE}?id=${encodeURIComponent(id)}`;
			const res = await fetch(url);
			if (!res.ok) throw new Error(`Flashpoint detail error: HTTP ${res.status}`);

			const [g]: FpGame[] = await res.json();
			if (!g) throw new Error(`Flashpoint entry not found: ${id}`);
			return mapGame(g);
		});
	} catch (err) {
		console.error('[flashpoint] detail fetch failed', err);
		return null;
	}
}
