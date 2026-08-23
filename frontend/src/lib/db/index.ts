import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';

const DB_NAME = 'tracklist_db';
let sqlite: SQLiteConnection;
let db: SQLiteDBConnection;

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
            } catch (err: any) {
                if (err?.message?.includes('already exists')) {
                    db = await sqlite.retrieveConnection(DB_NAME, false);
                } else {
                    throw err;
                }
            }
        }
    } catch (e) {
        console.error("DB init failed", e);
        throw e;
    }

    await db.open();

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
        totalEpisodes INTEGER,
        totalSeasons INTEGER,
        platforms TEXT,
        totalPages INTEGER,
        seasonData TEXT
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
        createdAt TEXT
    );
    CREATE TABLE IF NOT EXISTS CollectionItem (
        id TEXT PRIMARY KEY,
        collectionId TEXT,
        mediaId TEXT,
        sortOrder INTEGER,
        addedAt TEXT,
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

    try {
        await db.execute('ALTER TABLE Media ADD COLUMN seasonData TEXT;');
    } catch (e) {
        // Ignore if column already exists
    }
};

export const getDb = () => {
    if (!db) throw new Error('Database not initialized');
    return db;
};
