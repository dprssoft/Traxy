import { getDb } from '$lib/db/index';

export interface SearchPrefs {
	/** AniList wins over TMDB for anime/TV overlap (e.g. Jujutsu Kaisen won't show as TV) */
	anilistWinsAnime: boolean;
	/** AniList wins over OpenLibrary/ComicVine for manga/manhwa/manhua exact titles */
	anilistWinsManga: boolean;
	/** Suppress OpenLibrary volume entries (e.g. "Gantz Volume 1") when AniList has the series */
	suppressMangaVolumes: boolean;
}

const SETTINGS_KEY = 'search_prefs';

const defaults: SearchPrefs = {
	anilistWinsAnime: true,
	anilistWinsManga: true,
	suppressMangaVolumes: true,
};

function createSearchPrefsStore() {
	let prefs = $state<SearchPrefs>({ ...defaults });
	let loaded = false;

	return {
		get current() { return prefs; },

		async load() {
			if (loaded) return;
			try {
				const db = getDb();
				const result = await db.query('SELECT value FROM AppSettings WHERE key = ?', [SETTINGS_KEY]);
				if (result.values && result.values.length > 0) {
					const raw = result.values[0];
					const val = typeof raw === 'string' ? raw : (Array.isArray(raw) ? raw[0] : raw?.value);
					if (val) prefs = { ...defaults, ...JSON.parse(val) };
				}
			} catch {
				// DB not ready yet; use defaults
			}
			loaded = true;
		},

		async save(next: SearchPrefs) {
			prefs = next;
			try {
				const db = getDb();
				await db.run(
					'INSERT OR REPLACE INTO AppSettings (key, value) VALUES (?, ?)',
					[SETTINGS_KEY, JSON.stringify(next)]
				);
			} catch (e) {
				console.error('Failed to save search prefs', e);
			}
		},
	};
}

export const searchPrefsStore = createSearchPrefsStore();
