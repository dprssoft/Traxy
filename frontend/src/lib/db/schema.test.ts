import { describe, it, expect } from 'vitest';
import { applySchema } from './index';
import { createTestDb } from './testDb';

async function seedMedia(db: Awaited<ReturnType<typeof createTestDb>>, id: string, type: string) {
	await db.run(
		"INSERT INTO Media (id, source, externalId, type, title) VALUES (?, 'manual', ?, ?, ?)",
		[id, id, type, id],
	);
}

describe('collection schema migration', () => {
	it('splits the legacy mixed Favorites collection into one collection per media type', async () => {
		const db = await createTestDb();
		await seedMedia(db, 'g1', 'game');
		await seedMedia(db, 'g2', 'game');
		await seedMedia(db, 'f1', 'film');
		await db.run("INSERT INTO Collection (id, name, createdAt) VALUES ('legacy', 'Favorites', 'x')");
		// Legacy rows: one without an id, one duplicate
		await db.run(
			"INSERT INTO CollectionItem (collectionId, mediaId, addedAt) VALUES ('legacy', 'g1', 'a')",
		);
		await db.run("INSERT INTO CollectionItem (id, collectionId, mediaId, addedAt) VALUES ('i2', 'legacy', 'g2', 'b')");
		await db.run("INSERT INTO CollectionItem (id, collectionId, mediaId, addedAt) VALUES ('i3', 'legacy', 'f1', 'c')");

		await db.execute('DROP INDEX idx_collection_item_unique');
		await db.run("INSERT INTO CollectionItem (id, collectionId, mediaId, addedAt) VALUES ('i4', 'legacy', 'f1', 'd')");

		await applySchema(db);

		const collections = (await db.query('SELECT name, mediaType, systemKey FROM Collection ORDER BY name')).values;
		expect(collections).toEqual([
			{ name: 'Favorite Films', mediaType: 'film', systemKey: 'favorites' },
			{ name: 'Favorite Games', mediaType: 'game', systemKey: 'favorites' },
		]);

		const items = (
			await db.query(
				`SELECT c.mediaType, ci.mediaId FROM CollectionItem ci
				 JOIN Collection c ON c.id = ci.collectionId ORDER BY ci.mediaId`,
			)
		).values;
		expect(items).toEqual([
			{ mediaType: 'film', mediaId: 'f1' },
			{ mediaType: 'game', mediaId: 'g1' },
			{ mediaType: 'game', mediaId: 'g2' },
		]);
	});

	it('is idempotent and rejects duplicate items', async () => {
		const db = await createTestDb();
		await applySchema(db);
		await db.run("INSERT INTO Collection (id, name) VALUES ('c', 'Mine')");
		await db.run("INSERT INTO CollectionItem (id, collectionId, mediaId) VALUES ('1', 'c', 'm')");
		await expect(
			db.run("INSERT INTO CollectionItem (id, collectionId, mediaId) VALUES ('2', 'c', 'm')"),
		).rejects.toThrow();
	});
});
