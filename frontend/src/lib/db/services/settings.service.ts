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

export interface TrackingTypeFilterPrefs {
	/** Media types in the user's preferred chip order (may be partial). */
	order: string[];
	/** Show chips for types that have no tracked items. */
	showUntracked: boolean;
}

const TRACKING_TYPE_FILTERS_KEY = 'tracking_type_filters';

export async function getTrackingTypeFilterPrefs(): Promise<TrackingTypeFilterPrefs> {
	const fallback = { order: [], showUntracked: false };
	try {
		const raw = await getAppSetting(TRACKING_TYPE_FILTERS_KEY);
		return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
	} catch {
		return fallback;
	}
}

export async function setTrackingTypeFilterPrefs(prefs: TrackingTypeFilterPrefs): Promise<void> {
	await setAppSetting(TRACKING_TYPE_FILTERS_KEY, JSON.stringify(prefs));
}

export interface BottomNavPrefs {
	/** Feature flag: when false the default bottom bar is shown. */
	enabled: boolean;
	/** Shortcut ids (nav hrefs) in bar order; null = defaults. */
	ids: string[] | null;
}

const BOTTOM_NAV_FLAG = 'feat_custom_bottom_nav';
const BOTTOM_NAV_ITEMS_KEY = 'bottom_nav_items';

export async function getBottomNavPrefs(): Promise<BottomNavPrefs> {
	const enabled = await getAppSettingBool(BOTTOM_NAV_FLAG, true);
	try {
		const raw = await getAppSetting(BOTTOM_NAV_ITEMS_KEY);
		const ids = raw ? JSON.parse(raw) : null;
		return { enabled, ids: Array.isArray(ids) ? ids : null };
	} catch {
		return { enabled, ids: null };
	}
}

export async function setBottomNavIds(ids: string[] | null): Promise<void> {
	const db = getDb();
	if (ids === null) {
		await db.run('DELETE FROM AppSettings WHERE key = ?', [BOTTOM_NAV_ITEMS_KEY]);
	} else {
		await setAppSetting(BOTTOM_NAV_ITEMS_KEY, JSON.stringify(ids));
	}
}

export async function setBottomNavEnabled(enabled: boolean): Promise<void> {
	await setAppSettingBool(BOTTOM_NAV_FLAG, enabled);
}

export type AdultFilterMode = 'hide' | 'blur';

export interface ContentFilterPrefs {
	/** Feature flag: when false, adult content is shown unfiltered. */
	enabled: boolean;
	/** How adult content is treated while the filter is on. */
	mode: AdultFilterMode;
	/** False until the user has answered the first-launch prompt (flag never written). */
	asked: boolean;
}

const ADULT_FILTER_FLAG = 'feat_adult_filter';
const ADULT_FILTER_MODE_KEY = 'adult_filter_mode';

export async function getContentFilterPrefs(): Promise<ContentFilterPrefs> {
	const flag = await getAppSetting(ADULT_FILTER_FLAG);
	const mode = await getAppSetting(ADULT_FILTER_MODE_KEY);
	return {
		enabled: flag === null ? true : flag === 'true' || flag === '1',
		mode: mode === 'blur' ? 'blur' : 'hide',
		asked: flag !== null,
	};
}

export async function setContentFilterEnabled(enabled: boolean): Promise<void> {
	await setAppSettingBool(ADULT_FILTER_FLAG, enabled);
}

export async function setContentFilterMode(mode: AdultFilterMode): Promise<void> {
	await setAppSetting(ADULT_FILTER_MODE_KEY, mode);
}

const WIKI_ENRICHMENT_FLAG = 'feat_wikipedia_enrichment';

export async function getWikiEnrichmentEnabled(): Promise<boolean> {
	return getAppSettingBool(WIKI_ENRICHMENT_FLAG, false);
}

export async function setWikiEnrichmentEnabled(enabled: boolean): Promise<void> {
	await setAppSettingBool(WIKI_ENRICHMENT_FLAG, enabled);
}
