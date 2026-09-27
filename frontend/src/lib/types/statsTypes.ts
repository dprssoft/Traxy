import type { MediaType } from '$lib/db/schema';

export type { MediaType };

export interface HeatmapDay {
	date: string; // YYYY-MM-DD
	count: number;
}

export interface GoalWithProgress {
	id: string;
	mediaType: MediaType | 'any';
	targetCount: number;
	year: number;
	current: number;
}
