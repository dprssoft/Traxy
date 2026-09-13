// IGDB (Internet Game Database) — free, requires Twitch developer credentials.
// Sign up at: https://dev.twitch.tv/console → Create a new application.
//
// Note: IGDB API blocks CORS in browser context.
// Capacitor bypasses this natively. For web dev, a proxy is needed.
import type { SearchResult } from '$lib/types/mediaTypes';
import { withCache } from '../fetchUtils';
import { setCache } from '../apiCache';
import { apiKeyStore } from '$lib/stores/apiKeys.svelte';
import { Capacitor } from '@capacitor/core';

const ENV_CLIENT_ID = import.meta.env.VITE_IGDB_CLIENT_ID;
const ENV_CLIENT_SECRET = import.meta.env.VITE_IGDB_CLIENT_SECRET;

const TOKEN_CACHE_KEY = 'traxy:igdb_token';
const IMAGE_BASE = 'https://images.igdb.com/igdb/image/upload';

function getTwitchTokenUrl(): string {
	if (typeof window !== 'undefined' && Capacitor.getPlatform() === 'web') {
		return '/api-proxy/twitch/oauth2/token';
	}
	return 'https://id.twitch.tv/oauth2/token';
}

function getIgdbApiUrl(): string {
	if (typeof window !== 'undefined' && Capacitor.getPlatform() === 'web') {
		return '/api-proxy/igdb/v4';
	}
	return 'https://api.igdb.com/v4';
}

// ── Types ────────────────────────────────────────────────────────────────────

interface IgdbCover {
	url: string; // e.g. "//images.igdb.com/igdb/image/upload/t_thumb/{hash}.jpg"
}

interface IgdbPlatform {
	name: string;
}

interface IgdbGame {
	id: number;
	name: string;
	cover?: IgdbCover;
	first_release_date?: number; // Unix timestamp (seconds)
	platforms?: IgdbPlatform[];
	summary?: string;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

interface CachedToken {
	token: string;
	expiresAt: number;
}

async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
	const raw = localStorage.getItem(TOKEN_CACHE_KEY);
	if (raw) {
		try {
			const cached: CachedToken = JSON.parse(raw);
			if (Date.now() < cached.expiresAt) return cached.token;
		} catch {
			// stale/corrupt cache — refetch
		}
	}

	const url = getTwitchTokenUrl();
	const res = await fetch(
		`${url}?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&grant_type=client_credentials`,
		{ method: 'POST' },
	);
	if (!res.ok) {
		const text = await res.text().catch(() => '');
		throw new Error(`Twitch token error: HTTP ${res.status} ${text}`);
	}
	const data = await res.json();

	const cached: CachedToken = {
		token: data.access_token,
		expiresAt: Date.now() + (data.expires_in - 3600) * 1000, // expire 1 hr early
	};
	localStorage.setItem(TOKEN_CACHE_KEY, JSON.stringify(cached));
	return cached.token;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getCredentials(): { clientId: string; clientSecret: string } | null {
	const clientId = apiKeyStore.current.igdbClientId || ENV_CLIENT_ID;
	const clientSecret = apiKeyStore.current.igdbClientSecret || ENV_CLIENT_SECRET;
	if (!clientId || !clientSecret) return null;
	return { clientId, clientSecret };
}

function coverUrl(cover?: IgdbCover): string | undefined {
	if (!cover?.url) return undefined;
	// Extract hash from "//images.igdb.com/igdb/image/upload/t_thumb/{hash}.jpg"
	const hash = cover.url.split('/').pop()?.replace('.jpg', '');
	return hash ? `${IMAGE_BASE}/t_cover_big/${hash}.jpg` : undefined;
}

function releaseYear(timestamp?: number): number | undefined {
	if (!timestamp) return undefined;
	return new Date(timestamp * 1000).getFullYear();
}

async function igdbFetch(
	clientId: string,
	token: string,
	endpoint: string,
	body: string,
): Promise<IgdbGame[]> {
	const url = `${getIgdbApiUrl()}/${endpoint}`;
	const res = await fetch(url, {
		method: 'POST',
		headers: {
			'Client-ID': clientId,
			Authorization: `Bearer ${token}`,
			'Content-Type': 'text/plain',
		},
		body,
	});
	if (!res.ok) {
		const text = await res.text().catch(() => '');
		throw new Error(`IGDB error: HTTP ${res.status} ${text}`);
	}
	return res.json();
}

function mapGame(item: IgdbGame): SearchResult {
	return {
		externalId: item.id.toString(),
		source: 'igdb',
		type: 'game',
		title: item.name,
		year: releaseYear(item.first_release_date),
		posterUrl: coverUrl(item.cover),
		description: item.summary || undefined,
		platforms: item.platforms?.map((p) => p.name) ?? [],
	};
}

// ── Exports (same names as before so Searchbar.svelte import is unchanged) ───

export async function searchRawg(query: string): Promise<SearchResult[]> {
	if (!query.trim()) return [];
	const creds = getCredentials();
	if (!creds) return [];

	try {
		return await withCache(`igdb:search:${query}`, async () => {
			const token = await getAccessToken(creds.clientId, creds.clientSecret);
			const games = await igdbFetch(
				creds.clientId,
				token,
				'games',
				`fields name, cover.url, first_release_date, platforms.name, summary;
			search "${query.replace(/"/g, '')}";
			where version_parent = null;
			limit 15;`,
			);
			return games.map(mapGame);
		});
	} catch {
		return [];
	}
}

export async function getRawgDetails(id: string): Promise<SearchResult | null> {
	const creds = getCredentials();
	if (!creds) return null;

	try {
		return await withCache(`igdb:detail:${id}`, async () => {
			const token = await getAccessToken(creds.clientId, creds.clientSecret);
			const games = await igdbFetch(
				creds.clientId,
				token,
				'games',
				`fields name, cover.url, first_release_date, platforms.name, summary;
			where id = ${id};
			limit 1;`,
			);
			return games[0] ? mapGame(games[0]) : null;
		});
	} catch {
		return null;
	}
}

// ── Discovery / Catalogue endpoints ──────────────────────────────────────────

/** Most hyped upcoming and recent games. */
export async function discoverIgdbTrending(forceRefresh = false): Promise<SearchResult[]> {
	const creds = getCredentials();
	if (!creds) return [];

	const cacheKey = 'igdb:discover:trending';
	const fetcher = async (): Promise<SearchResult[]> => {
		const token = await getAccessToken(creds.clientId, creds.clientSecret);
		const games = await igdbFetch(
			creds.clientId,
			token,
			'games',
			`fields name, cover.url, first_release_date, platforms.name, summary;
		sort hypes desc;
		where hypes > 0 & version_parent = null;
		limit 20;`,
		);
		return games.map(mapGame);
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

/** Recently released games, sorted by release date. */
export async function discoverIgdbNew(forceRefresh = false): Promise<SearchResult[]> {
	const creds = getCredentials();
	if (!creds) return [];

	const cacheKey = 'igdb:discover:new';
	const nowUnix = Math.floor(Date.now() / 1000);

	const fetcher = async (): Promise<SearchResult[]> => {
		const token = await getAccessToken(creds.clientId, creds.clientSecret);
		const games = await igdbFetch(
			creds.clientId,
			token,
			'games',
			`fields name, cover.url, first_release_date, platforms.name, summary;
		sort first_release_date desc;
		where first_release_date < ${nowUnix} & first_release_date != null & version_parent = null;
		limit 20;`,
		);
		return games.map(mapGame);
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

/** Top rated games by total rating. */
export async function discoverIgdbTopRated(forceRefresh = false): Promise<SearchResult[]> {
	const creds = getCredentials();
	if (!creds) return [];

	const cacheKey = 'igdb:discover:top_rated';
	const fetcher = async (): Promise<SearchResult[]> => {
		const token = await getAccessToken(creds.clientId, creds.clientSecret);
		const games = await igdbFetch(
			creds.clientId,
			token,
			'games',
			`fields name, cover.url, first_release_date, platforms.name, summary;
		sort total_rating desc;
		where total_rating_count > 50 & version_parent = null;
		limit 20;`,
		);
		return games.map(mapGame);
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
 * Random games — uses a random offset against a broad popularity query
 * so results vary on every call. Never cached.
 */
export async function discoverIgdbRandom(): Promise<SearchResult[]> {
	const creds = getCredentials();
	if (!creds) return [];

	const randomOffset = Math.floor(Math.random() * 150);

	try {
		const token = await getAccessToken(creds.clientId, creds.clientSecret);
		const games = await igdbFetch(
			creds.clientId,
			token,
			'games',
			`fields name, cover.url, first_release_date, platforms.name, summary;
		sort rating_count desc;
		where rating_count > 10 & version_parent = null & cover != null;
		limit 20;
		offset ${randomOffset};`,
		);
		// Shuffle locally for extra variety
		const mapped = games.map(mapGame);
		for (let i = mapped.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[mapped[i], mapped[j]] = [mapped[j], mapped[i]];
		}
		return mapped;
	} catch {
		return [];
	}
}

/**
 * Fetches time-to-beat data from IGDB's game_time_to_beats table.
 * @param igdbId  The IGDB game ID (as stored in media.externalId for source=igdb).
 * @returns       { main, extra, completionist } in hours, or null if unavailable.
 */
export async function fetchIgdbTimeToBeat(
	igdbId: string,
): Promise<{ main: number; extra: number; completionist: number } | null> {
	const creds = getCredentials();
	if (!creds) return null;

	try {
		const token = await getAccessToken(creds.clientId, creds.clientSecret);
		const url = `${getIgdbApiUrl()}/game_time_to_beats`;
		const res = await fetch(url, {
			method: 'POST',
			headers: {
				'Client-ID': creds.clientId,
				Authorization: `Bearer ${token}`,
				'Content-Type': 'text/plain',
			},
			body: `fields normally,hastily,completely; where game_id = ${igdbId}; limit 1;`,
		});
		if (!res.ok) return null;
		const rows = await res.json();
		if (!rows || rows.length === 0) return null;
		const row = rows[0];

		// IGDB stores times in seconds; convert to hours (1 decimal)
		const toHours = (s: number) => (s ? Math.round((s / 3600) * 10) / 10 : 0);

		return {
			main: toHours(row.normally as number),
			extra: toHours(row.hastily as number),
			completionist: toHours(row.completely as number),
		};
	} catch {
		return null;
	}
}

/**
 * Resolves a game title to an IGDB ID by searching IGDB,
 * then fetches time-to-beat. Used for non-IGDB-sourced games.
 */
export async function fetchIgdbTimeToBeatByTitle(
	title: string,
): Promise<{ main: number; extra: number; completionist: number } | null> {
	const creds = getCredentials();
	if (!creds) return null;

	try {
		const token = await getAccessToken(creds.clientId, creds.clientSecret);
		const games = await igdbFetch(
			creds.clientId,
			token,
			'games',
			`fields id,name; search "${title.replace(/"/g, '')}"; where version_parent = null; limit 3;`,
		);
		if (!games || games.length === 0) return null;

		// Pick closest name match
		const targetName = title.toLowerCase().replace(/[^a-z0-9\s]/g, '');
		let bestId = games[0].id;
		for (const g of games) {
			const gName = g.name.toLowerCase().replace(/[^a-z0-9\s]/g, '');
			if (gName === targetName) {
				bestId = g.id;
				break;
			}
		}

		return await fetchIgdbTimeToBeat(bestId.toString());
	} catch {
		return null;
	}
}

