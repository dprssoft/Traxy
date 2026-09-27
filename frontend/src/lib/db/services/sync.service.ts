/**
 * Sync engine: turns the local database into a sync document, merges it with the one on the
 * user's drive, applies the result locally and writes it back. Provider-agnostic — see
 * `SyncProvider` for what a drive has to offer.
 */
import type { capSQLiteSet } from '@capacitor-community/sqlite';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../index';
import {
	emptySyncDoc,
	mergeSyncDocs,
	parseSyncDoc,
	serializeSyncDoc,
	type SyncDoc,
} from '../sync/document';
import { SyncConflictError, type SyncProvider } from '../sync/provider';
import { DETAIL_COLUMNS } from './media.service';
import { ANIME_MERGE_LEFTOVER_KEYS } from './backup.service';
import { collectionItemKey, collectionKey, mediaKey } from './syncLog.service';
import { GOALS_STORAGE_PREFIX } from '$lib/constants';

type Row = Record<string, unknown>;

/** Title fields that travel; provider details reload per title (see `detailsPending`). */
const MEDIA_SYNC_COLUMNS = [
	'source',
	'externalId',
	'type',
	'title',
	'year',
	'posterUrl',
	'isAdult',
	'totalEpisodes',
	'totalSeasons',
	'totalVolumes',
	'totalChapters',
	'totalPages',
];

const TRACKING_SYNC_COLUMNS = [
	'status',
	'score',
	'note',
	'currentEpisode',
	'currentSeason',
	'currentChapter',
	'currentVolume',
	'currentPage',
	'currentIssue',
	'hoursPlayed',
	'completionTier',
	'createdAt',
	'updatedAt',
];

const COLLECTION_SYNC_COLUMNS = [
	'name',
	'description',
	'createdAt',
	'updatedAt',
	'mediaType',
	'systemKey',
	'isRanked',
	'sortOrder',
];

const pick = (row: Row, columns: readonly string[]) =>
	Object.fromEntries(columns.map((c) => [c, row[c] ?? null]));

/** A text column as a string, or null. */
const str = (value: unknown) => (value == null ? null : String(value));

async function rows(sql: string): Promise<Row[]> {
	return ((await getDb().query(sql)).values ?? []) as Row[];
}

/** The local library as a sync document. */
export async function buildLocalSyncDoc(): Promise<SyncDoc> {
	const doc = emptySyncDoc();

	const keyOfMedia = new Map<unknown, string>();
	for (const m of await rows('SELECT * FROM Media')) {
		const key = mediaKey(m as { source: string; externalId: string });
		keyOfMedia.set(m.id, key);
		doc.media[key] = pick(
			m,
			m.source === 'manual' ? [...MEDIA_SYNC_COLUMNS, ...DETAIL_COLUMNS] : MEDIA_SYNC_COLUMNS,
		);
	}

	for (const t of await rows('SELECT * FROM TrackingStatus')) {
		const key = keyOfMedia.get(t.mediaId);
		if (key) doc.tracking[key] = pick(t, TRACKING_SYNC_COLUMNS);
	}

	for (const c of await rows('SELECT * FROM WatchCycle')) {
		const key = keyOfMedia.get(c.mediaId);
		if (!key) continue;
		doc.cycles[`${key}#${c.cycleNumber}`] = {
			mediaKey: key,
			cycleNumber: c.cycleNumber,
			startedAt: c.startedAt ?? null,
			finishedAt: c.finishedAt ?? null,
			updatedAt: str(c.updatedAt),
		};
	}

	const keyOfCollection = new Map<unknown, string>();
	for (const c of await rows('SELECT * FROM Collection')) {
		const key = collectionKey(c as { id: string; systemKey?: string; mediaType?: string });
		keyOfCollection.set(c.id, key);
		doc.collections[key] = pick(c, COLLECTION_SYNC_COLUMNS);
	}

	for (const i of await rows('SELECT * FROM CollectionItem')) {
		const cKey = keyOfCollection.get(i.collectionId);
		const mKey = keyOfMedia.get(i.mediaId);
		if (!cKey || !mKey) continue;
		doc.collectionItems[collectionItemKey(cKey, mKey)] = {
			collectionKey: cKey,
			mediaKey: mKey,
			sortOrder: i.sortOrder ?? null,
			addedAt: i.addedAt ?? null,
			note: i.note ?? null,
			updatedAt: str(i.updatedAt ?? i.addedAt),
		};
	}

	for (const a of await rows('SELECT * FROM ActivityLog')) {
		doc.activity[String(a.id)] = {
			mediaKey: keyOfMedia.get(a.mediaId) ?? null,
			mediaTitle: a.mediaTitle ?? null,
			mediaPosterUrl: a.mediaPosterUrl ?? null,
			mediaType: a.mediaType ?? null,
			eventType: a.eventType,
			payload: a.payload ?? null,
			occurredAt: a.occurredAt ?? null,
		};
	}

	for (const s of await rows('SELECT * FROM AppSettings')) {
		const key = String(s.key);
		if (ANIME_MERGE_LEFTOVER_KEYS.includes(key)) continue;
		doc.settings[key] = { value: s.value ?? null, updatedAt: str(s.updatedAt) };
	}

	for (const t of await rows('SELECT * FROM SyncTombstone')) {
		doc.tombstones[`${t.tableName}/${t.rowKey}`] = String(t.deletedAt);
	}

	if (typeof localStorage !== 'undefined') {
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (!key?.startsWith(GOALS_STORAGE_PREFIX)) continue;
			try {
				doc.goals[key.slice(GOALS_STORAGE_PREFIX.length)] = JSON.parse(localStorage.getItem(key)!);
			} catch {
				// A corrupt goal entry isn't worth failing sync over.
			}
		}
	}

	return doc;
}

const insert = (table: string, row: Row): capSQLiteSet => {
	const columns = Object.keys(row);
	return {
		statement: `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
		values: columns.map((c) => row[c]),
	};
};

/**
 * Make the local library match `doc`, in one transaction. Titles are only ever added (the local
 * ones double as a cache); everything else is replaced. Local ids are kept where a row already
 * exists, so open pages and links stay valid.
 */
export async function applySyncDoc(doc: SyncDoc): Promise<void> {
	const db = getDb();
	const statements: capSQLiteSet[] = [];

	const mediaIds = new Map<string, string>();
	for (const m of await rows('SELECT id, source, externalId FROM Media')) {
		mediaIds.set(mediaKey(m as { source: string; externalId: string }), String(m.id));
	}
	for (const [key, m] of Object.entries(doc.media)) {
		if (mediaIds.has(key)) continue;
		const id = uuidv4();
		mediaIds.set(key, id);
		statements.push(
			insert('Media', { id, ...m, detailsPending: m.source === 'manual' ? null : 1 }),
		);
	}

	const collectionIds = new Map<string, string>();
	for (const c of await rows('SELECT id, systemKey, mediaType FROM Collection')) {
		collectionIds.set(
			collectionKey(c as { id: string; systemKey?: string; mediaType?: string }),
			String(c.id),
		);
	}
	const cycleIds = new Map<string, string>();
	for (const c of await rows(
		'SELECT c.id, c.cycleNumber, m.source, m.externalId FROM WatchCycle c JOIN Media m ON m.id = c.mediaId',
	)) {
		cycleIds.set(
			`${mediaKey(c as { source: string; externalId: string })}#${c.cycleNumber}`,
			String(c.id),
		);
	}
	const trackingIds = new Map<string, string>();
	for (const t of await rows(
		'SELECT t.id, m.source, m.externalId FROM TrackingStatus t JOIN Media m ON m.id = t.mediaId',
	)) {
		trackingIds.set(mediaKey(t as { source: string; externalId: string }), String(t.id));
	}

	// Children before parents: Android enforces foreign keys.
	for (const table of [
		'CollectionItem',
		'WatchCycle',
		'TrackingStatus',
		'Collection',
		'ActivityLog',
		'AppSettings',
		'SyncTombstone',
	]) {
		statements.push({ statement: `DELETE FROM ${table}`, values: [] });
	}

	for (const [key, c] of Object.entries(doc.collections)) {
		const id = collectionIds.get(key) ?? (c.systemKey ? uuidv4() : key);
		collectionIds.set(key, id);
		statements.push(insert('Collection', { id, ...c }));
	}
	for (const [key, t] of Object.entries(doc.tracking)) {
		statements.push(
			insert('TrackingStatus', {
				id: trackingIds.get(key) ?? uuidv4(),
				mediaId: mediaIds.get(key),
				...pick(t, TRACKING_SYNC_COLUMNS),
			}),
		);
	}
	for (const [key, c] of Object.entries(doc.cycles)) {
		const { mediaKey: mKey, ...rest } = c;
		statements.push(
			insert('WatchCycle', {
				id: cycleIds.get(key) ?? uuidv4(),
				mediaId: mediaIds.get(String(mKey)),
				...rest,
			}),
		);
	}
	for (const i of Object.values(doc.collectionItems)) {
		const { collectionKey: cKey, mediaKey: mKey, ...rest } = i;
		statements.push(
			insert('CollectionItem', {
				id: uuidv4(),
				collectionId: collectionIds.get(String(cKey)),
				mediaId: mediaIds.get(String(mKey)),
				...rest,
			}),
		);
	}
	for (const [id, a] of Object.entries(doc.activity)) {
		const { mediaKey: mKey, ...rest } = a;
		statements.push(
			insert('ActivityLog', {
				id,
				mediaId: mKey ? (mediaIds.get(String(mKey)) ?? null) : null,
				...rest,
			}),
		);
	}
	for (const [key, s] of Object.entries(doc.settings)) {
		statements.push(
			insert('AppSettings', { key, value: s.value ?? null, updatedAt: s.updatedAt ?? null }),
		);
	}
	for (const [path, deletedAt] of Object.entries(doc.tombstones)) {
		const slash = path.indexOf('/');
		statements.push(
			insert('SyncTombstone', {
				tableName: path.slice(0, slash),
				rowKey: path.slice(slash + 1),
				deletedAt,
			}),
		);
	}

	await db.executeSet(statements, true);

	if (typeof localStorage !== 'undefined') {
		for (const [year, goals] of Object.entries(doc.goals)) {
			localStorage.setItem(`${GOALS_STORAGE_PREFIX}${year}`, JSON.stringify(goals));
		}
	}
}

export interface SyncResult {
	/** The local library changed (the UI should reload its data). */
	pulled: boolean;
	/** The drive's copy changed. */
	pushed: boolean;
}

const MAX_ATTEMPTS = 3;

/**
 * One sync round: read the drive's document, merge it with the local one, apply the result
 * locally and write it back. If another device writes in between, start over (up to 3 times).
 */
export async function syncWith(provider: SyncProvider): Promise<SyncResult> {
	for (let attempt = 1; ; attempt++) {
		const remote = await provider.read();
		const remoteDoc = parseSyncDoc(remote?.content);
		const localDoc = await buildLocalSyncDoc();
		const merged = mergeSyncDocs(localDoc, remoteDoc);
		const mergedText = serializeSyncDoc(merged);

		const pulled = mergedText !== serializeSyncDoc(mergeSyncDocs(localDoc, emptySyncDoc()));
		if (pulled) await applySyncDoc(merged);

		const pushed = !remote || mergedText !== serializeSyncDoc(remoteDoc);
		if (!pushed) return { pulled, pushed };
		try {
			await provider.write(mergedText, remote?.revision ?? null);
			return { pulled, pushed };
		} catch (err) {
			if (!(err instanceof SyncConflictError) || attempt >= MAX_ATTEMPTS) throw err;
		}
	}
}
