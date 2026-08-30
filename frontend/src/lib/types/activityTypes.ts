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