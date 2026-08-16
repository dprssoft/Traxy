import type { MediaType } from '$lib/db/schema';

export type { MediaType };

export interface OverviewStats {
	totalTracked: number;
	totalCompleted: number;
	totalInProgress: number;
	totalPlanned: number;
	averageScore: number | null;
	byType: Record<MediaType, number>;
}

export interface TimeStats {
	filmHoursWatched: number; // TMDB runtime * cycles
	tvHoursWatched: number;
	animeHoursWatched: number;
	gameHoursPlayed: number; // SUM(hoursPlayed)
	mangaChaptersRead: number;
	booksChaptersRead: number;
}

export interface HeatmapDay {
	date: string; // YYYY-MM-DD
	count: number;
}

export interface ScoreDistribution {
	score: number; // 1-10
	count: number;
}

export interface RewatchStats {
	mediaId: string;
	title: string;
	posterUrl?: string;
	type: MediaType;
	cycleCount: number;
}

export interface TimelineEntry {
	mediaId: string;
	title: string;
	posterUrl?: string;
	type: MediaType;
	cycleNumber: number;
	startedAt?: string;
	finishedAt?: string;
}

export interface GoalWithProgress {
	id: string;
	mediaType: MediaType | 'any';
	targetCount: number;
	year: number;
	current: number;
}