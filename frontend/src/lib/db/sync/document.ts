/**
 * The sync document: the whole library in a device-independent shape, plus deletion tombstones.
 * Rows are keyed and cross-referenced by sync keys (see syncLog.service), never by local ids, so
 * two devices' copies can be merged row by row. Everything here is pure — no database, no drive.
 */
import { ACTIVITY_LOG_LIMIT } from '../services/activity.service';

export const SYNC_DOC_VERSION = 1;

/** Tombstones older than this are forgotten; a device offline for longer may resurrect rows. */
export const TOMBSTONE_TTL_DAYS = 180;

type Row = Record<string, unknown>;
export type StampedRow = Row & { updatedAt?: string | null };

export interface SyncDoc {
	version: number;
	/** Titles by media key. Only what the app needs offline; details reload per title. */
	media: Record<string, Row>;
	/** Tracking by media key. */
	tracking: Record<string, StampedRow>;
	/** Rewatch cycles by `mediaKey#cycleNumber`. */
	cycles: Record<string, StampedRow>;
	/** Collections by collection key. */
	collections: Record<string, StampedRow>;
	/** Collection items by `collectionKey|mediaKey`. */
	collectionItems: Record<string, StampedRow>;
	/** Feed entries by id; `mediaKey` replaces the local mediaId. */
	activity: Record<string, Row>;
	/** AppSettings by key: `{ value, updatedAt }`. */
	settings: Record<string, StampedRow>;
	/** Yearly goals by year. */
	goals: Record<string, StampedRow>;
	/** `table/rowKey` → deletedAt. */
	tombstones: Record<string, string>;
}

export function emptySyncDoc(): SyncDoc {
	return {
		version: SYNC_DOC_VERSION,
		media: {},
		tracking: {},
		cycles: {},
		collections: {},
		collectionItems: {},
		activity: {},
		settings: {},
		goals: {},
		tombstones: {},
	};
}

/** Which tombstone table each stamped section answers to. */
const SECTION_TABLES = {
	tracking: 'TrackingStatus',
	cycles: 'WatchCycle',
	collections: 'Collection',
	collectionItems: 'CollectionItem',
	settings: 'AppSettings',
} as const;

const stamp = (row: StampedRow | undefined) => row?.updatedAt ?? '';

/** The newer of two copies; on a tie the one that sorts later, so both devices agree. */
function newer<T extends StampedRow>(a: T | undefined, b: T | undefined): T | undefined {
	if (!a) return b;
	if (!b) return a;
	const byStamp = stamp(a).localeCompare(stamp(b));
	if (byStamp !== 0) return byStamp > 0 ? a : b;
	return JSON.stringify(a) >= JSON.stringify(b) ? a : b;
}

function mergeStamped(
	a: Record<string, StampedRow>,
	b: Record<string, StampedRow>,
): Record<string, StampedRow> {
	const out: Record<string, StampedRow> = {};
	for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
		out[key] = newer(a[key], b[key])!;
	}
	return out;
}

/** Titles: either copy will do; keep every field either side knows. */
function mergeMedia(a: Record<string, Row>, b: Record<string, Row>): Record<string, Row> {
	const out: Record<string, Row> = { ...b };
	for (const [key, row] of Object.entries(a)) {
		const defined = Object.fromEntries(Object.entries(row).filter(([, v]) => v != null));
		out[key] = { ...(b[key] ?? {}), ...defined };
	}
	return out;
}

/** The feed: union, newest `ACTIVITY_LOG_LIMIT` kept. */
function mergeActivity(a: Record<string, Row>, b: Record<string, Row>): Record<string, Row> {
	const all = Object.entries({ ...b, ...a });
	all.sort(
		([idA, x], [idB, y]) =>
			String(y.occurredAt ?? '').localeCompare(String(x.occurredAt ?? '')) ||
			idB.localeCompare(idA),
	);
	return Object.fromEntries(all.slice(0, ACTIVITY_LOG_LIMIT));
}

function mergeTombstones(
	a: Record<string, string>,
	b: Record<string, string>,
	now: Date,
): Record<string, string> {
	const cutoff = new Date(now.getTime() - TOMBSTONE_TTL_DAYS * 86_400_000).toISOString();
	const out: Record<string, string> = {};
	for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
		const deletedAt = [a[key], b[key]].filter(Boolean).sort().at(-1)!;
		if (deletedAt >= cutoff) out[key] = deletedAt;
	}
	return out;
}

/**
 * Merge two devices' documents. Per row the newer `updatedAt` wins; a tombstone removes every copy
 * that isn't newer than the deletion. Items of deleted collections and rows pointing at titles
 * neither side has are dropped. Commutative: merge(a, b) equals merge(b, a).
 */
export function mergeSyncDocs(a: SyncDoc, b: SyncDoc, now = new Date()): SyncDoc {
	const tombstones = mergeTombstones(a.tombstones, b.tombstones, now);
	const merged: SyncDoc = {
		version: SYNC_DOC_VERSION,
		media: mergeMedia(a.media, b.media),
		tracking: mergeStamped(a.tracking, b.tracking),
		cycles: mergeStamped(a.cycles, b.cycles),
		collections: mergeStamped(a.collections, b.collections),
		collectionItems: mergeStamped(a.collectionItems, b.collectionItems),
		activity: mergeActivity(a.activity, b.activity),
		settings: mergeStamped(a.settings, b.settings),
		goals: mergeStamped(a.goals, b.goals),
		tombstones,
	};

	for (const [section, table] of Object.entries(SECTION_TABLES)) {
		const rows = merged[section as keyof typeof SECTION_TABLES];
		for (const [key, row] of Object.entries(rows)) {
			const deletedAt = tombstones[`${table}/${key}`];
			if (deletedAt && stamp(row) <= deletedAt) delete rows[key];
		}
	}
	for (const id of Object.keys(merged.activity)) {
		if (tombstones[`ActivityLog/${id}`]) delete merged.activity[id];
	}

	// References must resolve: drop rows whose title or collection is gone.
	const hasMedia = (key: unknown) => typeof key === 'string' && key in merged.media;
	for (const [key, row] of Object.entries(merged.tracking)) {
		if (!hasMedia(key) || !hasMedia(row.mediaKey ?? key)) delete merged.tracking[key];
	}
	for (const [key, row] of Object.entries(merged.cycles)) {
		if (!hasMedia(row.mediaKey)) delete merged.cycles[key];
	}
	for (const [key, row] of Object.entries(merged.collectionItems)) {
		if (!hasMedia(row.mediaKey) || !(String(row.collectionKey) in merged.collections)) {
			delete merged.collectionItems[key];
		}
	}
	return merged;
}

/** Stable serialisation, so "nothing changed" can be detected by comparing strings. */
export function serializeSyncDoc(doc: SyncDoc): string {
	const sortKeys = (value: unknown): unknown => {
		if (Array.isArray(value)) return value.map(sortKeys);
		if (value && typeof value === 'object') {
			return Object.fromEntries(
				Object.keys(value)
					.sort()
					.map((k) => [k, sortKeys((value as Row)[k])]),
			);
		}
		return value;
	};
	return JSON.stringify(sortKeys(doc));
}

/** Parse a document read from a drive; an empty or foreign file yields an empty document. */
export function parseSyncDoc(content: string | null | undefined): SyncDoc {
	if (!content) return emptySyncDoc();
	const parsed = JSON.parse(content) as Partial<SyncDoc>;
	if (typeof parsed.version !== 'number' || parsed.version > SYNC_DOC_VERSION) {
		throw new Error(
			'The sync file was written by a newer version of Traxy. Update this app first.',
		);
	}
	return { ...emptySyncDoc(), ...parsed, version: SYNC_DOC_VERSION };
}
