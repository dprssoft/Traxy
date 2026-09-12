import type { SearchResult } from '$lib/types/mediaTypes';
import { fetchJson, parseYear, withCache } from '../fetchUtils';
import { getCached, setCache } from '../apiCache';
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
	original_title?: string;
	original_name?: string;
	release_date?: string;
	first_air_date?: string;
	poster_path?: string | null;
	overview?: string;
	number_of_episodes?: number;
	number_of_seasons?: number;
	seasons?: { season_number: number; episode_count: number }[];
	status?: string;
	genres?: { id: number; name: string }[];
	production_countries?: { iso_3166_1: string; name: string }[];
	credits?: {
		crew?: { job: string; name: string }[];
	};
	created_by?: { name: string }[];
	runtime?: number;
}

function posterUrl(path?: string | null): string | undefined {
	return path ? `${IMAGE_BASE}${path}` : undefined;
}

/** Map TMDB status strings to our release status labels */
function mapTmdbStatus(status?: string): string | undefined {
	if (!status) return undefined;
	const map: Record<string, string> = {
		'Released': 'Released',
		'Post Production': 'Post Production',
		'In Production': 'In Production',
		'Planned': 'Planned',
		'Canceled': 'Cancelled',
		'Rumored': 'Rumored',
		// TV statuses
		'Returning Series': 'Airing',
		'Ended': 'Finished',
		'Cancelled': 'Cancelled',
		'Pilot': 'Pilot',
	};
	return map[status] ?? status;
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
				`${BASE_URL}/${endpoint}/${id}?api_key=${apiKey}&language=${language}&append_to_response=credits`,
			);

			// Extract director (for films) or creator (for TV)
			let author: string | undefined;
			if (type === 'film') {
				const director = data.credits?.crew?.find((c) => c.job === 'Director');
				author = director?.name;
			} else {
				author = data.created_by?.[0]?.name;
			}

			// Extract country
			const country = data.production_countries?.[0]?.name;

			// Extract genres
			const genres = data.genres?.map((g) => g.name);

			// Original title
			const displayTitle = data.title ?? data.name ?? '';
			const origTitle = data.original_title ?? data.original_name;
			const originalTitle = origTitle && origTitle !== displayTitle ? origTitle : undefined;

			return {
				externalId: data.id.toString(),
				source: 'tmdb',
				type,
				title: displayTitle,
				originalTitle,
				year: parseYear(data.release_date ?? data.first_air_date),
				posterUrl: posterUrl(data.poster_path),
				description: data.overview || undefined,
				author,
				country,
				genres,
				releaseStatus: mapTmdbStatus(data.status),
				totalEpisodes: data.number_of_episodes,
				totalSeasons: data.number_of_seasons,
				seasonData: data.seasons
					? data.seasons
							.filter((s) => s.season_number > 0)
							.map((s) => ({
								seasonNumber: s.season_number,
								episodeCount: s.episode_count,
							}))
					: undefined,
				runtimeMinutes: type === 'film' ? (data.runtime ?? undefined) : undefined,
			};
		});
	} catch {
		return null;
	}
}

// ── Discovery / Catalogue endpoints ──────────────────────────────────────────

interface TmdbDiscoverResponse {
	results: TmdbSearchItem[];
	total_pages: number;
}

/**
 * Trending movies or TV shows for the current week.
 * TMDB endpoint: /trending/{movie|tv}/week
 */
export async function discoverTmdbTrending(
	type: 'film' | 'tv',
	language = 'en-US',
	page = 1,
	forceRefresh = false,
): Promise<SearchResult[]> {
	const apiKey = apiKeyStore.current.tmdb || ENV_TMDB_API_KEY;
	if (!apiKey) return [];

	const cacheKey = `tmdb:trending:${type}:${language}:${page}`;
	const endpoint = type === 'film' ? 'movie' : 'tv';

	const fetcher = async (): Promise<SearchResult[]> => {
		const data = await fetchJson<TmdbDiscoverResponse>(
			`${BASE_URL}/trending/${endpoint}/week?api_key=${apiKey}&language=${language}&page=${page}`,
		);
		return data.results
			.filter((item) => item.media_type === 'movie' || item.media_type === 'tv' || !item.media_type)
			.map(
				(item): SearchResult => ({
					externalId: item.id.toString(),
					source: 'tmdb',
					type,
					title: item.title ?? item.name ?? '',
					year: parseYear(item.release_date ?? item.first_air_date),
					posterUrl: posterUrl(item.poster_path),
					description: item.overview || undefined,
				}),
			);
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
 * Newly released movies or TV shows, sorted by release date descending.
 * TMDB endpoint: /discover/{movie|tv}
 */
export async function discoverTmdbNew(
	type: 'film' | 'tv',
	language = 'en-US',
	page = 1,
	forceRefresh = false,
): Promise<SearchResult[]> {
	const apiKey = apiKeyStore.current.tmdb || ENV_TMDB_API_KEY;
	if (!apiKey) return [];

	const cacheKey = `tmdb:new:${type}:${language}:${page}`;
	const endpoint = type === 'film' ? 'movie' : 'tv';
	const today = new Date().toISOString().split('T')[0];
	const sortField = type === 'film' ? 'primary_release_date' : 'first_air_date';
	const dateFilter = type === 'film'
		? `&primary_release_date.lte=${today}`
		: `&first_air_date.lte=${today}`;

	const fetcher = async (): Promise<SearchResult[]> => {
		const data = await fetchJson<TmdbDiscoverResponse>(
			`${BASE_URL}/discover/${endpoint}?api_key=${apiKey}&language=${language}&sort_by=${sortField}.desc${dateFilter}&page=${page}&vote_count.gte=10`,
		);
		return data.results.map(
			(item): SearchResult => ({
				externalId: item.id.toString(),
				source: 'tmdb',
				type,
				title: item.title ?? item.name ?? '',
				year: parseYear(item.release_date ?? item.first_air_date),
				posterUrl: posterUrl(item.poster_path),
				description: item.overview || undefined,
			}),
		);
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
 * Top rated movies or TV shows.
 * TMDB endpoint: /{movie|tv}/top_rated
 */
export async function discoverTmdbTopRated(
	type: 'film' | 'tv',
	language = 'en-US',
	page = 1,
	forceRefresh = false,
): Promise<SearchResult[]> {
	const apiKey = apiKeyStore.current.tmdb || ENV_TMDB_API_KEY;
	if (!apiKey) return [];

	const cacheKey = `tmdb:top_rated:${type}:${language}:${page}`;
	const endpoint = type === 'film' ? 'movie' : 'tv';

	const fetcher = async (): Promise<SearchResult[]> => {
		const data = await fetchJson<TmdbDiscoverResponse>(
			`${BASE_URL}/${endpoint}/top_rated?api_key=${apiKey}&language=${language}&page=${page}`,
		);
		return data.results.map(
			(item): SearchResult => ({
				externalId: item.id.toString(),
				source: 'tmdb',
				type,
				title: item.title ?? item.name ?? '',
				year: parseYear(item.release_date ?? item.first_air_date),
				posterUrl: posterUrl(item.poster_path),
				description: item.overview || undefined,
			}),
		);
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
