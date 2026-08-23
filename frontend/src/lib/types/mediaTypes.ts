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
	// TV / Anime
	totalEpisodes?: number;
	totalSeasons?: number;
	// Game
	platforms?: string[]; // parsed from JSON
	// Book
	totalPages?: number;
	seasonData?: MediaSeasonData[];
}

/**
 * Transient result shape returned by source adapters (tmdb, anilist, etc.).
 * Not persisted directly — upsertMedia() converts this to LocalMedia.
 */
export interface SearchResult {
	externalId: string;
	source: MediaSource;
	type: MediaType;
	title: string;
	year?: number;
	posterUrl?: string;
	description?: string;
	// Type-specific extras
	totalEpisodes?: number;
	totalSeasons?: number;
	totalPages?: number;
	platforms?: string[];
	seasonData?: MediaSeasonData[];
}
