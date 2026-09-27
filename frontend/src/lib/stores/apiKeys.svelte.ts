interface ApiKeys {
	tmdb: string;
	comicvine: string;
	igdbClientId: string;
	igdbClientSecret: string;
}

const DEFAULT_KEYS: ApiKeys = { tmdb: '', comicvine: '', igdbClientId: '', igdbClientSecret: '' };

function loadApiKeys(): ApiKeys {
	const stored = localStorage.getItem('traxy:apiKeys');
	if (stored) {
		try {
			return { ...DEFAULT_KEYS, ...JSON.parse(stored) };
		} catch {
			return DEFAULT_KEYS;
		}
	}
	return DEFAULT_KEYS;
}

/**
 * Provider API keys the user entered under Settings → API Keys. Stored in localStorage on this
 * device only; sources fall back to the optional `VITE_*` env keys when a field is empty.
 */
export const apiKeyStore = $state<{ current: ApiKeys }>({ current: DEFAULT_KEYS });

if (typeof window !== 'undefined') {
	apiKeyStore.current = loadApiKeys();
}

/** Merge `keys` into the stored keys and persist them. */
export function saveApiKeys(keys: Partial<ApiKeys>) {
	apiKeyStore.current = { ...apiKeyStore.current, ...keys };
	localStorage.setItem('traxy:apiKeys', JSON.stringify(apiKeyStore.current));
}
