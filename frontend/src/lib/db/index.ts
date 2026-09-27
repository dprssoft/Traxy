import {
	CapacitorSQLite,
	SQLiteConnection,
	type SQLiteDBConnection,
} from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';
import { v4 as uuidv4 } from 'uuid';
import type { MediaType } from './schema';
import { getSystemCollectionName } from '$lib/constants';

const DB_NAME = 'tracklist_db';
let sqlite: SQLiteConnection;
let db: SQLiteDBConnection;

/**
 * Flush in-memory SQLite to IndexedDB on web. No-op on native (disk writes are immediate).
 * Called automatically after every db.run / db.executeSet on web via the write wrapper below.
 */
export async function saveDbToStore(): Promise<void> {
	if (Capacitor.getPlatform() === 'web' && sqlite) {
		await sqlite.saveToStore(DB_NAME);
	}
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSave(): void {
	if (Capacitor.getPlatform() !== 'web' || !sqlite) return;
	if (saveTimer) clearTimeout(saveTimer);
	saveTimer = setTimeout(() => saveDbToStore(), 800);
}

/**
 * Open (or reuse) the on-device database and bring its schema up to date. Must finish before any
 * service runs — the root layout load calls it and page loads wait for the layout. An existing
 * connection is reused rather than recreated.
 */
export const initDb = async () => {
	sqlite = new SQLiteConnection(CapacitorSQLite);

	// On web, jeep-sqlite needs explicit plugin initialization after the
	// custom element is in the DOM (done in +layout.svelte).
	if (Capacitor.getPlatform() === 'web') {
		await sqlite.initWebStore();
	}

	try {
		await sqlite.checkConnectionsConsistency().catch(() => {});
		const isConn = (await sqlite.isConnection(DB_NAME, false)).result;
		if (isConn) {
			db = await sqlite.retrieveConnection(DB_NAME, false);
		} else {
			try {
				db = await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);
			} catch (err) {
				if ((err as { message?: string })?.message?.includes('already exists')) {
					db = await sqlite.retrieveConnection(DB_NAME, false);
				} else {
					throw err;
				}
			}
		}
	} catch (e) {
		console.error('DB init failed', e);
		throw e;
	}

	await db.open();

	// On web, monkey-patch write methods so every db.run / db.executeSet schedules
	// a debounced saveToStore. This ensures data survives F5 without requiring every
	// service to remember to flush explicitly.
	if (Capacitor.getPlatform() === 'web') {
		const origRun = db.run.bind(db);
		const origExecSet = db.executeSet.bind(db);
		db.run = async (...args: Parameters<typeof db.run>) => {
			const r = await origRun(...args);
			scheduleSave();
			return r;
		};
		db.executeSet = async (...args: Parameters<typeof db.executeSet>) => {
			const r = await origExecSet(...args);
			scheduleSave();
			return r;
		};
	}

	await applySchema(db);
};

type SchemaConnection = Pick<SQLiteDBConnection, 'execute' | 'query' | 'run'>;

/** Creates the tables and migrates older databases. Exported so tests can apply the real schema. */
export const applySchema = async (db: SchemaConnection) => {
	const schema = `
    CREATE TABLE IF NOT EXISTS Media (
        id TEXT PRIMARY KEY,
        source TEXT,
        externalId TEXT,
        type TEXT,
        title TEXT,
        year INTEGER,
        posterUrl TEXT,
        description TEXT,
        originalTitle TEXT,
        serializationYears TEXT,
        author TEXT,
        country TEXT,
        genres TEXT,
        releaseStatus TEXT,
        totalEpisodes INTEGER,
        totalSeasons INTEGER,
        totalVolumes INTEGER,
        totalChapters INTEGER,
        platforms TEXT,
        totalPages INTEGER,
        seasonData TEXT,
        timeToBeat TEXT,
        runtimeMinutes INTEGER,
        isAdult INTEGER,
        wikiMeta TEXT,
        detailsPending INTEGER
    );
    CREATE TABLE IF NOT EXISTS TrackingStatus (
        id TEXT PRIMARY KEY,
        mediaId TEXT,
        status TEXT,
        score INTEGER,
        note TEXT,
        currentEpisode INTEGER,
        currentSeason INTEGER,
        currentChapter INTEGER,
        currentVolume INTEGER,
        currentPage INTEGER,
        currentIssue INTEGER,
        hoursPlayed REAL,
        completionTier TEXT,
        createdAt TEXT,
        updatedAt TEXT,
        FOREIGN KEY(mediaId) REFERENCES Media(id)
    );
    CREATE TABLE IF NOT EXISTS WatchCycle (
        id TEXT PRIMARY KEY,
        mediaId TEXT,
        cycleNumber INTEGER,
        startedAt TEXT,
        finishedAt TEXT,
        FOREIGN KEY(mediaId) REFERENCES Media(id)
    );
    CREATE TABLE IF NOT EXISTS Collection (
        id TEXT PRIMARY KEY,
        name TEXT,
        description TEXT,
        createdAt TEXT,
        updatedAt TEXT,
        mediaType TEXT,
        systemKey TEXT,
        isRanked INTEGER,
        sortOrder INTEGER
    );
    CREATE TABLE IF NOT EXISTS CollectionItem (
        id TEXT PRIMARY KEY,
        collectionId TEXT,
        mediaId TEXT,
        sortOrder INTEGER,
        addedAt TEXT,
        note TEXT,
        FOREIGN KEY(collectionId) REFERENCES Collection(id),
        FOREIGN KEY(mediaId) REFERENCES Media(id)
    );
    CREATE TABLE IF NOT EXISTS ActivityLog (
        id TEXT PRIMARY KEY,
        mediaId TEXT,
        mediaTitle TEXT,
        mediaPosterUrl TEXT,
        mediaType TEXT,
        eventType TEXT,
        payload TEXT,
        occurredAt TEXT
    );
    CREATE TABLE IF NOT EXISTS Goal (
        id TEXT PRIMARY KEY,
        mediaType TEXT,
        targetCount INTEGER,
        year INTEGER,
        createdAt TEXT
    );
    CREATE TABLE IF NOT EXISTS ApiCache (
        cacheKey TEXT PRIMARY KEY,
        data TEXT,
        cachedAt TEXT
    );
    CREATE TABLE IF NOT EXISTS AppSettings (
        key TEXT PRIMARY KEY,
        value TEXT
    );
    `;

	await db.execute(schema);

	// ── Migrations for existing databases ────────────────────────────────
	const newColumns = [
		'seasonData TEXT',
		'timeToBeat TEXT',
		'originalTitle TEXT',
		'serializationYears TEXT',
		'author TEXT',
		'country TEXT',
		'genres TEXT',
		'releaseStatus TEXT',
		'totalVolumes INTEGER',
		'totalChapters INTEGER',
		'runtimeMinutes INTEGER',
		'isAdult INTEGER',
		'wikiMeta TEXT',
		'detailsPending INTEGER',
	];
	for (const col of newColumns) {
		try {
			await db.execute(`ALTER TABLE Media ADD COLUMN ${col};`);
			// Cached provider responses predate adult-content flags — drop them once so
			// results get re-fetched with `isAdult` set.
			if (col.startsWith('isAdult')) await db.execute('DELETE FROM ApiCache;');
		} catch {
			// Ignore if column already exists
		}
	}

	const collectionColumns = [
		'Collection ADD COLUMN updatedAt TEXT',
		'Collection ADD COLUMN mediaType TEXT',
		'Collection ADD COLUMN systemKey TEXT',
		'Collection ADD COLUMN isRanked INTEGER',
		'Collection ADD COLUMN sortOrder INTEGER',
		'CollectionItem ADD COLUMN note TEXT',
	];
	for (const col of collectionColumns) {
		try {
			await db.execute(`ALTER TABLE ${col};`);
		} catch {
			// Ignore if column already exists
		}
	}

	// Older builds inserted items without an id and allowed duplicates — repair both
	// before the unique index goes on.
	await db.execute(`
        UPDATE CollectionItem SET id = lower(hex(randomblob(16))) WHERE id IS NULL;
        DELETE FROM CollectionItem WHERE rowid NOT IN (
            SELECT MIN(rowid) FROM CollectionItem GROUP BY collectionId, mediaId
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_collection_item_unique
            ON CollectionItem(collectionId, mediaId);
    `);

	await migrateLegacyFavorites(db);
};

// Name of the single mixed-type favorites list older builds created as a user collection.
const LEGACY_FAVORITES_NAME = 'Favorites';

/** Splits the old mixed-type "Favorites" collection into one Favorite <Type> collection per type. */
async function migrateLegacyFavorites(db: SchemaConnection) {
	const legacy = await db.query('SELECT id FROM Collection WHERE name = ? AND systemKey IS NULL', [
		LEGACY_FAVORITES_NAME,
	]);
	for (const row of legacy.values ?? []) {
		const legacyId = (row as { id: string }).id;
		const items = await db.query(
			`SELECT ci.mediaId, ci.addedAt, m.type FROM CollectionItem ci
             JOIN Media m ON m.id = ci.mediaId
             WHERE ci.collectionId = ?`,
			[legacyId],
		);
		const targetByType = new Map<MediaType, string>();
		for (const item of (items.values ?? []) as {
			mediaId: string;
			addedAt: string;
			type: MediaType;
		}[]) {
			let targetId = targetByType.get(item.type);
			if (!targetId) {
				const existing = await db.query(
					"SELECT id FROM Collection WHERE systemKey = 'favorites' AND mediaType = ?",
					[item.type],
				);
				targetId = (existing.values?.[0] as { id: string } | undefined)?.id;
				if (!targetId) {
					targetId = uuidv4();
					const now = new Date().toISOString();
					await db.run(
						`INSERT INTO Collection (id, name, createdAt, updatedAt, mediaType, systemKey, isRanked, sortOrder)
                         VALUES (?, ?, ?, ?, ?, 'favorites', 0, 0)`,
						[targetId, getSystemCollectionName('favorites', item.type), now, now, item.type],
					);
				}
				targetByType.set(item.type, targetId);
			}
			await db.run(
				`INSERT OR IGNORE INTO CollectionItem (id, collectionId, mediaId, sortOrder, addedAt)
                 VALUES (?, ?, ?, 0, ?)`,
				[uuidv4(), targetId, item.mediaId, item.addedAt],
			);
		}
		await db.run('DELETE FROM CollectionItem WHERE collectionId = ?', [legacyId]);
		await db.run('DELETE FROM Collection WHERE id = ?', [legacyId]);
	}
}

/** The open connection. Throws until `initDb` has completed. */
export const getDb = () => {
	if (!db) throw new Error('Database not initialized');
	return db;
};
