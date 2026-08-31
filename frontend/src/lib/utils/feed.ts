import type { ActivityItem, FeedItem, GroupedActivityItem } from '$lib/types/activityTypes';

export const DEFAULT_MAX_GROUP_GAP_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Merge consecutive episode_watched / chapter_read events for the same media
 * when the time gap between any two adjacent ones is <= maxGapMs and there
 * are no other event types in between.
 *
 * Incoming items are assumed to be sorted newest-first (descending occurredAt).
 */
export function groupConsecutiveProgress(
	items: ActivityItem[],
	maxGapMs: number = DEFAULT_MAX_GROUP_GAP_MS
): FeedItem[] {
	const result: FeedItem[] = [];
	let i = 0;
	while (i < items.length) {
		const cur = items[i];
		const isProgress =
			cur.eventType === 'episode_watched' || cur.eventType === 'chapter_read';

		if (!isProgress) {
			result.push(cur);
			i++;
			continue;
		}

		// Collect run of same media + same eventType within time window
		const run: ActivityItem[] = [cur];
		let j = i + 1;
		while (j < items.length) {
			const next = items[j];
			if (
				next.eventType !== cur.eventType ||
				next.mediaId !== cur.mediaId
			) break;
			// Note: items are newest-first, so run[run.length - 1] is MORE recent than next
			const gap =
				new Date(run[run.length - 1].occurredAt).getTime() -
				new Date(next.occurredAt).getTime();
			if (gap > maxGapMs || gap < 0) break;
			run.push(next);
			j++;
		}

		if (run.length === 1) {
			result.push(cur);
			i++;
			continue;
		}

		// Build grouped item from the run
		const nums = run.map((r) => {
			if (cur.eventType === 'episode_watched') return r.payload?.episode ?? 0;
			return r.payload?.chapter ?? 0;
		});

		// Verify this is a genuine forward-progress run:
		// Items are newest-first, so a real binge has strictly DECREASING numbers
		// in this array (ep8 newest → ep5 oldest). Decrements produce INCREASING
		// numbers (ep3 newest → ep5 oldest) and must NOT be grouped.
		const allValid = nums.every((n) => typeof n === 'number' && n > 0);
		const isForwardProgress = nums.every((n, idx) => idx === 0 || nums[idx - 1] > n);

		if (!allValid || !isForwardProgress) {
			// Can't determine range or it's not strictly forward progress — emit individually
			for (const r of run) result.push(r);
		} else {
			const minNum = nums[nums.length - 1]; // oldest = lowest episode/chapter
			const maxNum = nums[0];               // newest = highest episode/chapter

			// Season: only set if all episodes share the same season
			let season: number | undefined;
			if (cur.eventType === 'episode_watched') {
				const seasons = [...new Set(run.map((r) => r.payload?.season).filter(Boolean))];
				if (seasons.length === 1) season = seasons[0] as number;
			}

			const grouped: GroupedActivityItem = {
				isGroup: true,
				id: run.map((r) => r.id).join('-'),
				mediaId: cur.mediaId,
				mediaTitle: cur.mediaTitle,
				mediaPosterUrl: cur.mediaPosterUrl,
				mediaType: cur.mediaType,
				eventType: cur.eventType!,
				category: cur.category ?? 'user_action',
				from: minNum,
				to: maxNum,
				season,
				count: run.length,
				occurredAt: run[0].occurredAt, // newest
			};
			result.push(grouped);
		}
		i = j;
	}
	return result;
}
