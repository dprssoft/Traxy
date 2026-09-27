import { getDb } from '../index';
import type { LocalMedia, MediaMetaPatch, SearchResult } from '$lib/types/mediaTypes';
import type { MediaSource, MediaType } from '$lib/db/schema';
import { v4 as uuidv4 } from 'uuid';
import { getTmdbDetails } from '../sources/tmdb';
import { fetchIgdbTimeToBeat, fetchIgdbTimeToBeatByTitle, getIgdbDetails } from '../sources/igdb';
import { getAnilistDetails } from '../sources/anilist';
import { getComicVineDetails } from '../sources/comicvine';
import { getOpenLibraryDetails } from '../sources/openlibrary';
import { getFlashpointDetails } from '../sources/flashpoint';

// Column names in the order defined in CREATE TABLE — used for positional→named conversion
export const MEDIA_COLUMNS = [
	'id',
	'source',
	'externalId',
	'type',
	'title',
	'year',
	'posterUrl',
	'description',
	'originalTitle',
	'serializationYears',
	'author',
	'country',
	'genres',
	'releaseStatus',
	'totalEpisodes',
	'totalSeasons',
	'totalVolumes',
	'totalChapters',
	'platforms',
	'totalPages',
	'seasonData',
	'timeToBeat',
	'runtimeMinutes',
	'isAdult',
	'wikiMeta',
];

/** Convert a `Media` row into a `LocalMedia`, parsing the JSON-encoded columns. */
// A Media row as stored: JSON columns are text, booleans are 0/1.
interface MediaRow {
	id: string;
	source: MediaSource;
	externalId: string;
	type: MediaType;
	title: string;
	year: number | null;
	posterUrl: string | null;
	description: string | null;
	originalTitle: string | null;
	serializationYears: string | null;
	author: string | null;
	country: string | null;
	genres: string | null;
	releaseStatus: string | null;
	totalEpisodes: number | null;
	totalSeasons: number | null;
	totalVolumes: number | null;
	totalChapters: number | null;
	platforms: string | null;
	totalPages: number | null;
	seasonData: string | null;
	timeToBeat: string | null;
	runtimeMinutes: number | null;
	isAdult: number | null;
	wikiMeta: string | null;
}

export function rowToMedia(row: unknown[] | Record<string, unknown>): LocalMedia {
	// Joined queries hand over positional slices; plain queries return named rows.
	const r = (Array.isArray(row)
		? Object.fromEntries(MEDIA_COLUMNS.map((col, i) => [col, row[i]]))
		: row) as unknown as MediaRow;

	return {
		id: r.id,
		source: r.source,
		externalId: r.externalId,
		type: r.type,
		title: r.title,
		year: r.year ?? undefined,
		posterUrl: r.posterUrl ?? undefined,
		description: r.description ?? undefined,
		originalTitle: r.originalTitle ?? undefined,
		serializationYears: r.serializationYears ?? undefined,
		author: r.author ?? undefined,
		country: r.country ?? undefined,
		genres: r.genres ? (JSON.parse(r.genres) as string[]) : undefined,
		releaseStatus: r.releaseStatus ?? undefined,
		totalEpisodes: r.totalEpisodes ?? undefined,
		totalSeasons: r.totalSeasons ?? undefined,
		totalVolumes: r.totalVolumes ?? undefined,
		totalChapters: r.totalChapters ?? undefined,
		platforms: r.platforms ? (JSON.parse(r.platforms) as string[]) : undefined,
		totalPages: r.totalPages ?? undefined,
		seasonData: r.seasonData ? JSON.parse(r.seasonData) : undefined,
		timeToBeat: r.timeToBeat ?? undefined,
		runtimeMinutes: r.runtimeMinutes ?? undefined,
		isAdult: r.isAdult == null ? undefined : Boolean(r.isAdult),
		wikiMeta: r.wikiMeta ? JSON.parse(r.wikiMeta) : undefined,
	};
}

/**
 * Insert or update a media record. Returns the stored record with its UUID.
 * If the (source, externalId) pair already exists, the existing record is
 * patched with any non-null fields from the incoming data (backfill), then returned.
 */
export async function upsertMedia(
	data: Omit<LocalMedia, 'id'> & { id?: string },
): Promise<LocalMedia> {
	const db = getDb();

	// Deduplicate on (source, externalId)
	const existing = await getMediaByExternalId(data.source, data.externalId);
	if (existing) {
		// Backfill any missing metadata fields from the freshly-fetched data
		const patch: Partial<LocalMedia> = {};
		if (!existing.author && data.author) patch.author = data.author;
		if (!existing.country && data.country) patch.country = data.country;
		if (!existing.releaseStatus && data.releaseStatus) patch.releaseStatus = data.releaseStatus;
		if ((!existing.genres || existing.genres.length === 0) && data.genres?.length)
			patch.genres = data.genres;
		if (!existing.originalTitle && data.originalTitle) patch.originalTitle = data.originalTitle;
		if (!existing.totalEpisodes && data.totalEpisodes) patch.totalEpisodes = data.totalEpisodes;
		if (!existing.totalSeasons && data.totalSeasons) patch.totalSeasons = data.totalSeasons;
		if (!existing.totalVolumes && data.totalVolumes) patch.totalVolumes = data.totalVolumes;
		if (!existing.totalChapters && data.totalChapters) patch.totalChapters = data.totalChapters;
		if (!existing.totalPages && data.totalPages) patch.totalPages = data.totalPages;
		if (!existing.seasonData && data.seasonData) patch.seasonData = data.seasonData;
		if (!existing.timeToBeat && data.timeToBeat) patch.timeToBeat = data.timeToBeat;
		if (!existing.runtimeMinutes && data.runtimeMinutes) patch.runtimeMinutes = data.runtimeMinutes;
		if (data.isAdult !== undefined && existing.isAdult !== data.isAdult)
			patch.isAdult = data.isAdult;
		if ((!existing.platforms || existing.platforms.length === 0) && data.platforms?.length)
			patch.platforms = data.platforms;

		if (Object.keys(patch).length > 0) {
			await updateMediaMeta(existing.id, patch);
			return { ...existing, ...patch };
		}
		return existing;
	}

	const id = data.id ?? uuidv4();
	await db.run(
		`INSERT OR REPLACE INTO Media
			(id, source, externalId, type, title, year, posterUrl, description,
			 originalTitle, serializationYears, author, country, genres, releaseStatus,
			 totalEpisodes, totalSeasons, totalVolumes, totalChapters,
			 platforms, totalPages, seasonData, timeToBeat, runtimeMinutes, isAdult)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			id,
			data.source,
			data.externalId,
			data.type,
			data.title,
			data.year ?? null,
			data.posterUrl ?? null,
			data.description ?? null,
			data.originalTitle ?? null,
			data.serializationYears ?? null,
			data.author ?? null,
			data.country ?? null,
			data.genres ? JSON.stringify(data.genres) : null,
			data.releaseStatus ?? null,
			data.totalEpisodes ?? null,
			data.totalSeasons ?? null,
			data.totalVolumes ?? null,
			data.totalChapters ?? null,
			data.platforms ? JSON.stringify(data.platforms) : null,
			data.totalPages ?? null,
			data.seasonData ? JSON.stringify(data.seasonData) : null,
			data.timeToBeat ?? null,
			data.runtimeMinutes ?? null,
			data.isAdult === undefined ? null : Number(data.isAdult),
		],
	);
	return { ...data, id };
}

/** Fetch a media record by its local UUID. */
export async function getMediaById(id: string): Promise<LocalMedia | null> {
	const db = getDb();
	const result = await db.query('SELECT * FROM Media WHERE id = ?', [id]);
	if (!result.values || result.values.length === 0) return null;
	return rowToMedia(result.values[0]);
}

/** Fetch a media record by its external API ID and source. Used to deduplicate search clicks. */
export async function getMediaByExternalId(
	source: MediaSource,
	externalId: string,
): Promise<LocalMedia | null> {
	const db = getDb();
	const result = await db.query('SELECT * FROM Media WHERE source = ? AND externalId = ?', [
		source,
		externalId,
	]);
	if (!result.values || result.values.length === 0) return null;
	return rowToMedia(result.values[0]);
}

/**
 * Fuzzy title search against locally cached media records.
 * Used for offline quick-search when APIs are unreachable.
 */
export async function searchLocalMedia(query: string): Promise<LocalMedia[]> {
	const db = getDb();
	const result = await db.query(
		'SELECT * FROM Media WHERE title LIKE ? ORDER BY title ASC LIMIT 20',
		[`%${query}%`],
	);
	if (!result.values) return [];
	return result.values.map(rowToMedia);
}

/**
 * Update metadata of an existing media record.
 * Doesn't replace user data, just API metadata fields. A null value clears the field.
 */
export async function updateMediaMeta(id: string, patch: MediaMetaPatch): Promise<void> {
	const db = getDb();
	const updates: string[] = [];
	const values: unknown[] = [];

	const fields = [
		'title',
		'year',
		'posterUrl',
		'description',
		'originalTitle',
		'serializationYears',
		'author',
		'country',
		'releaseStatus',
		'totalEpisodes',
		'totalSeasons',
		'totalVolumes',
		'totalChapters',
		'totalPages',
		'timeToBeat',
		'runtimeMinutes',
	];
	for (const field of fields) {
		if (patch[field as keyof LocalMedia] !== undefined) {
			updates.push(`${field} = ?`);
			values.push(patch[field as keyof LocalMedia] ?? null);
		}
	}

	if (patch.platforms !== undefined) {
		updates.push('platforms = ?');
		values.push(patch.platforms ? JSON.stringify(patch.platforms) : null);
	}

	if (patch.seasonData !== undefined) {
		updates.push('seasonData = ?');
		values.push(patch.seasonData ? JSON.stringify(patch.seasonData) : null);
	}

	if (patch.isAdult !== undefined) {
		updates.push('isAdult = ?');
		values.push(patch.isAdult === null ? null : Number(patch.isAdult));
	}

	if (patch.wikiMeta !== undefined) {
		updates.push('wikiMeta = ?');
		values.push(patch.wikiMeta ? JSON.stringify(patch.wikiMeta) : null);
	}

	if (patch.genres !== undefined) {
		updates.push('genres = ?');
		values.push(patch.genres ? JSON.stringify(patch.genres) : null);
	}

	if (updates.length === 0) return;

	values.push(id);
	await db.run(`UPDATE Media SET ${updates.join(', ')} WHERE id = ?`, values);
}

/** Fetch full details for an item from the provider it came from. Null for manual entries or on failure. */
export async function fetchProviderDetails(
	item: Pick<SearchResult, 'source' | 'externalId' | 'type'>,
): Promise<SearchResult | null> {
	switch (item.source) {
		case 'tmdb':
			return getTmdbDetails(item.externalId, item.type as 'film' | 'tv');
		case 'igdb':
			return getIgdbDetails(item.externalId);
		case 'anilist':
			return getAnilistDetails(parseInt(item.externalId));
		case 'comicvine':
			return getComicVineDetails(item.externalId);
		case 'openlibrary':
			return getOpenLibraryDetails(item.externalId);
		case 'flashpoint':
			return getFlashpointDetails(item.externalId);
		default:
			return null;
	}
}

/**
 * Return the local record for a search/catalogue result, importing it on first use:
 * full details are fetched from the provider (falling back to the result itself) and stored.
 */
export async function ensureLocalMedia(item: SearchResult): Promise<LocalMedia> {
	const existing = await getMediaByExternalId(item.source, item.externalId);
	if (existing) return existing;

	const fullDetails: SearchResult = (await fetchProviderDetails(item)) ?? item;
	return upsertMedia({ ...fullDetails, isAdult: fullDetails.isAdult ?? item.isAdult });
}

/**
 * Fill details that older rows or search results may lack — TV seasons, runtimes, and game
 * time-to-beat. Best effort: returns the (possibly updated) media, never throws.
 */
export async function fillMissingDetails(media: LocalMedia): Promise<LocalMedia> {
	const patch: MediaMetaPatch = {};
	try {
		if (
			(media.type === 'tv' && !media.seasonData) ||
			(media.type === 'film' && !media.runtimeMinutes)
		) {
			if (media.source === 'tmdb') {
				const details = await getTmdbDetails(media.externalId, media.type);
				if (details?.seasonData) {
					patch.totalSeasons = details.totalSeasons;
					patch.totalEpisodes = details.totalEpisodes;
					patch.seasonData = details.seasonData;
				}
				if (details?.runtimeMinutes) patch.runtimeMinutes = details.runtimeMinutes;
			}
		} else if (
			media.type === 'anime' &&
			media.source === 'anilist' &&
			(!media.seasonData || !media.runtimeMinutes)
		) {
			const details = await getAnilistDetails(parseInt(media.externalId));
			if (details?.seasonData) {
				patch.totalSeasons = details.totalSeasons;
				patch.seasonData = details.seasonData;
			}
			if (details?.runtimeMinutes) patch.runtimeMinutes = details.runtimeMinutes;
		} else if (media.type === 'game' && !media.timeToBeat) {
			const ttb =
				media.source === 'igdb'
					? await fetchIgdbTimeToBeat(media.externalId)
					: await fetchIgdbTimeToBeatByTitle(media.title);
			if (ttb) patch.timeToBeat = JSON.stringify(ttb);
		}
	} catch (e) {
		console.error('[media] filling missing details failed:', e);
	}

	if (Object.keys(patch).length === 0) return media;
	await updateMediaMeta(media.id, patch);
	return (await getMediaById(media.id)) ?? media;
}
