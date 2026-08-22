import type { SearchResult } from '$lib/types/mediaTypes';
import type { SearchPrefs } from '$lib/stores/searchPrefs.svelte';

/** Media types that belong to the anime/manga family (AniList is authoritative). */
const ANILIST_TYPES = new Set(['anime', 'manga', 'manhwa', 'manhua'] as const);

/**
 * Sources whose results should be suppressed when AniList already has the same
 * title in the anime/manga family.
 */
const SUPPRESSIBLE_SOURCES = new Set(['tmdb', 'openlibrary', 'comicvine'] as const);

/**
 * Matches the suffix that identifies a manga/book volume entry, e.g.:
 * "Volume 1", "Vol. 38", "Vol 2", "Part 3", "Tome 5", "#12", "Chapter 10"
 * Used so that "Gantz Volume 1" is suppressed but "Gantz: A Cultural Study" is NOT.
 */
const VOLUME_SUFFIX_RE = /^(vol(ume|\.?)?|part|tome|chapter|#)\s*\d+$/;

/**
 * Normalize a title for fuzzy deduplication:
 *   - lowercase
 *   - strip punctuation and diacritics
 *   - collapse whitespace
 */
export function normalizeTitle(title: string): string {
	return title
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '') // strip combining diacritics
		.replace(/[^a-z0-9\s]/g, '')     // strip punctuation
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Remove duplicate entries that represent the same underlying work.
 *
 * Rules (each individually togglable via `prefs`):
 * 1. [anilistWinsAnime]   If AniList has the title as anime, TMDB TV/film for the same
 *    normalized title is suppressed — regardless of the active search filter.
 * 2. [anilistWinsManga]   If AniList has the title as manga/manhwa/manhua, OpenLibrary
 *    book and ComicVine comic entries with the same exact normalized title are suppressed.
 * 3. [suppressMangaVolumes] Additionally suppress OpenLibrary entries whose title matches
 *    "<manga title> Volume/Vol/Part/Tome/Chapter N" — but NOT other suffixes (so a real
 *    book "Gantz: A Cultural Study" is kept).
 * 4. AniList results sort before others in the surviving set.
 */
export function deduplicateResults(
	results: SearchResult[],
	prefs: SearchPrefs = { anilistWinsAnime: true, anilistWinsManga: true, suppressMangaVolumes: true },
): SearchResult[] {
	// Build separate sets for anime and manga/manhwa/manhua covered by AniList.
	const anilistAnime = new Set<string>();
	const anilistManga = new Set<string>();
	for (const r of results) {
		if (r.source !== 'anilist') continue;
		const norm = normalizeTitle(r.title);
		if (r.type === 'anime') anilistAnime.add(norm);
		if (['manga', 'manhwa', 'manhua'].includes(r.type)) anilistManga.add(norm);
	}

	/**
	 * Returns true if a result title is covered by an AniList entry.
	 *
	 * - Exact match: "Gantz" book → suppressed when anilistWinsManga is on.
	 * - Volume suffix: "Gantz Volume 1" → suppressed when suppressMangaVolumes is on.
	 * - Anime TMDB: "Jujutsu Kaisen" TV → suppressed when anilistWinsAnime is on.
	 * - Other suffixes: "Gantz: A Cultural Study" → never suppressed (not a volume number).
	 */
	function isCoveredByAnilist(r: SearchResult): boolean {
		const normalized = normalizeTitle(r.title);

		// Anime suppression: TMDB TV/film that AniList covers as anime.
		if (prefs.anilistWinsAnime && (r.source === 'tmdb')) {
			if (anilistAnime.has(normalized)) return true;
		}

		// Manga suppression: exact title match from OL or CV.
		if (prefs.anilistWinsManga && (r.source === 'openlibrary' || r.source === 'comicvine')) {
			if (anilistManga.has(normalized)) return true;
		}

		// Volume-suffix suppression: "Gantz Volume 1" from OL.
		if (prefs.suppressMangaVolumes && r.source === 'openlibrary') {
			for (const covered of anilistManga) {
				if (!normalized.startsWith(covered + ' ')) continue;
				const suffix = normalized.slice(covered.length + 1).trim();
				if (VOLUME_SUFFIX_RE.test(suffix)) return true;
			}
		}

		return false;
	}

	// Filter out suppressible results covered by AniList (respecting user prefs).
	const deduped = results.filter((r) => {
		if (r.source === 'anilist') return true; // AniList results always kept
		if (!SUPPRESSIBLE_SOURCES.has(r.source as any)) return true;
		return !isCoveredByAnilist(r);
	});

	// Stable sort: AniList first, then others in original order.
	deduped.sort((a, b) => {
		if (a.source === 'anilist' && b.source !== 'anilist') return -1;
		if (a.source !== 'anilist' && b.source === 'anilist') return 1;
		return 0;
	});

	return deduped;
}
