import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SQLiteDBConnection } from '@capacitor-community/sqlite';
import { createTestDb } from '../testDb';
import {
	addToCollection,
	createCollection,
	deleteCollection,
	ensureSystemCollection,
	getCollection,
	getCollectionEntries,
	getCollectionsForMedia,
	isInSystemCollection,
	listCollections,
	listCollectionsForPicker,
	removeFromCollection,
	reorderCollection,
	toggleSystemCollection,
	updateCollection,
	updateEntryNote,
} from './collection.service';

let db: SQLiteDBConnection;

vi.mock('../index', async (importOriginal) => ({
	...(await importOriginal<typeof import('../index')>()),
	getDb: () => db,
}));

async function seedMedia(id: string, type: string, posterUrl: string | null = `${id}.jpg`) {
	await db.run(
		"INSERT INTO Media (id, source, externalId, type, title, posterUrl) VALUES (?, 'manual', ?, ?, ?, ?)",
		[id, id, type, `Title ${id}`, posterUrl],
	);
}

async function activityEvents(): Promise<string[]> {
	const result = await db.query('SELECT eventType FROM ActivityLog ORDER BY rowid');
	return (result.values as { eventType: string }[]).map((r) => r.eventType);
}

beforeEach(async () => {
	db = await createTestDb();
	await seedMedia('g1', 'game');
	await seedMedia('g2', 'game');
	await seedMedia('f1', 'film');
});

describe('collections CRUD', () => {
	it('creates shared and typed collections and logs creation', async () => {
		const shared = await createCollection({ name: '  Comfort  ', mediaType: null });
		const games = await createCollection({ name: 'RPGs', mediaType: 'game', isRanked: true });

		expect(shared).toMatchObject({ name: 'Comfort', mediaType: null, systemKey: null, itemCount: 0 });
		expect(games).toMatchObject({ mediaType: 'game', isRanked: true });
		expect(await activityEvents()).toEqual(['collection_created', 'collection_created']);
	});

	it('rejects an empty name', async () => {
		await expect(createCollection({ name: '  ', mediaType: null })).rejects.toThrow();
	});

	it('updates name, description and ranking', async () => {
		const c = await createCollection({ name: 'A', mediaType: null });
		const updated = await updateCollection(c.id, { name: 'B', description: 'desc', isRanked: true });
		expect(updated).toMatchObject({ name: 'B', description: 'desc', isRanked: true });
	});

	it('refuses to narrow the type while other types are inside', async () => {
		const c = await createCollection({ name: 'Mixed', mediaType: null });
		await addToCollection(c.id, 'g1');
		await addToCollection(c.id, 'f1');
		await expect(updateCollection(c.id, { mediaType: 'game' })).rejects.toThrow(/another media type/);

		await removeFromCollection(c.id, 'f1');
		expect((await updateCollection(c.id, { mediaType: 'game' })).mediaType).toBe('game');
	});

	it('deletes a user collection with its items', async () => {
		const c = await createCollection({ name: 'Temp', mediaType: null });
		await addToCollection(c.id, 'g1');
		await deleteCollection(c.id);
		expect(await getCollection(c.id)).toBeNull();
		expect((await db.query('SELECT * FROM CollectionItem')).values).toEqual([]);
	});
});

describe('items', () => {
	it('adds items in order, ignores duplicates and logs once', async () => {
		const c = await createCollection({ name: 'Mixed', mediaType: null });
		expect(await addToCollection(c.id, 'g1')).toBe(true);
		expect(await addToCollection(c.id, 'f1')).toBe(true);
		expect(await addToCollection(c.id, 'g1')).toBe(false);

		const entries = await getCollectionEntries(c.id);
		expect(entries.map((e) => [e.media.id, e.sortOrder])).toEqual([
			['g1', 0],
			['f1', 1],
		]);
		expect(entries[0].media.title).toBe('Title g1');
		expect((await activityEvents()).filter((e) => e === 'added_to_collection')).toHaveLength(2);
	});

	it('rejects media of another type in a typed collection', async () => {
		const c = await createCollection({ name: 'Games', mediaType: 'game' });
		await expect(addToCollection(c.id, 'f1')).rejects.toThrow();
	});

	it('reorders items and stores item notes', async () => {
		const c = await createCollection({ name: 'Top', mediaType: 'game', isRanked: true });
		await addToCollection(c.id, 'g1');
		await addToCollection(c.id, 'g2');
		await reorderCollection(c.id, ['g2', 'g1']);
		await updateEntryNote(c.id, 'g1', ' $20 on GOG ');

		const entries = await getCollectionEntries(c.id);
		expect(entries.map((e) => e.media.id)).toEqual(['g2', 'g1']);
		expect(entries[1].note).toBe('$20 on GOG');
	});

	it('builds a cover mosaic from up to four posters in collection order', async () => {
		for (const id of ['g3', 'g4', 'g5']) await seedMedia(id, 'game');
		await seedMedia('g6', 'game', null);
		const c = await createCollection({ name: 'Many', mediaType: 'game' });
		for (const id of ['g6', 'g1', 'g2', 'g3', 'g4', 'g5']) await addToCollection(c.id, id);

		const [summary] = await listCollections();
		expect(summary.itemCount).toBe(6);
		expect(summary.coverUrls).toEqual(['g1.jpg', 'g2.jpg', 'g3.jpg', 'g4.jpg']);
	});
});

describe('system collections', () => {
	it('creates Favorites per type and a Wishlist only for games', async () => {
		const games = await listCollectionsForPicker('game');
		expect(games.map((c) => [c.name, c.systemKey])).toEqual([
			['Favorite Games', 'favorites'],
			['Wishlist', 'wishlist'],
		]);

		const films = await listCollectionsForPicker('film');
		expect(films.map((c) => c.name)).toEqual(['Favorite Films']);
		await expect(ensureSystemCollection('wishlist', 'film')).rejects.toThrow();
	});

	it('lists system collections first and hides other types from the picker', async () => {
		await createCollection({ name: 'Shared', mediaType: null });
		await createCollection({ name: 'Film only', mediaType: 'film' });
		const games = await listCollectionsForPicker('game');
		expect(games.map((c) => c.name)).toEqual(['Favorite Games', 'Wishlist', 'Shared']);
	});

	it('toggles favorites and wishlist membership', async () => {
		const game = { id: 'g1', type: 'game' as const };
		expect(await toggleSystemCollection('favorites', game)).toBe(true);
		expect(await toggleSystemCollection('wishlist', game)).toBe(true);
		expect(await isInSystemCollection('favorites', 'g1')).toBe(true);
		expect((await getCollectionsForMedia('g1')).map((c) => c.name)).toEqual([
			'Favorite Games',
			'Wishlist',
		]);

		expect(await toggleSystemCollection('favorites', game)).toBe(false);
		expect(await isInSystemCollection('favorites', 'g1')).toBe(false);
	});

	it('cannot be deleted, renamed or retyped', async () => {
		const fav = await ensureSystemCollection('favorites', 'game');
		await expect(deleteCollection(fav.id)).rejects.toThrow();
		await expect(updateCollection(fav.id, { name: 'X' })).rejects.toThrow();
		await expect(updateCollection(fav.id, { mediaType: null })).rejects.toThrow();
		expect((await updateCollection(fav.id, { isRanked: true })).isRanked).toBe(true);
	});
});
