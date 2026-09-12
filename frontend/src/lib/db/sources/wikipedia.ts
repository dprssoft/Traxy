/**
 * Wikidata enrichment source — queries Wikidata's SPARQL endpoint
 * to fill in missing metadata (author, country, status, etc.).
 *
 * This is a supplementary source: it never replaces already-populated fields.
 * Requires the `feat_wikipedia_enrichment` feature flag to be enabled.
 */
import type { MediaType } from '$lib/db/schema';

const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';

export interface WikipediaEnrichment {
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

interface WikidataSearchResult {
	search: {
		id: string;
		label: string;
		description?: string;
	}[];
}

interface WikidataEntity {
	claims: Record<string, WikidataClaim[]>;
	labels?: Record<string, { value: string }>;
	descriptions?: Record<string, { value: string }>;
}

interface WikidataClaim {
	mainsnak: {
		datavalue?: {
			type: string;
			value: any;
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

/**
 * Search Wikidata for the best matching entity for the given title + type.
 * Returns the Wikidata entity ID (Q-number) or null.
 */
async function findWikidataEntity(
	title: string,
	type: MediaType,
): Promise<string | null> {
	// Build a type-specific search suffix for disambiguation
	const typeSuffix: Record<string, string> = {
		film: 'film',
		tv: 'television series',
		anime: 'anime',
		manga: 'manga',
		manhwa: 'manhwa',
		manhua: 'manhua',
		comic: 'comic book',
		book: 'novel',
		game: 'video game',
	};

	const suffix = typeSuffix[type] ?? '';
	const searchQuery = `${title} ${suffix}`.trim();

	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 8000);
		const url = `${WIKIDATA_API}?action=wbsearchentities&search=${encodeURIComponent(searchQuery)}&language=en&format=json&limit=5&origin=*`;
		const res = await fetch(url, { signal: controller.signal });
		clearTimeout(timeout);
		if (!res.ok) return null;

		const data: WikidataSearchResult = await res.json();
		if (!data.search || data.search.length === 0) return null;

		// Return the first result — Wikidata's relevance ranking is usually good
		return data.search[0].id;
	} catch {
		return null;
	}
}

/**
 * Fetch a Wikidata entity's structured claims.
 */
async function fetchWikidataEntity(entityId: string): Promise<WikidataEntity | null> {
	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 8000);
		const url = `${WIKIDATA_API}?action=wbgetentities&ids=${entityId}&props=claims|labels|descriptions&languages=en&format=json&origin=*`;
		const res = await fetch(url, { signal: controller.signal });
		clearTimeout(timeout);
		if (!res.ok) return null;

		const data = await res.json();
		return data.entities?.[entityId] ?? null;
	} catch {
		return null;
	}
}

/**
 * Resolve a Wikidata entity ID (Q-number) to its English label.
 */
async function resolveEntityLabel(entityId: string): Promise<string | null> {
	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 5000);
		const url = `${WIKIDATA_API}?action=wbgetentities&ids=${entityId}&props=labels&languages=en&format=json&origin=*`;
		const res = await fetch(url, { signal: controller.signal });
		clearTimeout(timeout);
		if (!res.ok) return null;

		const data = await res.json();
		return data.entities?.[entityId]?.labels?.en?.value ?? null;
	} catch {
		return null;
	}
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

/**
 * Main enrichment function — searches Wikidata for the title, fetches structured data,
 * and returns partial metadata to fill in gaps.
 */
export async function fetchWikidataEnrichment(
	title: string,
	type: MediaType,
): Promise<WikipediaEnrichment | null> {
	const entityId = await findWikidataEntity(title, type);
	if (!entityId) return null;

	const entity = await fetchWikidataEntity(entityId);
	if (!entity) return null;

	const result: WikipediaEnrichment = {};

	// Author / Creator / Director — depends on type
	const authorProp =
		type === 'film' ? PROPS.DIRECTOR :
		type === 'game' ? PROPS.DEVELOPER :
		type === 'book' || type === 'manga' || type === 'manhwa' || type === 'manhua' || type === 'comic' ? PROPS.AUTHOR :
		PROPS.CREATOR;

	const authorRef = getEntityRef(entity, authorProp) ?? getEntityRef(entity, PROPS.CREATOR);
	if (authorRef) {
		const label = await resolveEntityLabel(authorRef);
		if (label) result.author = label;
	}

	// Country of origin
	const countryRef = getEntityRef(entity, PROPS.COUNTRY);
	if (countryRef) {
		const label = await resolveEntityLabel(countryRef);
		if (label) result.country = label;
	}

	// Genres
	const genreRefs = getEntityRefs(entity, PROPS.GENRE, 3);
	if (genreRefs.length > 0) {
		const genreLabels = await Promise.all(genreRefs.map(resolveEntityLabel));
		const genres = genreLabels.filter((g): g is string => !!g);
		if (genres.length > 0) result.genres = genres;
	}

	// Numeric fields
	result.totalEpisodes = getQuantity(entity, PROPS.EPISODES);
	result.totalSeasons = getQuantity(entity, PROPS.SEASONS);
	result.totalVolumes = getQuantity(entity, PROPS.VOLUMES);
	result.totalChapters = getQuantity(entity, PROPS.CHAPTERS);
	result.totalPages = getQuantity(entity, PROPS.PAGES);
	if (type === 'film' || type === 'anime') {
		result.runtimeMinutes = getQuantity(entity, PROPS.DURATION);
	}

	// Description from Wikidata
	const desc = entity.descriptions?.en?.value;
	if (desc) result.description = desc;

	// Only return if we actually found useful data
	const hasData = Object.values(result).some((v) => v !== undefined);
	return hasData ? result : null;
}
