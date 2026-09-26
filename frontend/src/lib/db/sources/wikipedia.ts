/**
 * Wikidata enrichment source — queries the Wikidata API to fill in missing
 * metadata (author, country, genres, counts…) and find the Wikipedia article.
 *
 * This is a supplementary source: it never replaces already-populated fields.
 * Gated by the `feat_wikipedia_enrichment` flag (Settings → Integrations).
 */
import type { MediaType } from '$lib/db/schema';
import { fetchJson, withCache } from '../fetchUtils';

const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';

/** Language used when a localized label/article is missing. Titles are searched in it too. */
const FALLBACK_LANG = 'en';

export interface WikipediaEnrichment {
	wikidataId: string;
	wikipediaUrl?: string;
	author?: string;
	country?: string;
	description?: string;
	releaseStatus?: string;
	genres?: string[];
	totalEpisodes?: number;
	totalSeasons?: number;
	totalVolumes?: number;
	totalChapters?: number;
	totalPages?: number;
	runtimeMinutes?: number;
}

export interface WikidataSearchHit {
	id: string;
	label: string;
	description?: string;
}

type LangMap = Record<string, { value: string }>;

interface WikidataEntity {
	claims: Record<string, WikidataClaim[]>;
	labels?: LangMap;
	descriptions?: LangMap;
	sitelinks?: Record<string, { url?: string }>;
}

interface WikidataClaim {
	mainsnak: {
		datavalue?: {
			type: string;
			// Entity refs carry `id`, quantities carry `amount`; other value shapes are ignored
			value?: { id?: string; amount?: string };
		};
	};
}

// Wikidata property IDs for structured data extraction
const PROPS = {
	CREATOR: 'P170',       // creator
	AUTHOR: 'P50',         // author
	DIRECTOR: 'P57',       // director
	DEVELOPER: 'P178',     // developer (for games)
	PUBLISHER: 'P123',     // publisher
	COUNTRY: 'P495',       // country of origin
	GENRE: 'P136',         // genre
	EPISODES: 'P1113',     // number of episodes
	SEASONS: 'P2437',      // number of seasons
	VOLUMES: 'P2635',      // number of volumes
	CHAPTERS: 'P4135',     // number of parts (chapters)
	PAGES: 'P1104',        // number of pages
	STATUS: 'P8345',       // media franchise status
	INSTANCE_OF: 'P31',    // instance of
	DURATION: 'P2047',     // duration
} as const;

const TYPE_KEYWORDS: Record<string, string[]> = {
	film: ['film', 'movie'],
	tv: ['television', 'tv', 'series'],
	anime: ['anime', 'animation', 'series'],
	manga: ['manga', 'comic', 'series'],
	manhwa: ['manhwa', 'comic', 'webtoon'],
	manhua: ['manhua', 'comic', 'webtoon'],
	comic: ['comic', 'graphic novel'],
	book: ['novel', 'book', 'series'],
	game: ['game', 'video game'],
};

/** Pick `lang`, else the fallback language, from a Wikidata language map. */
function pickLang(map: LangMap | undefined, lang: string): string | undefined {
	return map?.[lang]?.value ?? map?.[FALLBACK_LANG]?.value;
}

/**
 * Score Wikidata search hits by how well their description matches the media type
 * and whether the label equals the title. Returns the best hit's ID, or null when
 * nothing scored (so the caller can try a fuzzier search).
 */
export function pickBestMatch(
	hits: WikidataSearchHit[],
	title: string,
	type: MediaType,
): string | null {
	const typeKeywords = TYPE_KEYWORDS[type] || [];
	let bestMatch: WikidataSearchHit | null = null;
	let maxScore = 0;

	for (const item of hits) {
		let score = 0;
		const desc = (item.description || '').toLowerCase();

		if (desc) {
			for (const kw of typeKeywords) {
				if (desc.includes(kw)) score += 2;
			}
			// Bonus for 'franchise' or 'media' if it's broadly correct
			if (desc.includes('franchise') || desc.includes('media')) score += 1;
		}

		// A hit that doesn't look like this media type is never a match, however well the
		// label matches (e.g. "Vagabond" the Norwegian band for the manga)
		if (score === 0) continue;

		// Exact title match bonus
		if (item.label && item.label.toLowerCase() === title.toLowerCase()) {
			score += 1;
		}

		if (score > maxScore) {
			maxScore = score;
			bestMatch = item;
		}
	}

	return bestMatch?.id ?? null;
}

/**
 * Search Wikidata for the best matching entity for the given title + type.
 * Returns the Wikidata entity ID (Q-number) or null.
 */
async function findWikidataEntity(title: string, type: MediaType): Promise<string | null> {
	// Provider titles are English, so search in English regardless of display language
	const url = `${WIKIDATA_API}?action=wbsearchentities&search=${encodeURIComponent(title)}&language=${FALLBACK_LANG}&format=json&limit=10&origin=*`;
	const data = await fetchJson<{ search?: WikidataSearchHit[] }>(url, 8000);
	const hit = data.search?.length ? pickBestMatch(data.search, title, type) : null;

	// Fallback: If Wikidata exact search failed to find a good match, use Wikipedia's fuzzy full-text search
	return hit ?? (await fallbackWikipediaSearch(title, type));
}

/**
 * Bypasses Wikidata's precise label search by using Wikipedia's fuzzy full-text search,
 * then maps the top Wikipedia article to its corresponding Wikidata entity.
 */
async function fallbackWikipediaSearch(title: string, type: MediaType): Promise<string | null> {
	const typeSuffix: Record<string, string> = {
		film: 'film',
		tv: 'tv series',
		anime: 'anime',
		manga: 'manga',
		manhwa: 'manhwa',
		manhua: 'manhua',
		comic: 'comic',
		book: 'novel',
		game: 'video game',
	};

	const suffix = typeSuffix[type] ?? '';
	const searchQuery = `${title} ${suffix}`.trim();

	const wikiUrl = `https://${FALLBACK_LANG}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchQuery)}&utf8=&format=json&origin=*`;
	const wikiData = await fetchJson<{ query?: { search?: { title: string }[] } }>(wikiUrl, 8000);
	const topTitle = wikiData.query?.search?.[0]?.title;
	if (!topTitle) return null;

	// Map Wikipedia title to Wikidata ID
	const wdUrl = `${WIKIDATA_API}?action=wbgetentities&sites=${FALLBACK_LANG}wiki&titles=${encodeURIComponent(topTitle)}&props=info&format=json&origin=*`;
	const wdData = await fetchJson<{ entities?: Record<string, unknown> }>(wdUrl, 8000);
	const entityId = Object.keys(wdData.entities ?? {})[0];
	return entityId && entityId !== '-1' ? entityId : null;
}

/**
 * Fetch a Wikidata entity's claims, labels, descriptions and Wikipedia sitelinks.
 */
async function fetchWikidataEntity(entityId: string, lang: string): Promise<WikidataEntity | null> {
	const langs = [...new Set([lang, FALLBACK_LANG])];
	const url =
		`${WIKIDATA_API}?action=wbgetentities&ids=${entityId}` +
		`&props=claims|labels|descriptions|sitelinks/urls` +
		`&languages=${langs.join('|')}&sitefilter=${langs.map((l) => `${l}wiki`).join('|')}` +
		`&format=json&origin=*`;
	const data = await fetchJson<{ entities?: Record<string, WikidataEntity> }>(url, 8000);
	return data.entities?.[entityId] ?? null;
}

/**
 * Resolve several Wikidata entity IDs to labels in one request.
 */
async function resolveEntityLabels(ids: string[], lang: string): Promise<Map<string, string>> {
	const labels = new Map<string, string>();
	if (ids.length === 0) return labels;
	const langs = [...new Set([lang, FALLBACK_LANG])].join('|');
	const url = `${WIKIDATA_API}?action=wbgetentities&ids=${[...new Set(ids)].join('|')}&props=labels&languages=${langs}&format=json&origin=*`;
	const data = await fetchJson<{ entities?: Record<string, { labels?: LangMap }> }>(url, 5000);
	for (const [id, entity] of Object.entries(data.entities ?? {})) {
		const label = pickLang(entity.labels, lang);
		if (label) labels.set(id, label);
	}
	return labels;
}

/**
 * Extract a simple numeric quantity from a claim.
 */
function getQuantity(entity: WikidataEntity, prop: string): number | undefined {
	const claims = entity.claims[prop];
	if (!claims || claims.length === 0) return undefined;
	const value = claims[0]?.mainsnak?.datavalue?.value;
	if (value?.amount) {
		const num = parseInt(value.amount, 10);
		return isNaN(num) ? undefined : num;
	}
	return undefined;
}

/**
 * Extract entity ID reference from a claim (for properties that point to other entities).
 */
function getEntityRef(entity: WikidataEntity, prop: string): string | undefined {
	const claims = entity.claims[prop];
	if (!claims || claims.length === 0) return undefined;
	const value = claims[0]?.mainsnak?.datavalue?.value;
	if (value?.id) return value.id;
	return undefined;
}

/**
 * Extract multiple entity ID references from a claim.
 */
function getEntityRefs(entity: WikidataEntity, prop: string, limit = 3): string[] {
	const claims = entity.claims[prop];
	if (!claims) return [];
	return claims
		.slice(0, limit)
		.map((c) => c.mainsnak?.datavalue?.value?.id)
		.filter((id): id is string => !!id);
}

async function buildEnrichment(
	entityId: string,
	type: MediaType,
	lang: string,
): Promise<WikipediaEnrichment | null> {
	const entity = await fetchWikidataEntity(entityId, lang);
	if (!entity) return null;

	// Author / Creator / Director — depends on type
	const authorProp =
		type === 'film' ? PROPS.DIRECTOR :
		type === 'game' ? PROPS.DEVELOPER :
		type === 'book' || type === 'manga' || type === 'manhwa' || type === 'manhua' || type === 'comic' ? PROPS.AUTHOR :
		PROPS.CREATOR;

	const authorRef = getEntityRef(entity, authorProp) ?? getEntityRef(entity, PROPS.CREATOR);
	const countryRef = getEntityRef(entity, PROPS.COUNTRY);
	const genreRefs = getEntityRefs(entity, PROPS.GENRE, 3);
	const labels = await resolveEntityLabels(
		[authorRef, countryRef, ...genreRefs].filter((id): id is string => !!id),
		lang,
	);

	const genres = genreRefs.map((id) => labels.get(id)).filter((g): g is string => !!g);
	const sitelinks = entity.sitelinks ?? {};

	return {
		wikidataId: entityId,
		wikipediaUrl: sitelinks[`${lang}wiki`]?.url ?? sitelinks[`${FALLBACK_LANG}wiki`]?.url,
		author: authorRef ? labels.get(authorRef) : undefined,
		country: countryRef ? labels.get(countryRef) : undefined,
		genres: genres.length > 0 ? genres : undefined,
		description: pickLang(entity.descriptions, lang),
		totalEpisodes: getQuantity(entity, PROPS.EPISODES),
		totalSeasons: getQuantity(entity, PROPS.SEASONS),
		totalVolumes: getQuantity(entity, PROPS.VOLUMES),
		totalChapters: getQuantity(entity, PROPS.CHAPTERS),
		totalPages: getQuantity(entity, PROPS.PAGES),
		runtimeMinutes:
			type === 'film' || type === 'anime' ? getQuantity(entity, PROPS.DURATION) : undefined,
	};
}

/**
 * Main enrichment function — searches Wikidata for the title, fetches structured data,
 * and returns partial metadata to fill in gaps plus the Wikipedia article URL.
 *
 * `lang` selects the language of labels, descriptions and the article link (falling back
 * to English). Resolves to null when nothing matches — cached like any result. Rejects on
 * network failure (not cached), so callers can tell "no match" from "offline".
 */
export async function fetchWikidataEnrichment(
	title: string,
	type: MediaType,
	lang = FALLBACK_LANG,
): Promise<WikipediaEnrichment | null> {
	// Bump the version when matching changes so stale (possibly wrong) matches are dropped
	const cacheKey = `wikidata:v2:${lang}:${type}:${title.toLowerCase()}`;
	const { result } = await withCache(cacheKey, async () => {
		const entityId = await findWikidataEntity(title, type);
		return { result: entityId ? await buildEnrichment(entityId, type, lang) : null };
	});
	return result;
}
