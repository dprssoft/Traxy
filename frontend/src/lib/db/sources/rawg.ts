// IGDB (Internet Game Database) — free, requires Twitch developer credentials.
// Sign up at: https://dev.twitch.tv/console → Create a new application.
//
// Note: IGDB API blocks CORS in browser context.
// Capacitor bypasses this natively. For web dev, a proxy is needed.
import type { SearchResult } from '$lib/types/mediaTypes';
import { withCache } from '../fetchUtils';
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
