import { describe, it, expect } from 'vitest';
import { mergeSeasonTracking, seriesTrackingAsSeason } from './animeSeries.service';
import type { LocalTrackingStatus } from '$lib/types/trackingTypes';

// Tokyo Revengers: 24 + 13 + 13 episodes, fourth season still airing
const chain = [
	{ id: 120120, episodes: 24 },
	{ id: 142853, episodes: 13 },
	{ id: 163329, episodes: 13 },
	{ id: 178083, episodes: 0, status: 'RELEASING' },
];

function t(overrides: Partial<LocalTrackingStatus>): LocalTrackingStatus {
	return {
		id: 'x',
		mediaId: 'm',
		status: 'planned',
		createdAt: '2024-01-01T00:00:00Z',
		updatedAt: '2024-01-01T00:00:00Z',
		...overrides,
	};
}

describe('mergeSeasonTracking', () => {
	it('keeps the furthest progress as an absolute episode and the season it is in', () => {
		const merged = mergeSeasonTracking(chain, [
			{ seasonIndex: 0, tracking: t({ status: 'completed', currentEpisode: 24, score: 8, updatedAt: '2024-02-01T00:00:00Z' }) },
			{ seasonIndex: 1, tracking: t({ status: 'in_progress', currentEpisode: 5, score: 9, updatedAt: '2024-03-01T00:00:00Z' }) },
		]);
		expect(merged).toMatchObject({
			status: 'in_progress',
			currentEpisode: 29,
			currentSeason: 2,
			score: 9,
		});
	});

	it('counts a completed season with no episode count as fully watched', () => {
		const merged = mergeSeasonTracking(chain, [
			{ seasonIndex: 1, tracking: t({ status: 'completed' }) },
		]);
		expect(merged).toMatchObject({ currentEpisode: 37, currentSeason: 2 });
	});

	it('is completed only when the last season is, otherwise in progress', () => {
		const earlier = [
			{ seasonIndex: 0, tracking: t({ status: 'completed' }) },
			{ seasonIndex: 1, tracking: t({ status: 'completed' }) },
		];
		expect(mergeSeasonTracking(chain, earlier).status).toBe('in_progress');
		const all = [...earlier, { seasonIndex: 3, tracking: t({ status: 'completed' }) }];
		expect(mergeSeasonTracking(chain, all).status).toBe('completed');
	});

	it('keeps every note labelled by season, the earliest start and the latest update', () => {
		const merged = mergeSeasonTracking(chain, [
			{ seasonIndex: 1, tracking: t({ note: 'Great arc', createdAt: '2024-05-01T00:00:00Z', updatedAt: '2024-06-01T00:00:00Z' }) },
			{ seasonIndex: 0, tracking: t({ note: 'Slow start', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-02-01T00:00:00Z' }) },
		]);
		expect(merged.note).toBe('S1: Slow start\n\nS2: Great arc');
		expect(merged.createdAt).toBe('2024-01-01T00:00:00Z');
		expect(merged.updatedAt).toBe('2024-06-01T00:00:00Z');
	});
});

describe('seriesTrackingAsSeason', () => {
	it('turns absolute series progress back into season progress for re-merging', () => {
		const series = t({ status: 'in_progress', currentSeason: 2, currentEpisode: 29 });
		expect(seriesTrackingAsSeason(chain, series)).toMatchObject({
			seasonIndex: 1,
			tracking: { currentEpisode: 5 },
		});
	});

	it('round-trips through mergeSeasonTracking with a newly added season', () => {
		const series = seriesTrackingAsSeason(chain, t({ status: 'in_progress', currentSeason: 2, currentEpisode: 29 }));
		const merged = mergeSeasonTracking(chain, [
			series,
			{ seasonIndex: 2, tracking: t({ status: 'planned' }) },
		]);
		expect(merged).toMatchObject({ currentEpisode: 29, currentSeason: 2, status: 'in_progress' });
	});
});
