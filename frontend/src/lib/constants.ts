import type { MediaType } from '$lib/types/mediaTypes';

export const DEFAULT_COLLECTION_NAME = 'Favorites';

// ---------------------------------------------------------------------------
// Tracking status labels — media-type-aware
// ---------------------------------------------------------------------------

export type MediaTypeGroup = 'watch' | 'game' | 'read';

export function getMediaTypeGroup(type: MediaType): MediaTypeGroup {
	if (type === 'game') return 'game';
	if (type === 'film' || type === 'tv' || type === 'anime') return 'watch';
	return 'read'; // manga, manhwa, manhua, comic, book
}

export const STATUS_LABELS_BY_GROUP: Record<MediaTypeGroup, Record<string, string>> = {
	watch: {
		planned: 'Planned',
		in_progress: 'Watching',
		completed: 'Completed',
		dropped: 'Dropped',
		paused: 'Paused',
	},
	game: {
		planned: 'Planned',
		in_progress: 'Playing',
		completed: 'Completed',
		dropped: 'Dropped',
		paused: 'Paused',
		watched_letsplay: 'Watched Let\'s Play',
	},
	read: {
		planned: 'Planned',
		in_progress: 'Reading',
		completed: 'Read',
		dropped: 'Dropped',
		paused: 'Paused',
	},
};

/**
 * Returns the context-appropriate status label.
 * Use this everywhere a status label is displayed.
 */
export function getStatusLabel(status: string, mediaType: MediaType): string {
	return STATUS_LABELS_BY_GROUP[getMediaTypeGroup(mediaType)][status] ?? status;
}

/**
 * Generic fallback labels used on the My List page where items span multiple
 * media types and a single label must cover all of them.
 */
export const TRACKING_STATUS_LABELS_GENERIC: Record<string, string> = {
	planned: 'Planned',
	in_progress: 'In Progress',
	completed: 'Completed',
	dropped: 'Dropped',
	paused: 'Paused',
	watched_letsplay: 'Watched Let\'s Play',
};

// ---------------------------------------------------------------------------
// Rewatch / reread / replay labels (for the "do it again" button)
// ---------------------------------------------------------------------------

export const REWATCH_LABELS: Record<MediaType, string> = {
	film: 'Watch again',
	tv: 'Watch again',
	anime: 'Watch again',
	game: 'Play again',
	manga: 'Read again',
	manhwa: 'Read again',
	manhua: 'Read again',
	comic: 'Read again',
	book: 'Read again',
};

export const REWATCH_CYCLE_LABELS: Record<MediaType, string> = {
	film: 'Rewatch',
	tv: 'Rewatch',
	anime: 'Rewatch',
	game: 'Replay',
	manga: 'Reread',
	manhwa: 'Reread',
	manhua: 'Reread',
	comic: 'Reread',
	book: 'Reread',
};

// ---------------------------------------------------------------------------
// Media type display labels
// ---------------------------------------------------------------------------

export const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
	film: 'Film',
	tv: 'TV Series',
	game: 'Game',
	anime: 'Anime',
	manga: 'Manga',
	manhwa: 'Manhwa',
	manhua: 'Manhua',
	comic: 'Comic',
	book: 'Book',
};

// ---------------------------------------------------------------------------
// Report / moderation labels (kept for any remaining usages)
// ---------------------------------------------------------------------------

export const REPORT_REASON_LABELS: Record<string, string> = {
	Spam: 'Spam',
	Harassment: 'Harassment',
	HateSpeech: 'Hate Speech',
	Misinformation: 'Misinformation',
	InappropriateContent: 'Inappropriate Content',
	Other: 'Other',
};

export const LANG_LABELS: Record<string, string> = {
	uk: 'Ukrainian',
	en: 'English',
};