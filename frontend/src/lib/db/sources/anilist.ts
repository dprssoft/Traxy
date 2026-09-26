import type { SearchResult } from '$lib/types/mediaTypes';
import { getCached, setCache } from '../apiCache';
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
      relations {
        edges {
          relationType
          node { id format }
        }
      }
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
    format
    status
    episodes
    relations {
      edges {
        relationType
        node { id type format }
      }
    }
  }
}
`;

/** Formats that count as a season of a series; movies, OVAs and specials stay separate. */
const SERIES_FORMATS = new Set(['TV', 'TV_SHORT', 'ONA']);

interface RelationsPayload {
	type?: string;
	format?: string;
	status?: string;
	episodes?: number | null;
	relations?: {
		edges?: { relationType: string; node?: { id: number; type?: string; format?: string } }[];
	};
}

/** Prequel/sequel IDs of a series-format anime, from a `relations { edges }` payload. */
function seriesNeighbours(item: RelationsPayload): { prequel?: number; sequel?: number; links: string[] } {
	const result: { prequel?: number; sequel?: number; links: string[] } = { links: [] };
	if (item.type && item.type !== 'ANIME') return result;
	if (!SERIES_FORMATS.has(item.format ?? '')) return result;
	for (const edge of item.relations?.edges ?? []) {
		if (!edge.node || !SERIES_FORMATS.has(edge.node.format ?? '')) continue;
		if (edge.node.type && edge.node.type !== 'ANIME') continue;
		if (edge.relationType === 'PREQUEL') result.prequel = edge.node.id;
		else if (edge.relationType === 'SEQUEL') result.sequel = edge.node.id;
		else continue;
		result.links.push(String(edge.node.id));
	}
	return result;
}

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
		seriesLinks: item.relations ? seriesNeighbours(item).links : undefined,
	};
}

/** One season in a series chain, in airing order. */
export interface AnilistSeriesNode {
	id: number;
	episodes: number;
	status?: string;
}

/**
 * Walk prequel/sequel links (series formats only) from `startId` and return the whole chain
 * in order, or undefined for a standalone entry. Throws if any step fails, so a chain cut
 * short by a rate limit is never cached. The result is cached under every member's ID.
 */
async function fetchSeriesChain(startId: number): Promise<AnilistSeriesNode[] | undefined> {
	const nodes = new Map<number, AnilistSeriesNode & { prequel?: number; sequel?: number }>();

	async function visit(id: number): Promise<void> {
		if (nodes.has(id)) return;
		const data = await fetchJson<{ data: { Media: RelationsPayload | null } }>(
			BASE_URL,
			ANILIST_TIMEOUT_MS,
			{ 'Content-Type': 'application/json', Accept: 'application/json' },
			{ method: 'POST', body: JSON.stringify({ query: RELATIONS_QUERY, variables: { id } }) },
		);
		const media = data.data?.Media;
		if (!media) throw new Error(`AniList media ${id} missing`);
		const { prequel, sequel } = seriesNeighbours({ ...media, type: 'ANIME' });
		nodes.set(id, { id, episodes: media.episodes || 0, status: media.status, prequel, sequel });
		if (prequel) await visit(prequel);
		if (sequel) await visit(sequel);
	}

	await visit(startId);
	if (nodes.size <= 1) return undefined;

	let rootId = startId;
	const seen = new Set<number>([rootId]);
	for (let prev = nodes.get(rootId)?.prequel; prev && nodes.has(prev) && !seen.has(prev); prev = nodes.get(prev)?.prequel) {
		rootId = prev;
		seen.add(prev);
	}

	const chain: AnilistSeriesNode[] = [];
	const inChain = new Set<number>();
	for (let id: number | undefined = rootId; id && nodes.has(id) && !inChain.has(id); id = nodes.get(id)?.sequel) {
		const { episodes, status } = nodes.get(id)!;
		chain.push({ id, episodes, status });
		inChain.add(id);
	}
	return chain.length > 1 ? chain : undefined;
}

/**
 * Cached season chain for an anime (see fetchSeriesChain): null for a standalone entry.
 * Rejects when AniList can't be reached, so callers can retry later.
 */
export async function resolveAnilistSeriesChain(id: number): Promise<AnilistSeriesNode[] | null> {
	const key = (memberId: number) => `anilist:chain:v2:${memberId}`;
	const cached = await getCached<{ chain: AnilistSeriesNode[] | null }>(key(id));
	if (cached) return cached.chain;
	const chain = (await fetchSeriesChain(id)) ?? null;
	for (const memberId of chain?.map((n) => n.id) ?? [id]) {
		await setCache(key(memberId), { chain });
	}
	return chain;
}

/** Season chain for an anime, or undefined when standalone or unreachable. */
export async function getAnilistSeriesChain(id: number): Promise<AnilistSeriesNode[] | undefined> {
	return (await resolveAnilistSeriesChain(id).catch(() => null)) ?? undefined;
}

function chainToSeasonData(chain: AnilistSeriesNode[]): import('$lib/db/schema').MediaSeasonData[] {
	return chain.map((node, i) => ({
		seasonNumber: i + 1,
		episodeCount: node.episodes,
		linkedMediaId: String(node.id),
	}));
}

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

export async function getAnilistDetails(id: number): Promise<SearchResult | null> {
	const cacheKey = `anilist:detail:${id}`;
	try {
		const result = await withCache(cacheKey, async () => {
			const data = await fetchJson<{ data: { Media: unknown } }>(
				BASE_URL,
				ANILIST_TIMEOUT_MS,
				{ 'Content-Type': 'application/json', Accept: 'application/json' },
				{ method: 'POST', body: JSON.stringify({ query: DETAIL_QUERY, variables: { id } }) },
			);
			return mapAnilistItem(data.data.Media);
		});

		if (result.type === 'anime') {
			// Older cache entries carried a chain that also followed movies/OVAs — rebuild it
			result.seasonData = undefined;
			result.totalSeasons = undefined;
			const chain = await getAnilistSeriesChain(id);
			if (chain) {
				result.seasonData = chainToSeasonData(chain);
				result.totalSeasons = chain.length;
			}
		}
		return result;
	} catch {
		return null;
	}
}

/**
 * Details for a whole anime series: `id` may be any season. Returns the first season's
 * details with every season in `seasonData`, episodes summed across seasons (unknown while
 * any season's count is unknown) and the latest season's release status. Standalone
 * entries return their own details.
 */
export async function getAnilistSeriesDetails(id: number): Promise<SearchResult | null> {
	const chain = await getAnilistSeriesChain(id);
	if (!chain) return getAnilistDetails(id);

	const root = await getAnilistDetails(chain[0].id);
	if (!root) return null;
	const allKnown = chain.every((n) => n.episodes > 0);
	return {
		...root,
		totalEpisodes: allKnown ? chain.reduce((sum, n) => sum + n.episodes, 0) : undefined,
		releaseStatus: mapAnilistStatus(chain[chain.length - 1].status) ?? root.releaseStatus,
		seriesLinks: undefined,
	};
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
      relations {
        edges {
          relationType
          node { id format }
        }
      }
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
