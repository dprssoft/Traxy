import type { MediaType } from '$lib/db/schema';

/** App-wide search bar state. Recent searches persist in localStorage. */
export const searchState = $state({
	selectedType: 'all' as MediaType | 'all',
	recentSearches: [] as string[],
	isOpen: false, // For search overlay/modal state
});

/** Move `query` to the front of the recent list (max 10, no duplicates) and persist it. */
export function addRecentSearch(query: string) {
	const trimmed = query.trim();
	if (!trimmed) return;
	
	const idx = searchState.recentSearches.indexOf(trimmed);
	if (idx > -1) {
		searchState.recentSearches.splice(idx, 1);
	}
	
	searchState.recentSearches.unshift(trimmed);
	if (searchState.recentSearches.length > 10) {
		searchState.recentSearches.pop();
	}
	
	// Persist to localStorage
	if (typeof localStorage !== 'undefined') {
		localStorage.setItem('traxy:recent_searches', JSON.stringify(searchState.recentSearches));
	}
}

/** Restore recent searches from localStorage; call once on the client. */
export function loadRecentSearches() {
	if (typeof localStorage !== 'undefined') {
		const stored = localStorage.getItem('traxy:recent_searches');
		if (stored) {
			try {
				searchState.recentSearches = JSON.parse(stored);
			} catch {
				// Ignore
			}
		}
	}
}

/** Tailwind classes for a media-type badge; reading types share one colour. */
export function getTypeColor(type: MediaType | 'all'): string {
	switch (type) {
		case 'film': return 'bg-blue-500/20 text-blue-400';
		case 'tv': return 'bg-purple-500/20 text-purple-400';
		case 'anime': return 'bg-pink-500/20 text-pink-400';
		case 'game': return 'bg-green-500/20 text-green-400';
		case 'manga':
		case 'manhwa':
		case 'manhua':
		case 'comic':
		case 'book': return 'bg-yellow-500/20 text-yellow-400';
		default: return 'bg-gray-500/20 text-gray-400';
	}
}
