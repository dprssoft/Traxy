import type { TrackingStatusType, CompletionTier } from '$lib/db/schema';
import type { LocalMedia } from './mediaTypes';

export type { TrackingStatusType, CompletionTier };

/** Full tracking record as stored in the local SQLite TrackingStatus table. */
export interface LocalTrackingStatus {
	id: string; // UUID
	mediaId: string;
	status: TrackingStatusType;
	score?: number; // 1–10
	note?: string;
	// Progress fields (type-dependent)
	currentEpisode?: number;
	currentSeason?: number;
	currentChapter?: number;
	currentVolume?: number;
	currentPage?: number;
	currentIssue?: number;
	hoursPlayed?: number;
	completionTier?: CompletionTier;
	createdAt: string; // ISO
	updatedAt: string; // ISO
}

/** A single watch/read/play cycle — one row per consumption attempt. */
export interface LocalWatchCycle {
	id: string; // UUID
	mediaId: string;
	cycleNumber: number; // 1 = first, 2 = rewatch #1, …
	startedAt?: string; // ISO date
	finishedAt?: string; // ISO date
}

/**
 * Joined view used on the My List page.
 * Combines the media record, its tracking status, and the latest open cycle.
 */
export interface TrackingListItem {
	media: LocalMedia;
	tracking: LocalTrackingStatus;
	latestCycle?: LocalWatchCycle;
}
