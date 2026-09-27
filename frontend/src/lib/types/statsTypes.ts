import type { MediaType } from '$lib/db/schema';

export type { MediaType };

export interface GoalWithProgress {
	id: string;
	mediaType: MediaType | 'any';
	targetCount: number;
	year: number;
	current: number;
}
