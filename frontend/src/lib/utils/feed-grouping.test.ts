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
});
