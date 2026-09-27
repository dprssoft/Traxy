import type { MediaType, MediaSource, MediaSeasonData } from '$lib/db/schema';

export type { MediaType, MediaSource, MediaSeasonData };

/** A media record stored in the local SQLite database. */
export interface LocalMedia {
	id: string; // UUID
	source: MediaSource;
	externalId: string;
	type: MediaType;
	title: string;
	year?: number;
	posterUrl?: string;
	description?: string;
	originalTitle?: string;
	serializationYears?: string;
	author?: string;
	country?: string;
	genres?: string[];
	releaseStatus?: string;
	// TV / Anime
	totalEpisodes?: number;
	totalSeasons?: number;
	// Manga / Comic
	totalVolumes?: number;
	totalChapters?: number;
	// Game
	platforms?: string[]; // parsed from JSON
	timeToBeat?: string;
	// Book
	totalPages?: number;
	seasonData?: MediaSeasonData[];
	runtimeMinutes?: number;
	/** Adult (18+) content, as flagged by the provider or keyword heuristics. */
	isAdult?: boolean;
	/** Which fields Wikidata enrichment filled in, so a wrong match can be undone. */
	wikiMeta?: WikiMeta;
	/** Details were stripped (slim backup restore, cache clear) and load on the next page visit. */
	detailsPending?: boolean;
}

/** Absent until the first Wikidata check; `wikidataId: null` means checked, no match. */
export interface WikiMeta {
	wikidataId: string | null;
	fields: string[];
}

/** A metadata patch for updateMediaMeta(): undefined leaves a field alone, null clears it. */
export type MediaMetaPatch = { [K in keyof LocalMedia]?: LocalMedia[K] | null };

/**
 * Transient result shape returned by source adapters (tmdb, anilist, etc.).
 * Not persisted directly — upsertMedia() converts this to LocalMedia.
 */
export interface SearchResult {
	externalId: string;
	source: MediaSource;
	type: MediaType;
	title: string;
	originalTitle?: string;
	year?: number;
	serializationYears?: string;
	author?: string;
	country?: string;
	genres?: string[];
	releaseStatus?: string;
	posterUrl?: string;
	description?: string;
	// Type-specific extras
	totalEpisodes?: number;
	totalSeasons?: number;
	totalVolumes?: number;
	totalChapters?: number;
	totalPages?: number;
	platforms?: string[];
	timeToBeat?: string;
	seasonData?: MediaSeasonData[];
	runtimeMinutes?: number;
	/** Adult (18+) content, as flagged by the provider or keyword heuristics. */
	isAdult?: boolean;
}
