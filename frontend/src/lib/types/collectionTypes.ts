import type { MediaType, SystemCollectionKey } from '$lib/db/schema';
import type { LocalMedia } from './mediaTypes';

export type { SystemCollectionKey };

/** A collection as shown in lists and pickers. */
export interface CollectionSummary {
	id: string;
	name: string;
	description?: string;
	/** null = shared: accepts any media type. */
	mediaType: MediaType | null;
	systemKey: SystemCollectionKey | null;
	isRanked: boolean;
	itemCount: number;
	/** Up to four poster URLs, in collection order, for the cover mosaic. */
	coverUrls: string[];
	createdAt: string;
	updatedAt: string;
}

/** One media item inside a collection. */
export interface CollectionEntry {
	itemId: string;
	media: LocalMedia;
	sortOrder: number;
	addedAt: string;
	note?: string;
}

export interface CollectionInput {
	name: string;
	description?: string;
	mediaType: MediaType | null;
	isRanked?: boolean;
}
