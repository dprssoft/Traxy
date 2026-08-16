import { getDb } from '../index';
import type { CollectionResponseDto } from '$lib/types/collectionTypes';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_COLLECTION_NAME } from '$lib/constants';

function rowToCollection(row: any): CollectionResponseDto {
	let id, userId, name, description, privacyLevel, itemCount, createdAt, updatedAt;
	if (Array.isArray(row)) {
		[id, userId, name, description, privacyLevel, itemCount, createdAt, updatedAt] = row;
	} else {
		({ id, userId, name, description, privacyLevel, itemCount, createdAt, updatedAt } = row);
	}
	return {
		id, ownerId: userId, ownerUsername: 'local', name,
		description: description ?? undefined,
		privacyLevel: privacyLevel as 'public' | 'private',
		itemCount, createdAt,
	};
}

export async function getUserCollections(userId: string): Promise<CollectionResponseDto[]> {
	const db = getDb();
	const result = await db.query(
		`SELECT c.*, COUNT(ci.mediaId) as itemCount
		 FROM Collection c
		 LEFT JOIN CollectionItem ci ON c.id = ci.collectionId
		 WHERE c.userId = ?
		 GROUP BY c.id
		 ORDER BY c.createdAt ASC`,
		[userId],
	);
	if (!result.values) return [];
	return result.values.map(rowToCollection);
}

export async function getCollectionById(id: string): Promise<CollectionResponseDto | null> {
	const db = getDb();
	const result = await db.query(
		`SELECT c.*, COUNT(ci.mediaId) as itemCount
		 FROM Collection c
		 LEFT JOIN CollectionItem ci ON c.id = ci.collectionId
		 WHERE c.id = ?
		 GROUP BY c.id`,
		[id],
	);
	if (!result.values || result.values.length === 0) return null;
	return rowToCollection(result.values[0]);
}

export async function createCollection(
	userId: string,
	name: string,
	description?: string,
	privacyLevel: 'public' | 'private' = 'public',
): Promise<CollectionResponseDto> {
	const db = getDb();
	const id = uuidv4();
	const now = new Date().toISOString();

	await db.run(
		`INSERT INTO Collection (id, userId, name, description, privacyLevel, createdAt, updatedAt)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		[id, userId, name, description ?? null, privacyLevel, now, now],
	);

	return {
		id, ownerId: userId, ownerUsername: 'local', name, description, privacyLevel,
		itemCount: 0, createdAt: now,
	};
}

export async function deleteCollection(id: string): Promise<void> {
	const db = getDb();
	// Must not delete the default collection
	const collection = await getCollectionById(id);
	if (collection?.name === DEFAULT_COLLECTION_NAME) {
		throw new Error('Cannot delete the default collection');
	}

	await db.run('DELETE FROM CollectionItem WHERE collectionId = ?', [id]);
	await db.run('DELETE FROM Collection WHERE id = ?', [id]);
}

export async function getCollectionItemIds(collectionId: string): Promise<string[]> {
	const db = getDb();
	const result = await db.query('SELECT mediaId FROM CollectionItem WHERE collectionId = ?', [collectionId]);
	if (!result.values) return [];
	return result.values.map((row: any) => (Array.isArray(row) ? row[0] : Object.values(row)[0]) as string);
}

export async function addItemToCollection(collectionId: string, mediaId: string): Promise<void> {
	const db = getDb();
	const now = new Date().toISOString();
	await db.run(
		'INSERT OR IGNORE INTO CollectionItem (collectionId, mediaId, addedAt) VALUES (?, ?, ?)',
		[collectionId, mediaId, now],
	);
}

export async function removeItemFromCollection(collectionId: string, mediaId: string): Promise<void> {
	const db = getDb();
	await db.run(
		'DELETE FROM CollectionItem WHERE collectionId = ? AND mediaId = ?',
		[collectionId, mediaId],
	);
}

export async function initDefaultCollection(userId: string): Promise<void> {
	const db = getDb();
	const exists = await db.query(
		'SELECT 1 FROM Collection WHERE userId = ? AND name = ?',
		[userId, DEFAULT_COLLECTION_NAME],
	);
	if (!exists.values || exists.values.length === 0) {
		await createCollection(userId, DEFAULT_COLLECTION_NAME, 'My favorite media', 'public');
	}
}
