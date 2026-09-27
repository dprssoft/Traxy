import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { importFromMal, importFromAnilist, importFromTmdb } from './import.service';

// upsertMedia dedups on (source, externalId) and can return an id that differs from the
// one the caller passed in (when a matching record already exists). These mocks always
// return a fixed canonical id regardless of the input id, to catch any regression where a
// caller uses its own locally-generated id instead of upsertMedia's return value.
const CANONICAL_MEDIA_ID = 'canonical-media-id';
const mockUpsertMedia = vi.fn(async (data: Record<string, unknown>) => ({ ...data, id: CANONICAL_MEDIA_ID }));
vi.mock('./media.service', () => ({
	upsertMedia: (data: Record<string, unknown>) => mockUpsertMedia(data),
}));

const mockUpsertTracking = vi.fn(async (data: Record<string, unknown>) => data);
vi.mock('./tracking.service', () => ({
	upsertTracking: (data: Record<string, unknown>) => mockUpsertTracking(data),
}));

const mockLogActivity = vi.fn();
vi.mock('./activity.service', () => ({
	logActivity: (entry: unknown) => mockLogActivity(entry),
}));

const mockGetAnilistDetails = vi.fn();
vi.mock('../sources/anilist', () => ({
	getAnilistDetails: (id: number) => mockGetAnilistDetails(id),
}));

const mockGetTmdbDetails = vi.fn();
vi.mock('../sources/tmdb', () => ({
	getTmdbDetails: (id: string, type: string) => mockGetTmdbDetails(id, type),
}));

const mockFetchJson = vi.fn();
vi.mock('../fetchUtils', () => ({
	fetchJson: (url: string) => mockFetchJson(url),
}));

function malXml(entries: Array<{ id: string; title: string; watched?: number; score?: number; status?: string }>) {
	const items = entries
		.map(
			(e) => `
		<anime>
			<series_animedb_id>${e.id}</series_animedb_id>
			<series_title>${e.title}</series_title>
			<my_watched_episodes>${e.watched ?? 0}</my_watched_episodes>
			<my_score>${e.score ?? 0}</my_score>
			<my_status>${e.status ?? '6'}</my_status>
		</anime>`,
		)
		.join('');
	return `<?xml version="1.0" encoding="UTF-8"?><myanimelist>${items}</myanimelist>`;
}

describe('import.service', () => {
	beforeEach(() => {
		mockUpsertMedia.mockClear();
		mockUpsertTracking.mockClear();
		mockLogActivity.mockClear();
		mockGetAnilistDetails.mockClear();
		mockGetTmdbDetails.mockClear();
		mockFetchJson.mockClear();
		vi.stubGlobal('fetch', vi.fn());
	});

	describe('importFromMal', () => {
		it('links the tracking record to upsertMedia\'s returned id, not a locally-generated one', async () => {
			const result = await importFromMal(malXml([{ id: '42', title: 'Cowboy Bebop', watched: 5, score: 9, status: '2' }]));

			expect(result).toEqual({ success: 1, failed: 0 });
			expect(mockUpsertTracking).toHaveBeenCalledTimes(1);
			const call = mockUpsertTracking.mock.calls[0][0];
			expect(call.mediaId).toBe(CANONICAL_MEDIA_ID);
		});

		it('counts an entry without a MAL id as failed and does not create tracking for it', async () => {
			const xml = `<myanimelist><anime><series_title>No ID</series_title></anime></myanimelist>`;
			const result = await importFromMal(xml);

			expect(result).toEqual({ success: 0, failed: 1 });
			expect(mockUpsertTracking).not.toHaveBeenCalled();
		});

		it('maps MAL status codes to tracking statuses', async () => {
			await importFromMal(malXml([{ id: '1', title: 'A', status: '2' }])); // completed
			expect(mockUpsertTracking.mock.calls[0][0].status).toBe('completed');
		});

		it('logs a single mal_import activity event with the success count', async () => {
			await importFromMal(malXml([{ id: '1', title: 'A' }, { id: '2', title: 'B' }]));

			expect(mockLogActivity).toHaveBeenCalledTimes(1);
			expect(mockLogActivity).toHaveBeenCalledWith(
				expect.objectContaining({ eventType: 'mal_import', payload: { count: 2 } }),
			);
		});
	});

	describe('importFromAnilist', () => {
		function mockAnilistFetch(entries: unknown[]) {
			(fetch as Mock).mockResolvedValue({
				ok: true,
				json: async () => ({
					data: { MediaListCollection: { lists: [{ entries }] } },
				}),
			});
		}

		it('links the tracking record to upsertMedia\'s returned id, not a locally-generated one', async () => {
			mockAnilistFetch([{ status: 'CURRENT', score: 8, progress: 3, media: { id: 555 } }]);
			mockGetAnilistDetails.mockResolvedValue({
				source: 'anilist',
				externalId: '555',
				type: 'anime',
				title: 'Frieren',
			});

			const result = await importFromAnilist('someuser');

			expect(result.success).toBeGreaterThan(0);
			expect(mockUpsertTracking).toHaveBeenCalledWith(
				expect.objectContaining({ mediaId: CANONICAL_MEDIA_ID }),
			);
		});

		it('asks AniList for scores on the app\'s 10-point scale', async () => {
			mockAnilistFetch([]);

			await importFromAnilist('someuser');

			const body = JSON.parse((fetch as Mock).mock.calls[0][1].body);
			expect(body.query).toContain('score(format: POINT_10)');
		});

		it('counts entries with no resolvable details as failed and skips tracking', async () => {
			mockAnilistFetch([{ status: 'CURRENT', score: 0, progress: 0, media: { id: 1 } }]);
			mockGetAnilistDetails.mockResolvedValue(null);

			const result = await importFromAnilist('someuser');

			expect(result.failed).toBeGreaterThan(0);
			expect(mockUpsertTracking).not.toHaveBeenCalled();
		});
	});

	describe('importFromTmdb', () => {
		it('links the tracking record to upsertMedia\'s returned id, not a locally-generated one', async () => {
			mockFetchJson.mockImplementation(async (url: string) => {
				if (url.includes('/account?')) return { id: 999 };
				if (url.includes('/watchlist/movies')) {
					return { page: 1, total_pages: 1, results: [{ id: 1, rating: 7 }] };
				}
				return { page: 1, total_pages: 1, results: [] };
			});
			mockGetTmdbDetails.mockResolvedValue({
				source: 'tmdb',
				externalId: '1',
				type: 'film',
				title: 'Dune',
			});

			const result = await importFromTmdb('api-key', 'session-id');

			expect(result.success).toBeGreaterThan(0);
			expect(mockUpsertTracking).toHaveBeenCalledWith(
				expect.objectContaining({ mediaId: CANONICAL_MEDIA_ID }),
			);
		});
	});
});
