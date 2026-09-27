import { describe, it, expect } from 'vitest';
import {
	emptySyncDoc,
	mergeSyncDocs,
	parseSyncDoc,
	serializeSyncDoc,
	SYNC_DOC_VERSION,
	type SyncDoc,
} from './document';

const NOW = new Date('2026-09-27T12:00:00.000Z');

function doc(patch: Partial<SyncDoc>): SyncDoc {
	return {
		...emptySyncDoc(),
		media: { 'tmdb:949': { source: 'tmdb', externalId: '949', type: 'film', title: 'Heat' } },
		...patch,
	};
}

describe('mergeSyncDocs', () => {
	it('keeps the newer copy of each row', () => {
		const phone = doc({
			tracking: { 'tmdb:949': { status: 'completed', score: 9, updatedAt: '2026-09-02' } },
		});
		const laptop = doc({
			tracking: { 'tmdb:949': { status: 'in_progress', updatedAt: '2026-09-01' } },
		});

		expect(mergeSyncDocs(phone, laptop, NOW).tracking['tmdb:949']).toMatchObject({
			status: 'completed',
			score: 9,
		});
	});

	it('is commutative', () => {
		const a = doc({
			tracking: { 'tmdb:949': { status: 'planned', updatedAt: '2026-09-01' } },
			settings: { theme: { value: 'dark', updatedAt: '2026-09-01' } },
		});
		const b = doc({
			tracking: { 'tmdb:949': { status: 'dropped', updatedAt: '2026-09-01' } },
			settings: { theme: { value: 'light', updatedAt: '2026-09-03' } },
		});

		expect(serializeSyncDoc(mergeSyncDocs(a, b, NOW))).toBe(
			serializeSyncDoc(mergeSyncDocs(b, a, NOW)),
		);
	});

	it('unions titles and keeps every known field', () => {
		const a = doc({
			media: { 'tmdb:949': { source: 'tmdb', externalId: '949', title: 'Heat', year: 1995 } },
		});
		const b = doc({
			media: {
				'tmdb:949': {
					source: 'tmdb',
					externalId: '949',
					title: 'Heat',
					posterUrl: 'p.jpg',
					year: null,
				},
				'anilist:21': { source: 'anilist', externalId: '21', title: 'One Piece' },
			},
		});

		const media = mergeSyncDocs(a, b, NOW).media;
		expect(Object.keys(media).sort()).toEqual(['anilist:21', 'tmdb:949']);
		expect(media['tmdb:949']).toMatchObject({ year: 1995, posterUrl: 'p.jpg' });
	});

	it('applies a deletion to older copies only', () => {
		const deleted = doc({ tombstones: { 'TrackingStatus/tmdb:949': '2026-09-05' } });
		const stale = doc({ tracking: { 'tmdb:949': { status: 'planned', updatedAt: '2026-09-01' } } });
		const readded = doc({
			tracking: { 'tmdb:949': { status: 'planned', updatedAt: '2026-09-06' } },
		});

		expect(mergeSyncDocs(deleted, stale, NOW).tracking).toEqual({});
		expect(mergeSyncDocs(deleted, readded, NOW).tracking['tmdb:949']).toBeTruthy();
	});

	it('drops items of a deleted collection', () => {
		const withList = doc({
			collections: { c1: { name: 'Heists', updatedAt: '2026-09-01' } },
			collectionItems: {
				'c1|tmdb:949': { collectionKey: 'c1', mediaKey: 'tmdb:949', updatedAt: '2026-09-02' },
			},
		});
		const deletedList = doc({ tombstones: { 'Collection/c1': '2026-09-03' } });

		const merged = mergeSyncDocs(withList, deletedList, NOW);
		expect(merged.collections).toEqual({});
		expect(merged.collectionItems).toEqual({});
	});

	it('merges the feed and keeps the newest 100 entries', () => {
		const entries = (from: number, n: number) =>
			Object.fromEntries(
				Array.from({ length: n }, (_, i) => [
					`e${from + i}`,
					{
						occurredAt: `2026-01-01T00:${String(Math.floor((from + i) / 60)).padStart(2, '0')}:${String((from + i) % 60).padStart(2, '0')}Z`,
					},
				]),
			);
		const merged = mergeSyncDocs(
			doc({ activity: entries(0, 80) }),
			doc({ activity: entries(80, 80) }),
			NOW,
		);

		expect(Object.keys(merged.activity)).toHaveLength(100);
		expect(merged.activity.e159).toBeTruthy();
		expect(merged.activity.e59).toBeUndefined();
	});

	it('removes feed entries deleted on either side', () => {
		const a = doc({ activity: { e1: { occurredAt: '2026-09-01' } } });
		const b = doc({ tombstones: { 'ActivityLog/e1': '2026-09-02' } });
		expect(mergeSyncDocs(a, b, NOW).activity).toEqual({});
	});

	it('forgets tombstones after their time-to-live', () => {
		const merged = mergeSyncDocs(
			doc({ tombstones: { 'Collection/old': '2025-01-01', 'Collection/new': '2026-09-01' } }),
			emptySyncDoc(),
			NOW,
		);
		expect(Object.keys(merged.tombstones)).toEqual(['Collection/new']);
	});

	it('drops rows pointing at titles neither side has', () => {
		const merged = mergeSyncDocs(
			doc({
				cycles: { 'tmdb:1#1': { mediaKey: 'tmdb:1', cycleNumber: 1, updatedAt: '2026-01-01' } },
			}),
			emptySyncDoc(),
			NOW,
		);
		expect(merged.cycles).toEqual({});
	});
});

describe('parseSyncDoc', () => {
	it('treats a missing file as an empty library', () => {
		expect(parseSyncDoc(null)).toEqual(emptySyncDoc());
	});

	it('refuses a document from a newer app version', () => {
		expect(() => parseSyncDoc(JSON.stringify({ version: SYNC_DOC_VERSION + 1 }))).toThrow(/newer/);
	});
});
