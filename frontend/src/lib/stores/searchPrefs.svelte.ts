import {
	DEFAULT_SEARCH_PREFS,
	getSearchPrefs,
	setSearchPrefs,
	type SearchPrefs,
} from '$lib/db/services/settings.service';

export type { SearchPrefs };

function createSearchPrefsStore() {
	let prefs = $state<SearchPrefs>({ ...DEFAULT_SEARCH_PREFS });
	let loaded = false;

	return {
		get current() {
			return prefs;
		},

		async load() {
			if (loaded) return;
			try {
				prefs = await getSearchPrefs();
			} catch {
				// DB not ready yet; use defaults
			}
			loaded = true;
		},

		async save(next: SearchPrefs) {
			prefs = next;
			try {
				await setSearchPrefs(next);
			} catch (e) {
				console.error('Failed to save search prefs', e);
			}
		},
	};
}

/** Search merge preferences, kept in AppSettings. `load()` reads them once; until then defaults apply. */
export const searchPrefsStore = createSearchPrefsStore();
