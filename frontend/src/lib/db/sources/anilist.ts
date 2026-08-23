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
		const node = chain.get(currentId)!;
		seasonData.push({
			seasonNumber,
			episodeCount: node.episodes,
			linkedMediaId: currentId.toString(),
		});
		seasonNumber++;
		currentId = node.sequel;
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
		const timeout = setTimeout(() => controller.abort(), 4000);
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
		const timeout = setTimeout(() => controller.abort(), 4000);
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
