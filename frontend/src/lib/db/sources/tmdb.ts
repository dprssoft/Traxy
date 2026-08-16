import type { SearchResult } from '$lib/types/mediaTypes';
import { fetchJson, parseYear, withCache } from '../fetchUtils';
import { apiKeyStore } from '$lib/stores/apiKeys.svelte';

const ENV_TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

interface TmdbSearchItem {
	id: number;
	media_type: 'movie' | 'tv' | 'person';
	title?: string;
	name?: string;
	release_date?: string;
	first_air_date?: string;
	poster_path?: string | null;
	overview?: string;
}

interface TmdbSearchResponse {
	results: TmdbSearchItem[];
}

interface TmdbItemDetails {
	id: number;
	title?: string;
	name?: string;
	release_date?: string;
	first_air_date?: string;
	poster_path?: string | null;
	overview?: string;
	number_of_episodes?: number;
	number_of_seasons?: number;
}

function posterUrl(path?: string | null): string | undefined {
	return path ? `${IMAGE_BASE}${path}` : undefined;
}

export async function searchTmdb(query: string, language = 'en-US'): Promise<SearchResult[]> {
	if (!query.trim()) return [];
	const apiKey = apiKeyStore.current.tmdb || ENV_TMDB_API_KEY;
	if (!apiKey) return [];

	try {
		return await withCache(`tmdb:search:${language}:${query}`, async () => {
			const data = await fetchJson<TmdbSearchResponse>(
				`${BASE_URL}/search/multi?api_key=${apiKey}&query=${encodeURIComponent(query)}&language=${language}&page=1`,
			);
			return data.results
				.filter((item) => item.media_type === 'movie' || item.media_type === 'tv')
				.map(
					(item): SearchResult => ({
						externalId: item.id.toString(),
						source: 'tmdb',
						type: item.media_type === 'movie' ? 'film' : 'tv',
						title: item.title ?? item.name ?? '',
						year: parseYear(item.release_date ?? item.first_air_date),
						posterUrl: posterUrl(item.poster_path),
						description: item.overview || undefined,
					}),
				);
		});
	} catch {
		return [];
	}
}

export async function getTmdbDetails(
	id: string,
	type: 'film' | 'tv',
	language = 'en-US',
): Promise<SearchResult | null> {
	const apiKey = apiKeyStore.current.tmdb || ENV_TMDB_API_KEY;
	if (!apiKey) return null;

	const endpoint = type === 'film' ? 'movie' : 'tv';
	try {
		return await withCache(`tmdb:detail:${type}:${id}:${language}`, async () => {
			const data = await fetchJson<TmdbItemDetails>(
				`${BASE_URL}/${endpoint}/${id}?api_key=${apiKey}&language=${language}`,
			);
			return {
				externalId: data.id.toString(),
				source: 'tmdb',
				type,
				title: data.title ?? data.name ?? '',
				year: parseYear(data.release_date ?? data.first_air_date),
				posterUrl: posterUrl(data.poster_path),
				description: data.overview || undefined,
				totalEpisodes: data.number_of_episodes,
				totalSeasons: data.number_of_seasons,
			};
		});
	} catch {
		return null;
	}
}
