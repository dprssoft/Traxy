import type { capSQLiteSet } from '@capacitor-community/sqlite';
import { getDb } from '../index';

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

/**
 * Serialise the user's library and settings as JSON
 * (`{ version, timestamp, data: { <table>: rows }, settings }`).
 * ApiCache and API keys are not included.
 */
export async function exportDatabaseJson(): Promise<string> {
	const db = getDb();
	const tables = [
		'Media',
		'TrackingStatus',
		'WatchCycle',
		'ActivityLog',
		'Collection',
		'CollectionItem',
		'Goal',
	];

	const exportData: Record<string, unknown[]> = {};

	for (const table of tables) {
		const res = await db.query(`SELECT * FROM ${table}`);
		exportData[table] = res.values || [];
	}

	return JSON.stringify(
		{
			version: 2,
			timestamp: new Date().toISOString(),
			data: exportData,
			settings: await exportSettings(),
		},
		null,
		2,
	);
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
 * Replace every user table with the contents of a backup made by `exportDatabaseJson`.
 * All deletes and inserts run as one transaction, so a bad backup leaves the library untouched.
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

		// Foreign keys are off by default in capacitor-sqlite, so table order doesn't matter here.
		const tables = [
			'Goal',
			'ActivityLog',
			'WatchCycle',
			'TrackingStatus',
			'CollectionItem',
			'Collection',
			'Media',
		];

		for (const table of tables) {
			statements.push({ statement: `DELETE FROM ${table}`, values: [] });

			const rows: BackupRow[] = data[table] || [];
			if (rows.length === 0) continue;

			const columns = ((await db.query(`PRAGMA table_info(${table})`)).values ?? []).map(
				(c) => (c as { name?: string }).name,
			);
			for (const row of rows) statements.push(toInsert(table, row, columns));
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
			const columns = ((await db.query('PRAGMA table_info(AppSettings)')).values ?? []).map(
				(c) => (c as { name?: string }).name,
			);
			for (const row of settingRows) statements.push(toInsert('AppSettings', row, columns));
		}

		await db.executeSet(statements, true);

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

// Backups hold rows as the driver returned them: objects keyed by column (current), or
// positional arrays (older exports).
type BackupRow = Record<string, unknown> | unknown[];

function toInsert(table: string, row: BackupRow, columns: (string | undefined)[]): capSQLiteSet {
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

/** Drop cached provider responses. The library itself is untouched. */
export async function clearMediaCache(): Promise<void> {
	const db = getDb();
	await db.run('DELETE FROM ApiCache');
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
