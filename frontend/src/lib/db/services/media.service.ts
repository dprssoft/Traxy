import { getDb } from '../index';
import type { LocalMedia } from '$lib/types/mediaTypes';
import type { MediaSource, MediaType } from '$lib/db/schema';
import { v4 as uuidv4 } from 'uuid';

function rowToMedia(row: any): LocalMedia {
	let id, source, externalId, type, title, year, posterUrl, description,
		totalEpisodes, totalSeasons, platforms, totalPages, seasonData;
	if (Array.isArray(row)) {
		[id, source, externalId, type, title, year, posterUrl, description,
			totalEpisodes, totalSeasons, platforms, totalPages, seasonData] = row;
	} else {
		({ id, source, externalId, type, title, year, posterUrl, description,
			totalEpisodes, totalSeasons, platforms, totalPages, seasonData } = row);
	}
	return {
		id,
		source: source as MediaSource,
		externalId,
		type: type as MediaType,
		title,
		year: year ?? undefined,
		posterUrl: posterUrl ?? undefined,
		description: description ?? undefined,
		totalEpisodes: totalEpisodes ?? undefined,
		totalSeasons: totalSeasons ?? undefined,
		platforms: platforms ? (JSON.parse(platforms) as string[]) : undefined,
		totalPages: totalPages ?? undefined,
		seasonData: seasonData ? JSON.parse(seasonData) : undefined,
	};
}

/**
 * Insert or update a media record. Returns the stored record with its UUID.
 * If the (source, externalId) pair already exists, returns the existing record unchanged.
 */
export async function upsertMedia(data: Omit<LocalMedia, 'id'> & { id?: string }): Promise<LocalMedia> {
	const db = getDb();

	// Deduplicate on (source, externalId)
	const existing = await getMediaByExternalId(data.source, data.externalId);
	if (existing) return existing;

	const id = data.id ?? uuidv4();
	await db.run(
		`INSERT OR REPLACE INTO Media
			(id, source, externalId, type, title, year, posterUrl, description,
			 totalEpisodes, totalSeasons, platforms, totalPages, seasonData)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			id,
			data.source,
			data.externalId,
			data.type,
			data.title,
			data.year ?? null,
			data.posterUrl ?? null,
			data.description ?? null,
			data.totalEpisodes ?? null,
			data.totalSeasons ?? null,
			data.platforms ? JSON.stringify(data.platforms) : null,
			data.totalPages ?? null,
			data.seasonData ? JSON.stringify(data.seasonData) : null,
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
	
	const fields = ['title', 'year', 'posterUrl', 'description', 'totalEpisodes', 'totalSeasons', 'totalPages'];
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

	if (updates.length === 0) return;
	
	values.push(id);
	await db.run(`UPDATE Media SET ${updates.join(', ')} WHERE id = ?`, values);
}