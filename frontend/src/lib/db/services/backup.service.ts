import type { capSQLiteSet } from '@capacitor-community/sqlite';
import { getDb } from '../index';
import { DETAIL_COLUMNS } from './media.service';
import { ACTIVITY_LOG_LIMIT, pruneActivityLog } from './activity.service';

// Settings kept in localStorage by the stores (goals per year, shell layout). API keys
// (`traxy:apiKeys`) are deliberately left out: backups land in the public Download folder.
const LOCAL_SETTING_PREFIXES = ['traxy:goals:'];
const LOCAL_SETTING_KEYS = ['traxy_topbar_mirrored', 'traxy_sidebar_collapsed'];

function isLocalSettingKey(key: string): boolean {
	return LOCAL_SETTING_KEYS.includes(key) || LOCAL_SETTING_PREFIXES.some((p) => key.startsWith(p));
}

interface BackupSettings {
	appSettings: Record<string, string>;
	localStorage: Record<string, string>;
}

const BACKUP_TABLES = [
	'Media',
	'TrackingStatus',
	'WatchCycle',
	'ActivityLog',
	'Collection',
	'CollectionItem',
	'Goal',
];

// Activity rows copy their title's name/poster/type for the feed; while the title is still in the
// library the backup leaves them out and the import copies them back from Media.
const ACTIVITY_MEDIA_COLUMNS = ['mediaTitle', 'mediaPosterUrl', 'mediaType'];

/**
 * Columns each table is written with, droppable ones last so rows can end early (see
 * `trimTrailingNulls`). Media's `detailsPending` is left out: import sets it itself.
 */
function backupColumns(table: string, columns: string[]): string[] {
	const last: readonly string[] =
		table === 'Media' ? DETAIL_COLUMNS : table === 'ActivityLog' ? ACTIVITY_MEDIA_COLUMNS : [];
	const kept = columns.filter((c) => !(table === 'Media' && c === 'detailsPending'));
	return [...kept.filter((c) => !last.includes(c)), ...kept.filter((c) => last.includes(c))];
}

function trimTrailingNulls(row: unknown[]): unknown[] {
	let end = row.length;
	while (end > 0 && row[end - 1] == null) end--;
	return row.slice(0, end);
}

/** A table in a v3 backup: column names once, then one array per row (trailing nulls cut). */
interface BackupTable {
	columns: string[];
	rows: unknown[][];
}

/**
 * Serialise the user's library and settings as compact JSON
 * (`{ version: 3, timestamp, data: { <table>: { columns, rows } }, settings }`).
 * Titles from a provider keep only what the app needs offline — provider details
 * (`DETAIL_COLUMNS`) are fetched again after a restore. Manual titles keep everything.
 * ApiCache and API keys are not included.
 */
export async function exportDatabaseJson(): Promise<string> {
	const db = getDb();
	const data: Record<string, BackupTable> = {};
	let mediaIds = new Set<unknown>();

	for (const table of BACKUP_TABLES) {
		const order = table === 'ActivityLog' ? ' ORDER BY occurredAt DESC, rowid DESC LIMIT ?' : '';
		const res = await db.query(`SELECT * FROM ${table}${order}`, order ? [ACTIVITY_LOG_LIMIT] : []);
		const rows = (res.values ?? []) as Record<string, unknown>[];
		const tableColumns = await getColumns(table);
		const columns = backupColumns(
			table,
			tableColumns.length > 0 ? tableColumns : Object.keys(rows[0] ?? {}),
		);
		if (table === 'Media') mediaIds = new Set(rows.map((r) => r.id));

		data[table] = {
			columns,
			rows: rows.map((row) => {
				const slim = { ...row };
				if (table === 'Media' && row.source !== 'manual') {
					for (const c of DETAIL_COLUMNS) slim[c] = null;
				}
				if (table === 'ActivityLog' && mediaIds.has(row.mediaId)) {
					for (const c of ACTIVITY_MEDIA_COLUMNS) slim[c] = null;
				}
				return trimTrailingNulls(columns.map((c) => slim[c] ?? null));
			}),
		};
	}

	return JSON.stringify({
		version: 3,
		timestamp: new Date().toISOString(),
		data,
		settings: await exportSettings(),
	});
}

async function getColumns(table: string): Promise<string[]> {
	const res = await getDb().query(`PRAGMA table_info(${table})`);
	return (res.values ?? [])
		.map((c) => (c as { name?: string }).name)
		.filter((name): name is string => !!name);
}

async function exportSettings(): Promise<BackupSettings> {
	const res = await getDb().query('SELECT key, value FROM AppSettings');
	const appSettings: Record<string, string> = {};
	for (const row of res.values ?? []) {
		const [key, value] = Array.isArray(row)
			? row
			: [(row as { key: string }).key, (row as { value: string }).value];
		if (!ANIME_MERGE_LEFTOVER_KEYS.includes(key)) appSettings[key] = value;
	}

	const local: Record<string, string> = {};
	if (typeof localStorage !== 'undefined') {
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (key && isLocalSettingKey(key)) local[key] = localStorage.getItem(key) ?? '';
		}
	}

	return { appSettings, localStorage: local };
}

/**
 * Replace every user table with the contents of a backup made by `exportDatabaseJson` (any
 * version). All deletes and inserts run as one transaction, so a bad backup leaves the library
 * untouched.
 * Settings are replaced only when the backup has them (version 2+); older backups keep the
 * current settings.
 */
export async function importDatabaseJson(jsonString: string): Promise<void> {
	try {
		const parsed = JSON.parse(jsonString);
		if (!parsed.data) throw new Error('Invalid backup format');

		const db = getDb();
		const data = parsed.data;
		const statements: capSQLiteSet[] = [];

		// Android enforces foreign keys: clear children before parents, insert parents first.
		const deleteOrder = [
			'Goal',
			'ActivityLog',
			'WatchCycle',
			'TrackingStatus',
			'CollectionItem',
			'Collection',
			'Media',
		];
		for (const table of deleteOrder) {
			statements.push({ statement: `DELETE FROM ${table}`, values: [] });
		}

		const parentIds: Record<string, Set<unknown>> = {};
		for (const table of [...deleteOrder].reverse()) {
			const columns = await getColumns(table);
			const value = (row: BackupRow, column: string) =>
				Array.isArray(row) ? row[columns.indexOf(column)] : row[column];

			const rows = backupRows(data[table]).filter((row) => {
				// A row pointing at a title or collection missing from the backup would fail the whole
				// restore on a foreign-key check; skip it instead.
				const orphan = (FOREIGN_KEYS[table] ?? []).some(
					([column, parent]) => !parentIds[parent]?.has(value(row, column)),
				);
				if (orphan) console.warn(`[backup] skipping ${table} row with a missing parent`, row);
				return !orphan;
			});
			if (table === 'Media' || table === 'Collection') {
				parentIds[table] = new Set(rows.map((row) => value(row, 'id')));
			}
			for (const row of rows) statements.push(toInsert(table, row, columns));
		}

		if ((parsed.version ?? 1) >= 3) {
			// Slim backup: provider titles reload their details on the next page visit, and the
			// feed gets its copied title/poster/type back from the library.
			statements.push(
				{
					statement: "UPDATE Media SET detailsPending = 1 WHERE source != 'manual'",
					values: [],
				},
				{
					statement: `UPDATE ActivityLog SET
						mediaTitle = (SELECT title FROM Media WHERE Media.id = ActivityLog.mediaId),
						mediaPosterUrl = (SELECT posterUrl FROM Media WHERE Media.id = ActivityLog.mediaId),
						mediaType = (SELECT type FROM Media WHERE Media.id = ActivityLog.mediaId)
					WHERE mediaTitle IS NULL AND mediaId IN (SELECT id FROM Media)`,
					values: [],
				},
			);
		}

		const settings: BackupSettings | undefined = parsed.settings;
		// Backups from the short-lived `data.AppSettings` format carry settings as table rows.
		const settingRows: BackupRow[] | undefined = settings ? undefined : data.AppSettings;
		if (settings) {
			statements.push({ statement: 'DELETE FROM AppSettings', values: [] });
			for (const [key, value] of Object.entries(settings.appSettings ?? {})) {
				statements.push({
					statement: 'INSERT INTO AppSettings (key, value) VALUES (?, ?)',
					values: [key, value],
				});
			}
		} else if (Array.isArray(settingRows)) {
			statements.push({ statement: 'DELETE FROM AppSettings', values: [] });
			const columns = await getColumns('AppSettings');
			for (const row of settingRows) statements.push(toInsert('AppSettings', row, columns));
		}

		await db.executeSet(statements, true);
		// Backups made before the feed cap can carry the whole history.
		await pruneActivityLog();

		if (settings) restoreLocalSettings(settings.localStorage ?? {});
	} catch (err) {
		console.error('Import failed', err);
		throw err;
	}
}

function restoreLocalSettings(local: Record<string, string>): void {
	if (typeof localStorage === 'undefined') return;
	const stale: string[] = [];
	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i);
		if (key && isLocalSettingKey(key)) stale.push(key);
	}
	for (const key of stale) localStorage.removeItem(key);
	for (const [key, value] of Object.entries(local)) {
		if (isLocalSettingKey(key)) localStorage.setItem(key, value);
	}
}

// Child column → parent table, per the FOREIGN KEY clauses in db/index.ts.
const FOREIGN_KEYS: Record<string, [string, string][]> = {
	TrackingStatus: [['mediaId', 'Media']],
	WatchCycle: [['mediaId', 'Media']],
	CollectionItem: [
		['collectionId', 'Collection'],
		['mediaId', 'Media'],
	],
};

// v1/v2 backups hold rows as the driver returned them: objects keyed by column, or positional
// arrays (oldest exports). v3 tables are converted to keyed objects by `backupRows`.
type BackupRow = Record<string, unknown> | unknown[];

function backupRows(table: BackupTable | BackupRow[] | undefined): BackupRow[] {
	if (!table) return [];
	if (Array.isArray(table)) return table;
	// Rows end early when their last columns are empty; missing columns are NULL.
	return table.rows.map((row) =>
		Object.fromEntries(table.columns.map((c, i) => [c, row[i] ?? null])),
	);
}

function toInsert(table: string, row: BackupRow, columns: string[]): capSQLiteSet {
	if (Array.isArray(row)) {
		// Backups made before a column was added have shorter rows — pad them with NULLs so the
		// positional INSERT still matches the table.
		const values = [...row];
		while (values.length < columns.length) values.push(null);
		const placeholders = values.map(() => '?').join(', ');
		return { statement: `INSERT INTO ${table} VALUES (${placeholders})`, values };
	}
	// Named rows: keep only columns the table still has, so a backup from a newer schema loads.
	const known = new Set(columns);
	const keys = Object.keys(row).filter((k) => known.size === 0 || known.has(k));
	return {
		statement: `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
		values: keys.map((k) => row[k]),
	};
}

/**
 * Clear everything that can be fetched again: cached provider responses and the provider details
 * of each title (`DETAIL_COLUMNS`), which reload on the title's next page visit. Tracking,
 * history, the feed, collections, goals, settings and manual titles are untouched, as are each
 * title's name, year, poster and totals.
 */
export async function clearMediaCache(): Promise<void> {
	await getDb().executeSet(
		[
			{ statement: 'DELETE FROM ApiCache', values: [] },
			{
				statement: `UPDATE Media SET ${DETAIL_COLUMNS.map((c) => `${c} = NULL`).join(', ')},
					detailsPending = 1 WHERE source != 'manual'`,
				values: [],
			},
		],
		true,
	);
}

/** Approximate size in bytes of what `clearMediaCache` would clear. */
export async function getMediaCacheSize(): Promise<number> {
	const db = getDb();
	const details = DETAIL_COLUMNS.map((c) => `COALESCE(length(${c}), 0)`).join(' + ');
	const res = await db.query(
		`SELECT
			(SELECT COALESCE(SUM(length(data)), 0) FROM ApiCache) +
			(SELECT COALESCE(SUM(${details}), 0) FROM Media WHERE source != 'manual') AS size`,
	);
	const row = res.values?.[0];
	return Number(Array.isArray(row) ? row[0] : (row as { size?: number } | undefined)?.size) || 0;
}

/** Wipe everything, settings and cache included. Irreversible. */
export async function resetAllUserData(): Promise<void> {
	const db = getDb();
	const tables = [
		'ActivityLog',
		'WatchCycle',
		'TrackingStatus',
		'CollectionItem',
		'Collection',
		'Media',
		'ApiCache',
		'AppSettings',
		'Goal',
		'SyncTombstone',
	];
	for (const table of tables) {
		await db.run(`DELETE FROM ${table}`);
	}
}

// Left behind by the reverted anime season merge (bba2783): a pre-merge backup of the library.
const ANIME_MERGE_BACKUP_KEY = 'anime_merge_backup';
const ANIME_MERGE_LEFTOVER_KEYS = [
	ANIME_MERGE_BACKUP_KEY,
	'anime_merge_pending',
	'anime_series_ids',
	'feat_merge_anime_seasons',
];

/**
 * One-time cleanup after the anime season merge was reverted: if the merge ran on this
 * device, put the library back as it was before it, then drop the merge's settings.
 * Does nothing when the merge never ran.
 */
export async function restoreAnimeMergeBackupIfPresent(): Promise<boolean> {
	const db = getDb();
	const res = await db.query('SELECT value FROM AppSettings WHERE key = ?', [
		ANIME_MERGE_BACKUP_KEY,
	]);
	const row = res.values?.[0];
	const raw = Array.isArray(row) ? row[0] : (row as { value?: string } | undefined)?.value;
	if (!raw) return false;

	const backup: { db: string } = JSON.parse(raw);
	await importDatabaseJson(backup.db);
	for (const key of ANIME_MERGE_LEFTOVER_KEYS) {
		await db.run('DELETE FROM AppSettings WHERE key = ?', [key]);
	}
	return true;
}
