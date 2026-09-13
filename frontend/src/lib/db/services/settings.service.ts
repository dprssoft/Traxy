/**
 * Service for reading/writing AppSettings key-value pairs.
 * Wraps the AppSettings table in the local SQLite database.
 */
import { getDb } from '../index';

/**
 * Get a setting value by key. Returns null if not found.
 */
export async function getAppSetting(key: string): Promise<string | null> {
	const db = getDb();
	const result = await db.query('SELECT value FROM AppSettings WHERE key = ?', [key]);
	if (!result.values || result.values.length === 0) return null;
	const row = result.values[0];
	return Array.isArray(row) ? (row[0] as string) : (row as Record<string, string>).value;
}

/**
 * Get a boolean setting. Returns the default value if not found.
 */
export async function getAppSettingBool(key: string, defaultValue = false): Promise<boolean> {
	const val = await getAppSetting(key);
	if (val === null) return defaultValue;
	return val === 'true' || val === '1';
}

/**
 * Set a setting value by key. Creates or replaces.
 */
export async function setAppSetting(key: string, value: string): Promise<void> {
	const db = getDb();
	await db.run(
		'INSERT OR REPLACE INTO AppSettings (key, value) VALUES (?, ?)',
		[key, value],
	);
}

/**
 * Set a boolean setting.
 */
export async function setAppSettingBool(key: string, value: boolean): Promise<void> {
	await setAppSetting(key, value ? 'true' : 'false');
}
