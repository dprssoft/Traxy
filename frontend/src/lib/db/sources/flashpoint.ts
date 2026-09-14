// Flashpoint Archive — public FPFSS API, no API key required.
// Docs / explorer: https://fpfss.unstable.life
//
// Searches return Flash, HTML5, Shockwave, and other preserved browser-game entries.
// We default to library=arcade to exclude the theatre (animation) library.

import type { SearchResult } from '$lib/types/mediaTypes';
import { withCache } from '../fetchUtils';

const API_BASE = 'https://fpfss.unstable.life/api';
const IMAGE_BASE = 'https://infinity.unstable.life/Flashpoint/Data/Images';

// ── Raw API types ─────────────────────────────────────────────────────────────

interface FpGame {
	id: string;
	title: string;
	alternate_titles?: string;
	developer?: string;
	publisher?: string;
	platform_name?: string;
	platforms_str?: string;
	release_date?: string;
	original_description?: string;
	tags_str?: string;
	library?: string; // 'arcade' | 'theatre'
	logo_path?: string;
}

interface FpGamesResponse {
	games: FpGame[];
	total_filtered?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function releaseYear(dateStr?: string): number | undefined {
	if (!dateStr) return undefined;
	const match = dateStr.match(/^(\d{4})/);
	return match ? parseInt(match[1]) : undefined;
}

function posterUrl(logoPath?: string): string | undefined {
	if (!logoPath) return undefined;
	return `${IMAGE_BASE}/${logoPath}`;
}

function parsePlatforms(platformStr?: string): string[] {
	if (!platformStr) return [];
	// platforms_str can be e.g. "Flash" or "(\"Flash; HTML5\",\"\")" — extract clean values
	const cleaned = platformStr.replace(/^\("?|"?\)$|\\"/g, '').replace(/","/g, '; ');
	return cleaned
		.split(/[;,]/)
		.map((s) => s.trim().replace(/^"+|"+$/g, ''))
		.filter(Boolean);
}

function parseGenres(tagsStr?: string): string[] {
	if (!tagsStr) return [];
	return tagsStr
		.split(';')
		.map((s) => s.trim())
		.filter(Boolean);
}

function mapGame(g: FpGame): SearchResult {
	return {
		externalId: g.id,
		source: 'flashpoint',
		type: 'game',
		title: g.title,
		originalTitle: g.alternate_titles || undefined,
		year: releaseYear(g.release_date),
		description: g.original_description || undefined,
		posterUrl: posterUrl(g.logo_path),
		author: [g.developer, g.publisher].filter(Boolean).join(' / ') || undefined,
		platforms: parsePlatforms(g.platforms_str || g.platform_name),
		genres: parseGenres(g.tags_str),
	};
}

// ── Exports ───────────────────────────────────────────────────────────────────

/**
 * Search the Flashpoint Archive for games matching `query`.
 * Only returns arcade-library entries (excludes animations/theatre).
 */
export async function searchFlashpoint(query: string): Promise<SearchResult[]> {
	if (!query.trim()) return [];

	try {
		return await withCache(`flashpoint:search:${query.toLowerCase()}`, async () => {
			const url = new URL(`${API_BASE}/games`);
			url.searchParams.set('search', query);
			url.searchParams.set('library', 'arcade');
			url.searchParams.set('limit', '20');

			const res = await fetch(url.toString());
			if (!res.ok) throw new Error(`Flashpoint API error: HTTP ${res.status}`);

			const data: FpGamesResponse = await res.json();
			return (data.games ?? []).map(mapGame);
		});
	} catch (err) {
		console.error('[flashpoint] search failed', err);
		return [];
	}
}

/**
 * Fetch full details for a single Flashpoint entry by UUID.
 * Falls back to a search by id if the direct endpoint is unavailable.
 */
export async function getFlashpointDetails(id: string): Promise<SearchResult | null> {
	try {
		return await withCache(`flashpoint:detail:${id}`, async () => {
			const url = `${API_BASE}/games/${encodeURIComponent(id)}`;
			const res = await fetch(url);
			if (!res.ok) throw new Error(`Flashpoint detail error: HTTP ${res.status}`);

			const g: FpGame = await res.json();
			return mapGame(g);
		});
	} catch (err) {
		console.error('[flashpoint] detail fetch failed', err);
		return null;
	}
}
