import { getDb } from '../index';
import type { LocalMedia } from '$lib/types/mediaTypes';
import type { MediaSource, MediaType } from '$lib/db/schema';
import { v4 as uuidv4 } from 'uuid';

function rowToMedia(row: any): LocalMedia {
	let id, source, externalId, type, title, year, posterUrl, description,
		totalEpisodes, totalSeasons, platforms, totalPages;
	if (Array.isArray(row)) {
		[id, source, externalId, type, title, year, posterUrl, description,
			totalEpisodes, totalSeasons, platforms, totalPages] = row;
	} else {
		({ id, source, externalId, type, title, year, posterUrl, description,
			totalEpisodes, totalSeasons, platforms, totalPages } = row);
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
			 totalEpisodes, totalSeasons, platforms, totalPages)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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