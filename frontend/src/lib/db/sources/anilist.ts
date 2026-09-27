import type { SearchResult } from '$lib/types/mediaTypes';
import { setCache } from '../apiCache';
import { withCache, fetchJson } from '../fetchUtils';

// GraphQL calls are observed slower than TMDB's CDN-backed REST API — 8s gives AniList
// enough room without holding up a whole catalogue category row as long as the old 15s did.
const ANILIST_TIMEOUT_MS = 8000;

const BASE_URL = 'https://graphql.anilist.co';

const SEARCH_QUERY = `
query ($query: String, $type: MediaType) {
  Page(page: 1, perPage: 10) {
    media(search: $query, type: $type, sort: SEARCH_MATCH) {
      id
      title { romaji english native }
      type
      format
      status
      episodes
      chapters
      volumes
      coverImage { extraLarge }
      startDate { year month }
      endDate { year month }
      description
      countryOfOrigin
      genres
      isAdult
      duration
      staff(sort: RELEVANCE, perPage: 5) {
        edges {
          role
          node { name { full } }
        }
      }
    }
  }
}
`;

const RELATIONS_QUERY = `
query ($id: Int) {
  Media(id: $id) {
    id
    episodes
    relations {
      edges {
        relationType
        node {
          id
          type
          format
          episodes
        }
      }
    }
  }
}
`;

const DETAIL_QUERY = `
query ($id: Int) {
  Media(id: $id) {
    id
    title { romaji english native }
    type
    format
    status
    episodes
    chapters
    volumes
    coverImage { extraLarge }
    startDate { year month }
    endDate { year month }
    description
    countryOfOrigin
    genres
    isAdult
    duration
    staff(sort: RELEVANCE, perPage: 5) {
      edges {
        role
        node { name { full } }
      }
    }
  }
}
`;

function mapAnilistType(item: any): import('$lib/db/schema').MediaType {
	if (item.type === 'ANIME') return 'anime';
	if (item.type === 'MANGA') {
		if (item.countryOfOrigin === 'KR') return 'manhwa';
		if (item.countryOfOrigin === 'CN') return 'manhua';
		return 'manga';
	}
	return 'anime'; // fallback
}

/** Map AniList status to our release status labels */
function mapAnilistStatus(status?: string): string | undefined {
	if (!status) return undefined;
	const map: Record<string, string> = {
		'RELEASING': 'Airing',
		'FINISHED': 'Finished',
		'NOT_YET_RELEASED': 'Upcoming',
		'CANCELLED': 'Cancelled',
		'HIATUS': 'Hiatus',
	};
	return map[status] ?? status;
}

/** Map AniList countryOfOrigin code to country name */
function mapAnilistCountry(code?: string): string | undefined {
	if (!code) return undefined;
	const map: Record<string, string> = {
		'JP': 'Japan',
		'KR': 'South Korea',
		'CN': 'China',
		'TW': 'Taiwan',
		'US': 'USA',
	};
	return map[code] ?? code;
}

/** Extract the most relevant author/creator from AniList staff edges */
function extractAnilistAuthor(item: any): string | undefined {
	const staff = item.staff?.edges;
	if (!staff || staff.length === 0) return undefined;
	// Priority: Original Creator > Story > Director > first staff member
	const priorityRoles = ['Original Creator', 'Story & Art', 'Story', 'Director', 'Original Story'];
	for (const role of priorityRoles) {
		const match = staff.find((e: any) => e.role?.includes(role));
		if (match?.node?.name?.full) return match.node.name.full;
	}
	return staff[0]?.node?.name?.full;
}

function mapAnilistItem(item: any): SearchResult {
	const displayTitle = item.title.english || item.title.romaji || item.title.native;
	const origTitle = item.title.native || item.title.romaji;
	return {
		externalId: item.id.toString(),
		source: 'anilist',
		type: mapAnilistType(item),
		title: displayTitle,
		originalTitle: origTitle && origTitle !== displayTitle ? origTitle : undefined,
		year: item.startDate?.year || undefined,
		// Discover queries request the smaller `large` cover (right-sized for a poster
		// card); search/detail queries still request `extraLarge`, so this mapper — shared
		// by all three — falls back to whichever the query actually returned.
		posterUrl: item.coverImage?.large || item.coverImage?.extraLarge || undefined,
		description: item.description?.replace(/<[^>]*>?/gm, '') || undefined,
		author: extractAnilistAuthor(item),
		country: mapAnilistCountry(item.countryOfOrigin),
		genres: item.genres?.length > 0 ? item.genres : undefined,
		isAdult: item.isAdult === true || item.genres?.includes('Hentai') === true,
		releaseStatus: mapAnilistStatus(item.status),
		totalEpisodes: item.episodes || undefined,
		totalSeasons: undefined, // AniList doesn't do seasons the same way
		totalVolumes: item.volumes || undefined,
		totalChapters: item.chapters || undefined,
		totalPages: undefined,
		runtimeMinutes: item.format === 'MOVIE' ? (item.duration || undefined) : undefined,
	};
}

async function getAnilistSeasonChain(startId: number): Promise<import('$lib/db/schema').MediaSeasonData[] | undefined> {
	const visited = new Set<number>();
	const chain = new Map<number, { episodes: number, prequel?: number, sequel?: number }>();

	async function fetchRelations(id: number) {
		if (visited.has(id)) return;
		visited.add(id);

		try {
			const res = await fetch(BASE_URL, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
				body: JSON.stringify({ query: RELATIONS_QUERY, variables: { id } }),
			});
			if (!res.ok) return;
			const data = await res.json();
			const media = data?.data?.Media;
			if (!media) return;

			let prequel: number | undefined;
			let sequel: number | undefined;

			for (const edge of media.relations?.edges || []) {
				if (edge.node?.type !== 'ANIME') continue;
				if (edge.relationType === 'PREQUEL') prequel = edge.node.id;
				if (edge.relationType === 'SEQUEL') sequel = edge.node.id;
			}

			chain.set(id, { episodes: media.episodes || 0, prequel, sequel });

			if (prequel && !visited.has(prequel)) await fetchRelations(prequel);
			if (sequel && !visited.has(sequel)) await fetchRelations(sequel);
		} catch (e) {
			// ignore
		}
	}

	await fetchRelations(startId);
	if (chain.size <= 1) return undefined;

	let rootId = startId;
	while (chain.get(rootId)?.prequel && chain.has(chain.get(rootId)!.prequel!)) {
		rootId = chain.get(rootId)!.prequel!;
	}

	const seasonData: import('$lib/db/schema').MediaSeasonData[] = [];
	let currentId: number | undefined = rootId;
	let seasonNumber = 1;

	while (currentId && chain.has(currentId)) {
		const node: { episodes: number; prequel?: number; sequel?: number } = chain.get(currentId)!;
		seasonData.push({
			seasonNumber,
			episodeCount: node.episodes,
			linkedMediaId: currentId.toString(),
		});
		seasonNumber++;
		const nextId: number | undefined = node.sequel;
		currentId = nextId;
	}

	return seasonData.length > 1 ? seasonData : undefined;
}


/** Search anime or manga (manhwa/manhua are told apart by country of origin). Empty on error. */
export async function searchAnilist(query: string, type: 'ANIME' | 'MANGA'): Promise<SearchResult[]> {
	if (!query.trim()) return [];

	const cacheKey = `anilist:search:${type}:${query}`;
	try {
		return await withCache(cacheKey, async () => {
			const data = await fetchJson<{ data: { Page: { media: unknown[] } } }>(
				BASE_URL,
				ANILIST_TIMEOUT_MS,
				{ 'Content-Type': 'application/json', Accept: 'application/json' },
				{ method: 'POST', body: JSON.stringify({ query: SEARCH_QUERY, variables: { query, type } }) },
			);
			return data.data.Page.media.map(mapAnilistItem);
		});
	} catch {
		return [];
	}
}

/**
 * Full details by AniList id. For anime, sequels are followed to build per-season data, since
 * AniList stores each season as a separate entry. Null on error.
 */
export async function getAnilistDetails(id: number): Promise<SearchResult | null> {
	const cacheKey = `anilist:detail:${id}`;
	try {
		return await withCache(cacheKey, async () => {
			const data = await fetchJson<{ data: { Media: unknown } }>(
				BASE_URL,
				ANILIST_TIMEOUT_MS,
				{ 'Content-Type': 'application/json', Accept: 'application/json' },
				{ method: 'POST', body: JSON.stringify({ query: DETAIL_QUERY, variables: { id } }) },
			);
			const result = mapAnilistItem(data.data.Media);

			if (result.type === 'anime') {
				const seasonData = await getAnilistSeasonChain(id);
				if (seasonData) {
					result.seasonData = seasonData;
					result.totalSeasons = seasonData.length;
				}
			}

			return result;
		});
	} catch {
		return null;
	}
}

// ── Discovery / Catalogue endpoints ──────────────────────────────────────────

const DISCOVER_QUERY = `
query ($type: MediaType, $sort: [MediaSort], $status: MediaStatus, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    media(type: $type, sort: $sort, status: $status) {
      id
      title { romaji english native }
      type
      format
      status
      episodes
      chapters
      volumes
      coverImage { large }
      startDate { year month }
      endDate { year month }
      description
      countryOfOrigin
      genres
      isAdult
      duration
      staff(sort: RELEVANCE, perPage: 3) {
        edges {
          role
          node { name { full } }
        }
      }
    }
  }
}
`;

async function discoverAnilist(
	mediaType: 'ANIME' | 'MANGA',
	sort: string[],
	status?: string,
	page = 1,
	perPage = 20,
	forceRefresh = false,
): Promise<SearchResult[]> {
	const cacheKey = `anilist:discover:${mediaType}:${sort.join(',')}:${status ?? 'any'}:${page}`;

	const fetcher = async (): Promise<SearchResult[]> => {
		const variables: Record<string, unknown> = {
			type: mediaType,
			sort,
			page,
			perPage,
		};
		if (status) variables.status = status;

		const data = await fetchJson<{ data: { Page: { media: unknown[] } } }>(
			BASE_URL,
			ANILIST_TIMEOUT_MS,
			{ 'Content-Type': 'application/json', Accept: 'application/json' },
			{ method: 'POST', body: JSON.stringify({ query: DISCOVER_QUERY, variables }) },
		);

		return (data.data?.Page?.media ?? []).map(mapAnilistItem);
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

/** Trending anime or manga this week. */
export function discoverAnilistTrending(
	mediaType: 'ANIME' | 'MANGA',
	page = 1,
	forceRefresh = false,
): Promise<SearchResult[]> {
	return discoverAnilist(mediaType, ['TRENDING_DESC'], undefined, page, 20, forceRefresh);
}

/** Newly releasing anime or manga. */
export function discoverAnilistNew(
	mediaType: 'ANIME' | 'MANGA',
	page = 1,
	forceRefresh = false,
): Promise<SearchResult[]> {
	return discoverAnilist(mediaType, ['START_DATE_DESC'], 'RELEASING', page, 20, forceRefresh);
}

/** Top rated anime or manga by score. */
export function discoverAnilistTopRated(
	mediaType: 'ANIME' | 'MANGA',
	page = 1,
	forceRefresh = false,
): Promise<SearchResult[]> {
	return discoverAnilist(mediaType, ['SCORE_DESC'], undefined, page, 20, forceRefresh);
}

/** Random anime or manga — fetches a random page from popular results. */
export async function discoverAnilistRandom(
	mediaType: 'ANIME' | 'MANGA',
): Promise<SearchResult[]> {
	const randomPage = Math.floor(Math.random() * 50) + 1;
	// Don't cache random results so they vary per visit
	try {
		const data = await fetchJson<{ data: { Page: { media: unknown[] } } }>(
			BASE_URL,
			ANILIST_TIMEOUT_MS,
			{ 'Content-Type': 'application/json', Accept: 'application/json' },
			{
				method: 'POST',
				body: JSON.stringify({
					query: DISCOVER_QUERY,
					variables: { type: mediaType, sort: ['POPULARITY_DESC'], page: randomPage, perPage: 10 },
				}),
			},
		);
		const items: SearchResult[] = (data.data?.Page?.media ?? []).map(mapAnilistItem);
		// Shuffle the results for extra randomness
		for (let i = items.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[items[i], items[j]] = [items[j], items[i]];
		}
		return items;
	} catch {
		return [];
	}
}
