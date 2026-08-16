import { getDb } from '../index';
import type { OverviewStats, TimeStats, HeatmapDay, ScoreDistribution, RewatchStats, TimelineEntry } from '$lib/types/statsTypes';

export async function getOverviewStats(): Promise<OverviewStats> {
	const db = getDb();
	const stats: OverviewStats = {
		totalTracked: 0,
		totalCompleted: 0,
		totalInProgress: 0,
		totalPlanned: 0,
		averageScore: null,
		byType: {
			film: 0, tv: 0, anime: 0, game: 0,
			manga: 0, manhwa: 0, manhua: 0, comic: 0, book: 0,
		},
	};

	const result = await db.query(
		`SELECT t.status, t.score, m.type
		 FROM TrackingStatus t
		 JOIN Media m ON t.mediaId = m.id`
	);

	if (!result.values) return stats;

	let totalScore = 0;
	let scoreCount = 0;

	for (const row of result.values) {
		const [status, score, type] = row as [string, number | null, keyof OverviewStats['byType']];

		stats.totalTracked++;
		if (status === 'completed') stats.totalCompleted++;
		if (status === 'in_progress') stats.totalInProgress++;
		if (status === 'planned') stats.totalPlanned++;

		if (score !== null) {
			totalScore += score;
			scoreCount++;
		}

		if (stats.byType[type] !== undefined) {
			stats.byType[type]++;
		}
	}

	if (scoreCount > 0) {
		stats.averageScore = totalScore / scoreCount;
	}

	return stats;
}

export async function getTimeStats(): Promise<TimeStats> {
	const db = getDb();
	const stats: TimeStats = {
		filmHoursWatched: 0,
		tvHoursWatched: 0,
		animeHoursWatched: 0,
		gameHoursPlayed: 0,
		mangaChaptersRead: 0,
		booksChaptersRead: 0,
	};

	const result = await db.query(
		`SELECT m.type, t.hoursPlayed, t.currentChapter, t.currentEpisode
		 FROM TrackingStatus t
		 JOIN Media m ON t.mediaId = m.id`
	);

	if (!result.values) return stats;

	for (const row of result.values) {
		const [type, hours, chapter, episode] = row as [string, number | null, number | null, number | null];

		if (type === 'game' && hours) stats.gameHoursPlayed += hours;
		if (type === 'manga' && chapter) stats.mangaChaptersRead += chapter;
		if (type === 'book' && chapter) stats.booksChaptersRead += chapter;
		if (type === 'tv' && hours) stats.tvHoursWatched += hours; // Assuming hours are aggregated manually for now
		if (type === 'anime' && hours) stats.animeHoursWatched += hours;
		if (type === 'film' && hours) stats.filmHoursWatched += hours;
	}

	return stats;
}

export async function getScoreDistribution(): Promise<ScoreDistribution[]> {
	const db = getDb();
	const result = await db.query(
		`SELECT score, COUNT(*) as count
		 FROM TrackingStatus
		 WHERE score IS NOT NULL
		 GROUP BY score
		 ORDER BY score ASC`
	);

	const dist: ScoreDistribution[] = [];
	for (let i = 1; i <= 10; i++) {
		dist.push({ score: i, count: 0 });
	}

	if (result.values) {
		for (const row of result.values) {
			const [score, count] = row as [number, number];
			const entry = dist.find(d => d.score === score);
			if (entry) entry.count = count;
		}
	}

	return dist;
}

export async function getTopRewatched(limit = 10): Promise<RewatchStats[]> {
	const db = getDb();
	const result = await db.query(
		`SELECT m.id, m.title, m.posterUrl, m.type, MAX(w.cycleNumber) as cycleCount
		 FROM WatchCycle w
		 JOIN Media m ON w.mediaId = m.id
		 GROUP BY m.id
		 HAVING cycleCount > 1
		 ORDER BY cycleCount DESC
		 LIMIT ?`,
		[limit]
	);

	if (!result.values) return [];
	return result.values.map(row => {
		const [mediaId, title, posterUrl, type, cycleCount] = row as [string, string, string | null, string, number];
		return { mediaId, title, posterUrl: posterUrl ?? undefined, type: type as any, cycleCount };
	});
}

export async function getTimeline(limit = 50): Promise<TimelineEntry[]> {
	const db = getDb();
	const result = await db.query(
		`SELECT m.id, m.title, m.posterUrl, m.type, w.cycleNumber, w.startedAt, w.finishedAt
		 FROM WatchCycle w
		 JOIN Media m ON w.mediaId = m.id
		 ORDER BY COALESCE(w.finishedAt, w.startedAt) DESC
		 LIMIT ?`,
		[limit]
	);

	if (!result.values) return [];
	return result.values.map(row => {
		const [mediaId, title, posterUrl, type, cycleNumber, startedAt, finishedAt] = row as [string, string, string | null, string, number, string | null, string | null];
		return {
			mediaId, title, posterUrl: posterUrl ?? undefined, type: type as any,
			cycleNumber, startedAt: startedAt ?? undefined, finishedAt: finishedAt ?? undefined
		};
	});
}
