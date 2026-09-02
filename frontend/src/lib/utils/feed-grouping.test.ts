import { describe, it, expect } from 'vitest';
import { groupConsecutiveProgress } from './feed';
import type { ActivityItem, GroupedActivityItem } from '$lib/types/activityTypes';
import { isGrouped } from '$lib/types/activityTypes';

function makeItem(overrides: Partial<ActivityItem>): ActivityItem {
	return {
		id: Math.random().toString(36).slice(2),
		mediaId: 'media-1',
		mediaTitle: 'Test Anime',
		mediaType: 'anime',
		eventType: 'episode_watched',
		category: 'user_action',
		occurredAt: new Date('2026-06-01T12:00:00Z').toISOString(),
		payload: {},
		...overrides,
	};
}

describe('groupConsecutiveProgress', () => {
	it('returns empty array when given empty list', () => {
		expect(groupConsecutiveProgress([])).toEqual([]);
	});

	it('returns single item unchanged', () => {
		const item = makeItem({ payload: { episode: 1 } });
		const result = groupConsecutiveProgress([item]);
		expect(result).toHaveLength(1);
		expect(isGrouped(result[0])).toBe(false);
	});

	it('groups consecutive episodes within 2 hours (newest-first)', () => {
		// Newest to oldest: ep 3 (12:30), ep 2 (12:15), ep 1 (12:00)
		const ep3 = makeItem({
			id: 'ep3',
			occurredAt: '2026-06-01T12:30:00Z',
			payload: { episode: 3, season: 1 },
		});
		const ep2 = makeItem({
			id: 'ep2',
			occurredAt: '2026-06-01T12:15:00Z',
			payload: { episode: 2, season: 1 },
		});
		const ep1 = makeItem({
			id: 'ep1',
			occurredAt: '2026-06-01T12:00:00Z',
			payload: { episode: 1, season: 1 },
		});

		const result = groupConsecutiveProgress([ep3, ep2, ep1]);
		expect(result).toHaveLength(1);
		expect(isGrouped(result[0])).toBe(true);

		const grouped = result[0] as GroupedActivityItem;
		expect(grouped.from).toBe(1);
		expect(grouped.to).toBe(3);
		expect(grouped.count).toBe(3);
		expect(grouped.season).toBe(1);
		expect(grouped.occurredAt).toBe('2026-06-01T12:30:00Z');
	});

	it('groups consecutive manga chapters', () => {
		const ch12 = makeItem({
			id: 'ch12',
			mediaType: 'manga',
			eventType: 'chapter_read',
			occurredAt: '2026-06-01T14:20:00Z',
			payload: { chapter: 12 },
		});
		const ch11 = makeItem({
			id: 'ch11',
			mediaType: 'manga',
			eventType: 'chapter_read',
			occurredAt: '2026-06-01T14:10:00Z',
			payload: { chapter: 11 },
		});
		const ch10 = makeItem({
			id: 'ch10',
			mediaType: 'manga',
			eventType: 'chapter_read',
			occurredAt: '2026-06-01T14:00:00Z',
			payload: { chapter: 10 },
		});

		const result = groupConsecutiveProgress([ch12, ch11, ch10]);
		expect(result).toHaveLength(1);
		const grouped = result[0] as GroupedActivityItem;
		expect(grouped.from).toBe(10);
		expect(grouped.to).toBe(12);
		expect(grouped.count).toBe(3);
	});

	it('does not group across gaps larger than 2 hours', () => {
		// Ep 2 is 3 hours after Ep 1
		const ep2 = makeItem({
			id: 'ep2',
			occurredAt: '2026-06-01T15:00:00Z',
			payload: { episode: 2 },
		});
		const ep1 = makeItem({
			id: 'ep1',
			occurredAt: '2026-06-01T12:00:00Z',
			payload: { episode: 1 },
		});

		const result = groupConsecutiveProgress([ep2, ep1]);
		expect(result).toHaveLength(2);
		expect(isGrouped(result[0])).toBe(false);
		expect(isGrouped(result[1])).toBe(false);
	});

	it('does not group when another media item is interleaved', () => {
		const a2 = makeItem({
			id: 'a2',
			mediaId: 'media-A',
			occurredAt: '2026-06-01T12:20:00Z',
			payload: { episode: 2 },
		});
		const b1 = makeItem({
			id: 'b1',
			mediaId: 'media-B',
			occurredAt: '2026-06-01T12:10:00Z',
			payload: { episode: 1 },
		});
		const a1 = makeItem({
			id: 'a1',
			mediaId: 'media-A',
			occurredAt: '2026-06-01T12:00:00Z',
			payload: { episode: 1 },
		});

		const result = groupConsecutiveProgress([a2, b1, a1]);
		expect(result).toHaveLength(3);
		expect(isGrouped(result[0])).toBe(false);
		expect(isGrouped(result[1])).toBe(false);
		expect(isGrouped(result[2])).toBe(false);
	});

	it('does not group backwards progress or corrections (strictly decreasing newest-first)', () => {
		// If input is ep1 (newest) followed by ep2 (older), it was a decrement
		const ep1Newest = makeItem({
			id: 'ep1',
			occurredAt: '2026-06-01T12:10:00Z',
			payload: { episode: 1 },
		});
		const ep2Oldest = makeItem({
			id: 'ep2',
			occurredAt: '2026-06-01T12:00:00Z',
			payload: { episode: 2 },
		});

		const result = groupConsecutiveProgress([ep1Newest, ep2Oldest]);
		expect(result).toHaveLength(2);
		expect(isGrouped(result[0])).toBe(false);
		expect(isGrouped(result[1])).toBe(false);
	});

	it('omits season field when episodes span multiple seasons', () => {
		const s2e1 = makeItem({
			id: 's2e1',
			occurredAt: '2026-06-01T12:20:00Z',
			payload: { episode: 13, season: 2 },
		});
		const s1e12 = makeItem({
			id: 's1e12',
			occurredAt: '2026-06-01T12:00:00Z',
			payload: { episode: 12, season: 1 },
		});

		const result = groupConsecutiveProgress([s2e1, s1e12]);
		expect(result).toHaveLength(1);
		const grouped = result[0] as GroupedActivityItem;
		expect(grouped.from).toBe(12);
		expect(grouped.to).toBe(13);
		expect(grouped.season).toBeUndefined();
	});

	it('breaks grouping when interrupted by non-progress events', () => {
		const ep3 = makeItem({
			id: 'ep3',
			occurredAt: '2026-06-01T12:30:00Z',
			payload: { episode: 3 },
		});
		const statusChanged = makeItem({
			id: 'sc',
			eventType: 'status_changed',
			occurredAt: '2026-06-01T12:15:00Z',
			payload: { to: 'completed' },
		});
		const ep2 = makeItem({
			id: 'ep2',
			occurredAt: '2026-06-01T12:00:00Z',
			payload: { episode: 2 },
		});

		const result = groupConsecutiveProgress([ep3, statusChanged, ep2]);
		expect(result).toHaveLength(3);
		expect(isGrouped(result[0])).toBe(false);
		expect(isGrouped(result[1])).toBe(false);
		expect(isGrouped(result[2])).toBe(false);
	});

	it('REGRESSION: groups chapters that are only 1 ms apart (backdate after decrement correction)', () => {
		// After a decrement correction, tracking.service backdates the new log to
		// predecessor.occurredAt + 1 ms. Both items must still be grouped.
		const base = new Date('2026-06-01T12:00:00.000Z').getTime();
		const ch4 = makeItem({
			id: 'ch4',
			mediaType: 'manga',
			eventType: 'chapter_read',
			occurredAt: new Date(base + 1).toISOString(), // +1 ms newer
			payload: { chapter: 4 },
		});
		const ch3 = makeItem({
			id: 'ch3',
			mediaType: 'manga',
			eventType: 'chapter_read',
			occurredAt: new Date(base).toISOString(),
			payload: { chapter: 3 },
		});

		// Feed is newest-first: ch4 then ch3
		const result = groupConsecutiveProgress([ch4, ch3]);
		expect(result).toHaveLength(1);
		const grouped = result[0] as GroupedActivityItem;
		expect(isGrouped(grouped)).toBe(true);
		expect(grouped.from).toBe(3);
		expect(grouped.to).toBe(4);
		expect(grouped.count).toBe(2);
	});

	it('preserves separate streaks when reading media A, then media B, then media A again', () => {
		// Media A streak 2 (newest, chapters 4-5)
		const a5 = makeItem({
			id: 'a5',
			mediaId: 'media-A',
			mediaType: 'manga',
			eventType: 'chapter_read',
			occurredAt: '2026-06-01T14:00:01Z',
			payload: { chapter: 5 },
		});
		const a4 = makeItem({
			id: 'a4',
			mediaId: 'media-A',
			mediaType: 'manga',
			eventType: 'chapter_read',
			occurredAt: '2026-06-01T14:00:00Z',
			payload: { chapter: 4 },
		});

		// Media B streak (middle, episodes 1-2)
		const b2 = makeItem({
			id: 'b2',
			mediaId: 'media-B',
			eventType: 'episode_watched',
			occurredAt: '2026-06-01T13:00:01Z',
			payload: { episode: 2 },
		});
		const b1 = makeItem({
			id: 'b1',
			mediaId: 'media-B',
			eventType: 'episode_watched',
			occurredAt: '2026-06-01T13:00:00Z',
			payload: { episode: 1 },
		});

		// Media A streak 1 (oldest, chapters 1-3)
		const a3 = makeItem({
			id: 'a3',
			mediaId: 'media-A',
			mediaType: 'manga',
			eventType: 'chapter_read',
			occurredAt: '2026-06-01T12:00:02Z',
			payload: { chapter: 3 },
		});
		const a2 = makeItem({
			id: 'a2',
			mediaId: 'media-A',
			mediaType: 'manga',
			eventType: 'chapter_read',
			occurredAt: '2026-06-01T12:00:01Z',
			payload: { chapter: 2 },
		});
		const a1 = makeItem({
			id: 'a1',
			mediaId: 'media-A',
			mediaType: 'manga',
			eventType: 'chapter_read',
			occurredAt: '2026-06-01T12:00:00Z',
			payload: { chapter: 1 },
		});

		const result = groupConsecutiveProgress([a5, a4, b2, b1, a3, a2, a1]);

		expect(result).toHaveLength(3);

		// First entry: Media A chapters 4-5
		expect(isGrouped(result[0])).toBe(true);
		const g1 = result[0] as GroupedActivityItem;
		expect(g1.mediaId).toBe('media-A');
		expect(g1.from).toBe(4);
		expect(g1.to).toBe(5);

		// Second entry: Media B episodes 1-2
		expect(isGrouped(result[1])).toBe(true);
		const g2 = result[1] as GroupedActivityItem;
		expect(g2.mediaId).toBe('media-B');
		expect(g2.from).toBe(1);
		expect(g2.to).toBe(2);

		// Third entry: Media A chapters 1-3
		expect(isGrouped(result[2])).toBe(true);
		const g3 = result[2] as GroupedActivityItem;
		expect(g3.mediaId).toBe('media-A');
		expect(g3.from).toBe(1);
		expect(g3.to).toBe(3);
	});
});
