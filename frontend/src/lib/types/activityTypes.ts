import type { ActivityEventType, MediaType } from '$lib/db/schema';

export type { ActivityEventType };

/** Parsed payload attached to each ActivityLog entry. */
export interface ActivityPayload {
	from?: string;
	to?: string;
	season?: number;
	episode?: number;
	chapter?: number;
	volume?: number;
	issue?: number;
	page?: number;
	hours?: number;
	score?: number;
	cycleNumber?: number;
	count?: number; // for mal_import
}

export type ActivityCategory = 'user_action' | 'system' | 'media_update';

/** Fully-typed ActivityLog row with payload already parsed from JSON. */
export interface ActivityItem {
	id: string;
	mediaId?: string;
	mediaTitle: string;
	mediaPosterUrl?: string;
	mediaType?: MediaType;
	eventType?: ActivityEventType;
	category?: ActivityCategory;
	actionText?: string;
	subtitle?: string;
	href?: string;
	icon?: string;
	payload?: ActivityPayload;
	occurredAt: string; // ISO
}

/**
 * A merged card when multiple consecutive episode_watched / chapter_read
 * events for the same media happen within a short time window.
 */
export interface GroupedActivityItem {
	/** Sentinel to distinguish from ActivityItem */
	isGroup: true;
	/** Stable key for #each – uses ids of constituent events joined */
	id: string;
	mediaId?: string;
	mediaTitle: string;
	mediaPosterUrl?: string;
	mediaType?: MediaType;
	eventType: ActivityEventType; // always episode_watched | chapter_read
	category: ActivityCategory;
	/** Range start (episode or chapter number) */
	from: number;
	/** Range end */
	to: number;
	/** Season (only for episode_watched, if all in same season) */
	season?: number;
	/** Number of items grouped */
	count: number;
	/** Timestamp of the newest item in the group */
	occurredAt: string;
}

export type FeedItem = ActivityItem | GroupedActivityItem;

export function isGrouped(item: FeedItem): item is GroupedActivityItem {
	return (item as GroupedActivityItem).isGroup === true;
}