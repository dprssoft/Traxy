import type { SearchResult } from '$lib/types/mediaTypes';
import { fetchJson, parseYear, withCache } from '../fetchUtils';
import { apiKeyStore } from '$lib/stores/apiKeys.svelte';
import { Capacitor } from '@capacitor/core';

// Note: Comic Vine blocks standard CORS browser fetch.
// Capacitor bypasses this natively. For web dev, a proxy is configured in vite.config.ts.

const ENV_COMICVINE_API_KEY = import.meta.env.VITE_COMICVINE_API_KEY;
const HTML_TAG_RE = /<[^>]*>?/gm;

function getComicVineBaseUrl(): string {
	if (typeof window !== 'undefined' && Capacitor.getPlatform() === 'web') {
		return '/api-proxy/comicvine';
	}
	return 'https://comicvine.gamespot.com/api';
}

interface ComicVineImage {
	medium_url?: string;
	original_url?: string;
}

interface ComicVineVolume {
	id: number;
	name: string;
	start_year?: string;
	image?: ComicVineImage;
	deck?: string;
	description?: string;
	count_of_issues?: number;
}

interface ComicVineSearchResponse {
	results: ComicVineVolume[];
}

interface ComicVineDetailResponse {
	results: ComicVineVolume;
}

function mapVolume(item: ComicVineVolume): SearchResult {
	return {
		externalId: item.id.toString(),
		source: 'comicvine',
		type: 'comic',
		title: item.name,
		year: parseYear(item.start_year),
		posterUrl: item.image?.medium_url ?? item.image?.original_url ?? undefined,
		description: item.deck ?? item.description?.replace(HTML_TAG_RE, '') ?? undefined,
		totalEpisodes: item.count_of_issues ?? undefined,
	};
}

const CV_HEADERS = { 'User-Agent': 'TraxyApp/1.0' };

export async function searchComicVine(query: string): Promise<SearchResult[]> {
	if (!query.trim()) return [];
	const apiKey = apiKeyStore.current.comicvine || ENV_COMICVINE_API_KEY;
	if (!apiKey) return [];

	const baseUrl = getComicVineBaseUrl();
	try {
		return await withCache(`comicvine:search:${query}`, async () => {
			const data = await fetchJson<ComicVineSearchResponse>(
				`${baseUrl}/search/?api_key=${apiKey}&format=json&resources=volume&query=${encodeURIComponent(query)}`,
				6000,
				CV_HEADERS,
			);
			return data.results.map(mapVolume);
		});
	} catch (err) {
		console.error('ComicVine search failed:', err);
		return [];
	}
}

export async function getComicVineDetails(id: string): Promise<SearchResult | null> {
	const apiKey = apiKeyStore.current.comicvine || ENV_COMICVINE_API_KEY;
	if (!apiKey) return null;

	const baseUrl = getComicVineBaseUrl();
	try {
		return await withCache(`comicvine:detail:${id}`, async () => {
			const data = await fetchJson<ComicVineDetailResponse>(
				`${baseUrl}/volume/4050-${id}/?api_key=${apiKey}&format=json`,
				6000,
				CV_HEADERS,
			);
			return mapVolume(data.results);
		});
	} catch {
		return null;
	}
}
