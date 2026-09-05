import type { SearchResult } from '$lib/types/mediaTypes';
import { getCached, setCache } from '../apiCache';

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
      startDate { year }
      description
      countryOfOrigin
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
    startDate { year }
    description
    countryOfOrigin
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

function mapAnilistItem(item: any): SearchResult {
	return {
		externalId: item.id.toString(),
		source: 'anilist',
		type: mapAnilistType(item),
		title: item.title.english || item.title.romaji || item.title.native,
		year: item.startDate?.year || undefined,
		posterUrl: item.coverImage?.extraLarge || undefined,
		description: item.description?.replace(/<[^>]*>?/gm, '') || undefined,
		totalEpisodes: item.episodes || undefined,
		totalSeasons: undefined, // AniList doesn't do seasons the same way
		totalPages: undefined, // Volumes/chapters instead
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


export async function searchAnilist(query: string, type: 'ANIME' | 'MANGA'): Promise<SearchResult[]> {
	if (!query.trim()) return [];

	const cacheKey = `anilist:search:${type}:${query}`;
	const cached = await getCached<SearchResult[]>(cacheKey);
	if (cached) return cached;

	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 15000);
		const res = await fetch(BASE_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Accept': 'application/json',
			},
			body: JSON.stringify({
				query: SEARCH_QUERY,
				variables: { query, type },
			}),
			signal: controller.signal
		});
		clearTimeout(timeout);
		if (!res.ok) return [];
		const data = await res.json();

		const results = data.data.Page.media.map(mapAnilistItem);
		await setCache(cacheKey, results);
		return results;
	} catch {
		return [];
	}
}

export async function getAnilistDetails(id: number): Promise<SearchResult | null> {
	const cacheKey = `anilist:detail:${id}`;
	const cached = await getCached<SearchResult>(cacheKey);
	if (cached) return cached;

	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 15000);
		const res = await fetch(BASE_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Accept': 'application/json',
			},
			body: JSON.stringify({
				query: DETAIL_QUERY,
				variables: { id },
			}),
			signal: controller.signal
		});
		clearTimeout(timeout);
		if (!res.ok) return null;
		const data = await res.json();

		const result = mapAnilistItem(data.data.Media);
		
		if (result.type === 'anime') {
			const seasonData = await getAnilistSeasonChain(id);
			if (seasonData) {
				result.seasonData = seasonData;
				result.totalSeasons = seasonData.length;
			}
		}

		await setCache(cacheKey, result);
		return result;
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
      coverImage { extraLarge }
      startDate { year }
      description
      countryOfOrigin
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
): Promise<SearchResult[]> {
	const cacheKey = `anilist:discover:${mediaType}:${sort.join(',')}:${status ?? 'any'}:${page}`;
	const cached = await getCached<SearchResult[]>(cacheKey);
	if (cached) return cached;

	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 15000);
		const variables: Record<string, unknown> = {
			type: mediaType,
			sort,
			page,
			perPage,
		};
		if (status) variables.status = status;

		const res = await fetch(BASE_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify({ query: DISCOVER_QUERY, variables }),
			signal: controller.signal,
		});
		clearTimeout(timeout);
		if (!res.ok) return [];
		const data = await res.json();

		const results = (data.data?.Page?.media ?? []).map(mapAnilistItem);
		await setCache(cacheKey, results);
		return results;
	} catch {
		return [];
	}
}

/** Trending anime or manga this week. */
export function discoverAnilistTrending(
	mediaType: 'ANIME' | 'MANGA',
	page = 1,
): Promise<SearchResult[]> {
	return discoverAnilist(mediaType, ['TRENDING_DESC'], undefined, page);
}

/** Newly releasing anime or manga. */
export function discoverAnilistNew(
	mediaType: 'ANIME' | 'MANGA',
	page = 1,
): Promise<SearchResult[]> {
	return discoverAnilist(mediaType, ['START_DATE_DESC'], 'RELEASING', page);
}

/** Top rated anime or manga by score. */
export function discoverAnilistTopRated(
	mediaType: 'ANIME' | 'MANGA',
	page = 1,
): Promise<SearchResult[]> {
	return discoverAnilist(mediaType, ['SCORE_DESC'], undefined, page);
}

/** Random anime or manga — fetches a random page from popular results. */
export async function discoverAnilistRandom(
	mediaType: 'ANIME' | 'MANGA',
): Promise<SearchResult[]> {
	const randomPage = Math.floor(Math.random() * 50) + 1;
	// Don't cache random results so they vary per visit
	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 15000);
		const res = await fetch(BASE_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify({
				query: DISCOVER_QUERY,
				variables: { type: mediaType, sort: ['POPULARITY_DESC'], page: randomPage, perPage: 10 },
			}),
			signal: controller.signal,
		});
		clearTimeout(timeout);
		if (!res.ok) return [];
		const data = await res.json();
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
