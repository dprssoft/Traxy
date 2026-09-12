import { getDb } from '../index';
import type { LocalMedia } from '$lib/types/mediaTypes';
import type { MediaSource, MediaType } from '$lib/db/schema';
import { v4 as uuidv4 } from 'uuid';

// Column names in the order defined in CREATE TABLE — used for positional→named conversion
const MEDIA_COLUMNS = [
	'id', 'source', 'externalId', 'type', 'title', 'year', 'posterUrl', 'description',
	'originalTitle', 'serializationYears', 'author', 'country', 'genres', 'releaseStatus',
	'totalEpisodes', 'totalSeasons', 'totalVolumes', 'totalChapters',
	'platforms', 'totalPages', 'seasonData', 'timeToBeat', 'runtimeMinutes',
];

function rowToMedia(row: any): LocalMedia {
	// capacitor-community/sqlite may return rows as arrays (positional) or objects (named).
	// Normalise to a plain object keyed by column name so we never rely on ordering.
	let r: Record<string, any>;
	if (Array.isArray(row)) {
		r = {};
		MEDIA_COLUMNS.forEach((col, i) => { r[col] = row[i]; });
		// If the DB has more columns than our list (e.g. from older schema), extras are ignored.
		// If the row has fewer entries (older DB without ALTER TABLE cols yet), extras default to undefined.
	} else {
		r = row as Record<string, any>;
	}

	return {
		id: r.id,
		source: r.source as MediaSource,
		externalId: r.externalId,
		type: r.type as MediaType,
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
	};
}

/**
 * Insert or update a media record. Returns the stored record with its UUID.
 * If the (source, externalId) pair already exists, the existing record is
 * patched with any non-null fields from the incoming data (backfill), then returned.
 */
export async function upsertMedia(data: Omit<LocalMedia, 'id'> & { id?: string }): Promise<LocalMedia> {
	const db = getDb();

	// Deduplicate on (source, externalId)
	const existing = await getMediaByExternalId(data.source, data.externalId);
	if (existing) {
		// Backfill any missing metadata fields from the freshly-fetched data
		const patch: Partial<LocalMedia> = {};
		if (!existing.author && data.author) patch.author = data.author;
		if (!existing.country && data.country) patch.country = data.country;
		if (!existing.releaseStatus && data.releaseStatus) patch.releaseStatus = data.releaseStatus;
		if ((!existing.genres || existing.genres.length === 0) && data.genres?.length) patch.genres = data.genres;
		if (!existing.originalTitle && data.originalTitle) patch.originalTitle = data.originalTitle;
		if (!existing.totalEpisodes && data.totalEpisodes) patch.totalEpisodes = data.totalEpisodes;
		if (!existing.totalSeasons && data.totalSeasons) patch.totalSeasons = data.totalSeasons;
		if (!existing.totalVolumes && data.totalVolumes) patch.totalVolumes = data.totalVolumes;
		if (!existing.totalChapters && data.totalChapters) patch.totalChapters = data.totalChapters;
		if (!existing.totalPages && data.totalPages) patch.totalPages = data.totalPages;
		if (!existing.seasonData && data.seasonData) patch.seasonData = data.seasonData;
		if (!existing.timeToBeat && data.timeToBeat) patch.timeToBeat = data.timeToBeat;
		if (!existing.runtimeMinutes && data.runtimeMinutes) patch.runtimeMinutes = data.runtimeMinutes;
		if ((!existing.platforms || existing.platforms.length === 0) && data.platforms?.length) patch.platforms = data.platforms;

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
			 platforms, totalPages, seasonData, timeToBeat, runtimeMinutes)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
	const result = await db.query(
		'SELECT * FROM Media WHERE source = ? AND externalId = ?',
		[source, externalId],
	);
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
 * Doesn't replace user data, just API metadata fields.
 */
export async function updateMediaMeta(id: string, patch: Partial<LocalMedia>): Promise<void> {
	const db = getDb();
	const updates: string[] = [];
	const values: any[] = [];
	
	const fields = [
		'title', 'year', 'posterUrl', 'description',
		'originalTitle', 'serializationYears', 'author', 'country', 'releaseStatus',
		'totalEpisodes', 'totalSeasons', 'totalVolumes', 'totalChapters', 'totalPages', 'timeToBeat',
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

	if (patch.genres !== undefined) {
		updates.push('genres = ?');
		values.push(patch.genres ? JSON.stringify(patch.genres) : null);
	}

	if (updates.length === 0) return;
	
	values.push(id);
	await db.run(`UPDATE Media SET ${updates.join(', ')} WHERE id = ?`, values);
}