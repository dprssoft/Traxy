import type { capSQLiteSet } from '@capacitor-community/sqlite';
import { getDb, saveDbToStore } from '../index';

// Keys written by the reverted anime season merge — excluded from exports and cleaned up on boot.
const ANIME_MERGE_BACKUP_KEY = 'anime_merge_backup';
const ANIME_MERGE_LEFTOVER_KEYS = [
	ANIME_MERGE_BACKUP_KEY,
	'anime_merge_pending',
	'anime_series_ids',
	'feat_merge_anime_seasons',
];

/**
 * Serialise the user's library as JSON (`{ version, timestamp, data: { <table>: rows } }`).
 * ApiCache is excluded (it's a cache). AppSettings is included as of v2.
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

	// Export AppSettings, filtering out transient migration keys
	const transientKeys = new Set(ANIME_MERGE_LEFTOVER_KEYS);
	const settingsRes = await db.query('SELECT * FROM AppSettings');
	exportData['AppSettings'] = (settingsRes.values || []).filter((row) => {
		const key = Array.isArray(row) ? (row[0] as string) : (row as Record<string, string>).key;
		return !transientKeys.has(key);
	});

	return JSON.stringify(
		{
			version: 2,
			timestamp: new Date().toISOString(),
			data: exportData,
		},
		null,
		2,
	);
}

/**
 * Replace every user table with the contents of a backup made by `exportDatabaseJson`.
 * All deletes and inserts run as one transaction, so a bad backup leaves the library untouched.
 * AppSettings is only restored from v2+ backups; v1 backups leave current settings intact.
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

		// v2+ backups include AppSettings — restore them so preferences survive reinstalls
		if ((parsed.version ?? 1) >= 2 && Array.isArray(data['AppSettings'])) {
			statements.push({ statement: 'DELETE FROM AppSettings', values: [] });
			const cols = ((await db.query('PRAGMA table_info(AppSettings)')).values ?? []).map(
				(c) => (c as { name?: string }).name,
			);
			for (const row of (data['AppSettings'] as BackupRow[]))
				statements.push(toInsert('AppSettings', row, cols));
		}

		await db.executeSet(statements, true);
		await saveDbToStore();
	} catch (err) {
		console.error('Import failed', err);
		throw err;
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
