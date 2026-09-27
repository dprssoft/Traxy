import { getDb } from '../index';
import type { MediaType } from '$lib/db/schema';
import type { LocalMedia } from '$lib/types/mediaTypes';
import type {
	CollectionEntry,
	CollectionInput,
	CollectionSummary,
	SystemCollectionKey,
} from '$lib/types/collectionTypes';
import { v4 as uuidv4 } from 'uuid';
import { getSystemCollectionName, WISHLIST_MEDIA_TYPES } from '$lib/constants';
import { logActivity } from './activity.service';
import { getMediaById, rowToMedia } from './media.service';

const COVER_COUNT = 4;

interface CollectionRow {
	id: string;
	name: string;
	description: string | null;
	createdAt: string;
	updatedAt: string | null;
	mediaType: MediaType | null;
	systemKey: SystemCollectionKey | null;
	isRanked: number | null;
	itemCount: number;
}

const SUMMARY_SELECT = `
	SELECT c.id, c.name, c.description, c.createdAt, c.updatedAt, c.mediaType, c.systemKey,
		c.isRanked, (SELECT COUNT(*) FROM CollectionItem ci WHERE ci.collectionId = c.id) AS itemCount
	FROM Collection c`;

// System collections first (favorites before wishlist), then user collections oldest-first.
const SUMMARY_ORDER = `
	ORDER BY CASE c.systemKey WHEN 'favorites' THEN 0 WHEN 'wishlist' THEN 1 ELSE 2 END,
		c.sortOrder, c.createdAt`;

function rowToSummary(row: CollectionRow, coverUrls: string[] = []): CollectionSummary {
	return {
		id: row.id,
		// System names are derived so label changes reach existing databases.
		name:
			row.systemKey && row.mediaType
				? getSystemCollectionName(row.systemKey, row.mediaType)
				: row.name,
		description: row.description ?? undefined,
		mediaType: row.mediaType ?? null,
		systemKey: row.systemKey ?? null,
		isRanked: Boolean(row.isRanked),
		itemCount: Number(row.itemCount ?? 0),
		coverUrls,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt ?? row.createdAt,
	};
}

async function loadCovers(collectionIds: string[]): Promise<Map<string, string[]>> {
	const covers = new Map<string, string[]>();
	if (collectionIds.length === 0) return covers;
	const placeholders = collectionIds.map(() => '?').join(',');
	const result = await getDb().query(
		`SELECT ci.collectionId, m.posterUrl FROM CollectionItem ci
		 JOIN Media m ON m.id = ci.mediaId
		 WHERE ci.collectionId IN (${placeholders}) AND m.posterUrl IS NOT NULL
		 ORDER BY ci.sortOrder, ci.addedAt`,
		collectionIds,
	);
	for (const row of (result.values ?? []) as { collectionId: string; posterUrl: string }[]) {
		const urls = covers.get(row.collectionId) ?? [];
		if (urls.length < COVER_COUNT) urls.push(row.posterUrl);
		covers.set(row.collectionId, urls);
	}
	return covers;
}

async function querySummaries(where = '', params: string[] = []): Promise<CollectionSummary[]> {
	const result = await getDb().query(`${SUMMARY_SELECT} ${where} ${SUMMARY_ORDER}`, params);
	const rows = (result.values ?? []) as CollectionRow[];
	const covers = await loadCovers(rows.map((r) => r.id));
	return rows.map((r) => rowToSummary(r, covers.get(r.id)));
}

async function requireCollection(id: string): Promise<CollectionSummary> {
	const collection = await getCollection(id);
	if (!collection) throw new Error(`Collection ${id} not found`);
	return collection;
}

async function requireMedia(mediaId: string): Promise<LocalMedia> {
	const media = await getMediaById(mediaId);
	if (!media) throw new Error(`Media ${mediaId} not found`);
	return media;
}

/** Whether a collection accepts media of the given type. */
export function acceptsMediaType(collection: CollectionSummary, type: MediaType): boolean {
	return collection.mediaType === null || collection.mediaType === type;
}

/**
 * All collections, system ones first. With `mediaType`, only collections that can hold that
 * type (shared ones plus that type's own).
 */
export async function listCollections(
	opts: { mediaType?: MediaType } = {},
): Promise<CollectionSummary[]> {
	if (opts.mediaType) {
		return querySummaries('WHERE c.mediaType IS NULL OR c.mediaType = ?', [opts.mediaType]);
	}
	return querySummaries();
}

/** One collection with item count and cover posters, or null. */
export async function getCollection(id: string): Promise<CollectionSummary | null> {
	const [collection] = await querySummaries('WHERE c.id = ?', [id]);
	return collection ?? null;
}

/** Items of a collection in their stored (manual) order. */
export async function getCollectionEntries(collectionId: string): Promise<CollectionEntry[]> {
	const result = await getDb().query(
		`SELECT m.*, ci.id AS itemId, ci.sortOrder AS itemSortOrder, ci.addedAt AS itemAddedAt,
			ci.note AS itemNote
		 FROM CollectionItem ci JOIN Media m ON m.id = ci.mediaId
		 WHERE ci.collectionId = ?
		 ORDER BY ci.sortOrder, ci.addedAt`,
		[collectionId],
	);
	return ((result.values ?? []) as Record<string, unknown>[]).map((row) => ({
		itemId: row.itemId as string,
		media: rowToMedia(row),
		sortOrder: Number(row.itemSortOrder ?? 0),
		addedAt: row.itemAddedAt as string,
		note: (row.itemNote as string | null) ?? undefined,
	}));
}

/** Create a user collection. A null `mediaType` makes it mixed (any type). */
export async function createCollection(input: CollectionInput): Promise<CollectionSummary> {
	const name = input.name.trim();
	if (!name) throw new Error('Collection name is required');
	const id = uuidv4();
	const now = new Date().toISOString();
	await getDb().run(
		`INSERT INTO Collection (id, name, description, createdAt, updatedAt, mediaType, systemKey, isRanked, sortOrder)
		 VALUES (?, ?, ?, ?, ?, ?, NULL, ?, 0)`,
		[
			id,
			name,
			input.description?.trim() || null,
			now,
			now,
			input.mediaType,
			Number(input.isRanked ?? false),
		],
	);
	await logActivity({
		eventType: 'collection_created',
		payload: {
			collectionName: name,
			collectionType: input.mediaType ? 'mono' : 'mixed',
			collectionMediaType: input.mediaType ?? undefined,
		},
	});
	return requireCollection(id);
}

/**
 * Update a collection. System collections keep their name and type; only the description and
 * ranking can change. Narrowing the type is refused while items of another type are inside.
 */
export async function updateCollection(
	id: string,
	patch: Partial<CollectionInput>,
): Promise<CollectionSummary> {
	const current = await requireCollection(id);
	if (current.systemKey && (patch.name !== undefined || patch.mediaType !== undefined)) {
		throw new Error('System collections cannot be renamed or retyped');
	}
	const name = patch.name?.trim() ?? current.name;
	if (!name) throw new Error('Collection name is required');

	const mediaType = patch.mediaType === undefined ? current.mediaType : patch.mediaType;
	if (mediaType && mediaType !== current.mediaType) {
		const conflicts = await getDb().query(
			`SELECT 1 FROM CollectionItem ci JOIN Media m ON m.id = ci.mediaId
			 WHERE ci.collectionId = ? AND m.type != ? LIMIT 1`,
			[id, mediaType],
		);
		if (conflicts.values?.length) {
			throw new Error('Collection has items of another media type');
		}
	}

	const description =
		patch.description === undefined
			? (current.description ?? null)
			: patch.description.trim() || null;
	const isRanked = patch.isRanked ?? current.isRanked;
	await getDb().run(
		`UPDATE Collection SET name = ?, description = ?, mediaType = ?, isRanked = ?, updatedAt = ?
		 WHERE id = ?`,
		[
			current.systemKey ? current.name : name,
			description,
			mediaType,
			Number(isRanked),
			new Date().toISOString(),
			id,
		],
	);
	return requireCollection(id);
}

/** Delete a user collection and its items (not the media). System collections are refused. */
export async function deleteCollection(id: string): Promise<void> {
	const collection = await requireCollection(id);
	if (collection.systemKey) throw new Error('System collections cannot be deleted');
	const db = getDb();
	await db.run('DELETE FROM CollectionItem WHERE collectionId = ?', [id]);
	await db.run('DELETE FROM Collection WHERE id = ?', [id]);
}

/** Get (creating on first use) a system collection for a media type. */
export async function ensureSystemCollection(
	key: SystemCollectionKey,
	type: MediaType,
): Promise<CollectionSummary> {
	if (key === 'wishlist' && !WISHLIST_MEDIA_TYPES.includes(type)) {
		throw new Error(`No wishlist for media type ${type}`);
	}
	const [existing] = await querySummaries('WHERE c.systemKey = ? AND c.mediaType = ?', [key, type]);
	if (existing) return existing;

	const id = uuidv4();
	const now = new Date().toISOString();
	await getDb().run(
		`INSERT INTO Collection (id, name, createdAt, updatedAt, mediaType, systemKey, isRanked, sortOrder)
		 VALUES (?, ?, ?, ?, ?, ?, 0, 0)`,
		[id, getSystemCollectionName(key, type), now, now, type, key],
	);
	return requireCollection(id);
}

/** The system collections a media type has: always Favorites, plus Wishlist where supported. */
export async function ensureSystemCollectionsFor(type: MediaType): Promise<CollectionSummary[]> {
	const keys: SystemCollectionKey[] = WISHLIST_MEDIA_TYPES.includes(type)
		? ['favorites', 'wishlist']
		: ['favorites'];
	const collections: CollectionSummary[] = [];
	for (const key of keys) collections.push(await ensureSystemCollection(key, type));
	return collections;
}

/**
 * Collections to offer when adding this media: its system collections first, then every
 * collection that accepts its type. Other types' collections are left out.
 */
export async function listCollectionsForPicker(type: MediaType): Promise<CollectionSummary[]> {
	await ensureSystemCollectionsFor(type);
	return listCollections({ mediaType: type });
}

/** Add media to a collection. Returns false if it was already there. */
export async function addToCollection(collectionId: string, mediaId: string): Promise<boolean> {
	const collection = await requireCollection(collectionId);
	const media = await requireMedia(mediaId);
	if (!acceptsMediaType(collection, media.type)) {
		throw new Error(`${collection.name} only holds ${collection.mediaType} items`);
	}

	const db = getDb();
	const max = await db.query(
		'SELECT COALESCE(MAX(sortOrder), -1) AS maxOrder FROM CollectionItem WHERE collectionId = ?',
		[collectionId],
	);
	const nextOrder =
		Number((max.values?.[0] as { maxOrder: number } | undefined)?.maxOrder ?? -1) + 1;
	const result = await db.run(
		`INSERT OR IGNORE INTO CollectionItem (id, collectionId, mediaId, sortOrder, addedAt)
		 VALUES (?, ?, ?, ?, ?)`,
		[uuidv4(), collectionId, mediaId, nextOrder, new Date().toISOString()],
	);
	const inserted = (result.changes?.changes ?? 0) > 0;
	if (inserted) {
		await logActivity({
			mediaId,
			mediaTitle: media.title,
			mediaPosterUrl: media.posterUrl,
			mediaType: media.type,
			eventType: 'added_to_collection',
			payload: { collectionName: collection.name },
		});
	}
	return inserted;
}

/** Remove media from a collection. Returns false if it wasn't there. */
export async function removeFromCollection(
	collectionId: string,
	mediaId: string,
): Promise<boolean> {
	const collection = await requireCollection(collectionId);
	const result = await getDb().run(
		'DELETE FROM CollectionItem WHERE collectionId = ? AND mediaId = ?',
		[collectionId, mediaId],
	);
	const removed = (result.changes?.changes ?? 0) > 0;
	if (removed) {
		const media = await getMediaById(mediaId);
		await logActivity({
			mediaId,
			mediaTitle: media?.title ?? mediaId,
			mediaPosterUrl: media?.posterUrl,
			mediaType: media?.type,
			eventType: 'removed_from_collection',
			payload: { collectionName: collection.name },
		});
	}
	return removed;
}

/** Ids of every collection containing this media. */
export async function getCollectionIdsForMedia(mediaId: string): Promise<string[]> {
	const result = await getDb().query('SELECT collectionId FROM CollectionItem WHERE mediaId = ?', [
		mediaId,
	]);
	return ((result.values ?? []) as { collectionId: string }[]).map((r) => r.collectionId);
}

/** Every collection containing this media, system ones first. */
export async function getCollectionsForMedia(mediaId: string): Promise<CollectionSummary[]> {
	return querySummaries(
		'WHERE c.id IN (SELECT collectionId FROM CollectionItem WHERE mediaId = ?)',
		[mediaId],
	);
}

/** Whether media is in its Favorites or Wishlist. */
export async function isInSystemCollection(
	key: SystemCollectionKey,
	mediaId: string,
): Promise<boolean> {
	const result = await getDb().query(
		`SELECT 1 FROM CollectionItem ci JOIN Collection c ON c.id = ci.collectionId
		 WHERE c.systemKey = ? AND ci.mediaId = ? LIMIT 1`,
		[key, mediaId],
	);
	return (result.values?.length ?? 0) > 0;
}

/** Flip media in or out of its Favorites / Wishlist. Returns the new membership. */
export async function toggleSystemCollection(
	key: SystemCollectionKey,
	media: Pick<LocalMedia, 'id' | 'type'>,
): Promise<boolean> {
	const collection = await ensureSystemCollection(key, media.type);
	if (await isInSystemCollection(key, media.id)) {
		await removeFromCollection(collection.id, media.id);
		return false;
	}
	await addToCollection(collection.id, media.id);
	return true;
}

/** Persist a manual order: `mediaIds` from first to last. */
export async function reorderCollection(collectionId: string, mediaIds: string[]): Promise<void> {
	const db = getDb();
	for (const [index, mediaId] of mediaIds.entries()) {
		await db.run('UPDATE CollectionItem SET sortOrder = ? WHERE collectionId = ? AND mediaId = ?', [
			index,
			collectionId,
			mediaId,
		]);
	}
	await db.run('UPDATE Collection SET updatedAt = ? WHERE id = ?', [
		new Date().toISOString(),
		collectionId,
	]);
}

/** Set or clear the per-item note (e.g. a price or store for a wishlist game). */
export async function updateEntryNote(
	collectionId: string,
	mediaId: string,
	note: string,
): Promise<void> {
	await getDb().run('UPDATE CollectionItem SET note = ? WHERE collectionId = ? AND mediaId = ?', [
		note.trim() || null,
		collectionId,
		mediaId,
	]);
}
