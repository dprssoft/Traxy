import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	getTracking,
	upsertTracking,
	updateProgress,
	updateScore,
	updateNote,
	deleteTracking,
} from './tracking.service';
import type { LocalTrackingStatus } from '$lib/types/trackingTypes';

// Mock DB layer
let dbTrackingRecords: Map<string, any> = new Map();
let executedQueries: { sql: string; values?: any[] }[] = [];

vi.mock('../index', () => ({
	getDb: () => ({
		query: vi.fn(async (sql: string, values: any[] = []) => {
			executedQueries.push({ sql, values });
			if (sql.includes('FROM TrackingStatus WHERE mediaId = ?')) {
				const mediaId = values[0];
				const record = dbTrackingRecords.get(mediaId);
				return { values: record ? [record] : [] };
			}
			if (sql.includes('FROM TrackingStatus ORDER BY updatedAt DESC')) {
				return { values: Array.from(dbTrackingRecords.values()) };
			}
			return { values: [] };
		}),
		run: vi.fn(async (sql: string, values: any[] = []) => {
			executedQueries.push({ sql, values });
			if (sql.includes('UPDATE TrackingStatus SET')) {
				if (sql.includes('WHERE mediaId = ?')) {
					const mediaId = values[values.length - 1];
					const existing = dbTrackingRecords.get(mediaId) || {};
					// Parse dynamic field updates like `UPDATE TrackingStatus SET field = ?, updatedAt = ? WHERE mediaId = ?`
					if (sql.startsWith('UPDATE TrackingStatus SET current') || sql.startsWith('UPDATE TrackingStatus SET hour') || sql.startsWith('UPDATE TrackingStatus SET page')) {
						const match = sql.match(/SET (\w+) = \?/);
						if (match) {
							const field = match[1];
							existing[field] = values[0];
						}
					} else if (sql.includes('score = ?')) {
						existing.score = values[0];
					} else if (sql.includes('note = ?')) {
						existing.note = values[0];
					} else {
						// Full upsert update
						const [status, score, note, currentEpisode, currentSeason, currentChapter, currentVolume, currentPage, currentIssue, hoursPlayed, completionTier, updatedAt] = values;
						Object.assign(existing, {
							status, score, note, currentEpisode, currentSeason,
							currentChapter, currentVolume, currentPage, currentIssue,
							hoursPlayed, completionTier, updatedAt,
						});
					}
					dbTrackingRecords.set(mediaId, existing);
				}
			} else if (sql.includes('INSERT INTO TrackingStatus')) {
				const [id, mediaId, status, score, note, currentEpisode, currentSeason, currentChapter, currentVolume, currentPage, currentIssue, hoursPlayed, completionTier, createdAt, updatedAt] = values;
				dbTrackingRecords.set(mediaId, {
					id, mediaId, status, score, note,
					currentEpisode, currentSeason, currentChapter, currentVolume,
					currentPage, currentIssue, hoursPlayed, completionTier,
					createdAt, updatedAt,
				});
			} else if (sql.includes('DELETE FROM TrackingStatus WHERE mediaId = ?')) {
				dbTrackingRecords.delete(values[0]);
			}
			return { changes: 1 };
		}),
	}),
}));

// Mock related services
const mockLogActivity = vi.fn();
vi.mock('./activity.service', () => ({
	logActivity: (entry: any) => mockLogActivity(entry),
	handleProgressDecrement: vi.fn(async () => ({ highestRemaining: 100 })),
}));

vi.mock('./media.service', () => ({
	getMediaById: vi.fn(async (id: string) => ({
		id,
		title: 'Test Media Title',
		type: 'tv',
		posterUrl: 'https://example.com/poster.jpg',
	})),
}));

const mockCreateCycle = vi.fn();
const mockCloseCycle = vi.fn();
vi.mock('./cycle.service', () => ({
	createCycle: (mediaId: string) => mockCreateCycle(mediaId),
	closeCycle: (mediaId: string) => mockCloseCycle(mediaId),
}));

describe('tracking.service Scenarios', () => {
	beforeEach(() => {
		dbTrackingRecords.clear();
		executedQueries = [];
		mockLogActivity.mockClear();
		mockCreateCycle.mockClear();
		mockCloseCycle.mockClear();
	});

	describe('1. Progress Updates & Boundary Cases', () => {
		it('logs episode_watched on forward progress increment', async () => {
			dbTrackingRecords.set('media-1', {
				id: 't-1',
				mediaId: 'media-1',
				currentEpisode: 1,
				status: 'in_progress',
			});

			await updateProgress('media-1', 'currentEpisode', 2);

			const saved = dbTrackingRecords.get('media-1');
			expect(saved.currentEpisode).toBe(2);

			expect(mockLogActivity).toHaveBeenCalledTimes(1);
			expect(mockLogActivity).toHaveBeenCalledWith(
				expect.objectContaining({
					mediaId: 'media-1',
					eventType: 'episode_watched',
					payload: { episode: 2 },
				})
			);
		});

		it('logs chapter_read on forward progress increment', async () => {
			dbTrackingRecords.set('manga-1', {
				id: 't-m1',
				mediaId: 'manga-1',
				currentChapter: 10,
				status: 'in_progress',
			});

			await updateProgress('manga-1', 'currentChapter', 11);

			expect(dbTrackingRecords.get('manga-1').currentChapter).toBe(11);
			expect(mockLogActivity).toHaveBeenCalledTimes(1);
			expect(mockLogActivity).toHaveBeenCalledWith(
				expect.objectContaining({
					mediaId: 'manga-1',
					eventType: 'chapter_read',
					payload: { chapter: 11 },
				})
			);
		});

		it('REGRESSION BUG 1: does NOT log activity when progress is decreased and previous logs cover the value', async () => {
			dbTrackingRecords.set('media-1', {
				id: 't-1',
				mediaId: 'media-1',
				currentEpisode: 5,
				status: 'in_progress',
			});

			// User corrects from episode 5 back to episode 4
			await updateProgress('media-1', 'currentEpisode', 4);

			expect(dbTrackingRecords.get('media-1').currentEpisode).toBe(4);
			// But NO activity log should be emitted
			expect(mockLogActivity).not.toHaveBeenCalled();
		});

		it('REGRESSION BUG 1: does NOT log activity when chapters are decreased and previous logs cover the value', async () => {
			dbTrackingRecords.set('manga-1', {
				id: 't-2',
				mediaId: 'manga-1',
				currentChapter: 10,
				status: 'in_progress',
			});

			await updateProgress('manga-1', 'currentChapter', 9);

			expect(dbTrackingRecords.get('manga-1').currentChapter).toBe(9);
			expect(mockLogActivity).not.toHaveBeenCalled();
		});

		it('REGRESSION BUG 3: does NOT log activity when episode is set to 0 or negative', async () => {
			dbTrackingRecords.set('media-1', {
				id: 't-1',
				mediaId: 'media-1',
				currentEpisode: 1,
				status: 'in_progress',
			});

			await updateProgress('media-1', 'currentEpisode', 0);

			expect(dbTrackingRecords.get('media-1').currentEpisode).toBe(0);
			expect(mockLogActivity).not.toHaveBeenCalled();
		});

		it('REGRESSION BUG 2: does NOT log spurious episode_watched on season-only update', async () => {
			dbTrackingRecords.set('media-1', {
				id: 't-1',
				mediaId: 'media-1',
				currentSeason: 1,
				currentEpisode: 1,
				status: 'in_progress',
			});

			await updateProgress('media-1', 'currentSeason', 2);

			expect(dbTrackingRecords.get('media-1').currentSeason).toBe(2);
			expect(mockLogActivity).not.toHaveBeenCalled();
		});

		it('logs pages_updated when reading forward', async () => {
			dbTrackingRecords.set('book-1', {
				id: 't-b1',
				mediaId: 'book-1',
				currentPage: 50,
				status: 'in_progress',
			});

			await updateProgress('book-1', 'currentPage', 120);

			expect(dbTrackingRecords.get('book-1').currentPage).toBe(120);
			expect(mockLogActivity).toHaveBeenCalledWith(
				expect.objectContaining({
					eventType: 'pages_updated',
					payload: { page: 120 },
				})
			);
		});

		it('logs hours_updated when playing games', async () => {
			dbTrackingRecords.set('game-1', {
				id: 't-g1',
				mediaId: 'game-1',
				hoursPlayed: 5.5,
				status: 'in_progress',
			});

			await updateProgress('game-1', 'hoursPlayed', 8.0);

			expect(dbTrackingRecords.get('game-1').hoursPlayed).toBe(8.0);
			expect(mockLogActivity).toHaveBeenCalledWith(
				expect.objectContaining({
					eventType: 'hours_updated',
					payload: { hours: 8.0 },
				})
			);
		});
	});

	describe('2. Status Transitions & Watch Cycle Lifecycle', () => {
		it('creates new tracking in planned status without starting cycle', async () => {
			const res = await upsertTracking({
				mediaId: 'film-1',
				status: 'planned',
			});

			expect(res.status).toBe('planned');
			expect(mockCreateCycle).not.toHaveBeenCalled();
			expect(mockLogActivity).toHaveBeenCalledWith(
				expect.objectContaining({
					eventType: 'status_changed',
					payload: { from: undefined, to: 'planned' },
				})
			);
		});

		it('starts watch cycle when created directly as in_progress', async () => {
			const res = await upsertTracking({
				mediaId: 'anime-1',
				status: 'in_progress',
			});

			expect(res.status).toBe('in_progress');
			expect(mockCreateCycle).toHaveBeenCalledWith('anime-1');
			expect(mockLogActivity).toHaveBeenCalledWith(
				expect.objectContaining({
					eventType: 'status_changed',
					payload: { from: undefined, to: 'in_progress' },
				})
			);
		});

		it('transitions from planned to in_progress and starts cycle', async () => {
			dbTrackingRecords.set('tv-1', {
				id: 't-tv',
				mediaId: 'tv-1',
				status: 'planned',
			});

			await upsertTracking({
				mediaId: 'tv-1',
				status: 'in_progress',
			});

			expect(mockCreateCycle).toHaveBeenCalledWith('tv-1');
			expect(mockLogActivity).toHaveBeenCalledWith(
				expect.objectContaining({
					eventType: 'status_changed',
					payload: { from: 'planned', to: 'in_progress' },
				})
			);
		});

		it('transitions from in_progress to completed and closes cycle', async () => {
			dbTrackingRecords.set('tv-1', {
				id: 't-tv',
				mediaId: 'tv-1',
				status: 'in_progress',
			});

			await upsertTracking({
				mediaId: 'tv-1',
				status: 'completed',
			});

			expect(mockCloseCycle).toHaveBeenCalledWith('tv-1');
			expect(mockLogActivity).toHaveBeenCalledWith(
				expect.objectContaining({
					eventType: 'status_changed',
					payload: { from: 'in_progress', to: 'completed' },
				})
			);
		});

		it('starts a new rewatch cycle when moving from completed back to in_progress', async () => {
			dbTrackingRecords.set('tv-1', {
				id: 't-tv',
				mediaId: 'tv-1',
				status: 'completed',
			});

			await upsertTracking({
				mediaId: 'tv-1',
				status: 'in_progress',
			});

			expect(mockCreateCycle).toHaveBeenCalledWith('tv-1');
		});

		it('pausing or dropping does not start a new cycle', async () => {
			dbTrackingRecords.set('tv-1', {
				id: 't-tv',
				mediaId: 'tv-1',
				status: 'in_progress',
			});

			await upsertTracking({ mediaId: 'tv-1', status: 'paused' });
			expect(mockCreateCycle).not.toHaveBeenCalled();

			await upsertTracking({ mediaId: 'tv-1', status: 'dropped' });
			expect(mockCreateCycle).not.toHaveBeenCalled();
		});
	});

	describe('3. Score & Note Operations', () => {
		it('emits score_set on initial rating', async () => {
			dbTrackingRecords.set('media-1', {
				id: 't-1',
				mediaId: 'media-1',
				status: 'in_progress',
				score: null,
			});

			await updateScore('media-1', 9);

			expect(dbTrackingRecords.get('media-1').score).toBe(9);
			expect(mockLogActivity).toHaveBeenCalledWith(
				expect.objectContaining({
					eventType: 'score_set',
					payload: { from: undefined, score: 9 },
				})
			);
		});

		it('emits score_changed on rating adjustment', async () => {
			dbTrackingRecords.set('media-1', {
				id: 't-1',
				mediaId: 'media-1',
				status: 'completed',
				score: 8,
			});

			await updateScore('media-1', 10);

			expect(dbTrackingRecords.get('media-1').score).toBe(10);
			expect(mockLogActivity).toHaveBeenCalledWith(
				expect.objectContaining({
					eventType: 'score_changed',
					payload: { from: '8', score: 10 },
				})
			);
		});

		it('clears score when set to null', async () => {
			dbTrackingRecords.set('media-1', {
				id: 't-1',
				mediaId: 'media-1',
				score: 8,
			});

			await updateScore('media-1', null);

			expect(dbTrackingRecords.get('media-1').score).toBeNull();
		});

		it('updates note and emits note_updated', async () => {
			dbTrackingRecords.set('media-1', {
				id: 't-1',
				mediaId: 'media-1',
				note: 'Initial impression',
			});

			await updateNote('media-1', 'Masterpiece ending!');

			expect(dbTrackingRecords.get('media-1').note).toBe('Masterpiece ending!');
			expect(mockLogActivity).toHaveBeenCalledWith(
				expect.objectContaining({
					eventType: 'note_updated',
				})
			);
		});
	});

	describe('4. Delete Tracking', () => {
		it('removes tracking record from DB', async () => {
			dbTrackingRecords.set('media-1', {
				id: 't-1',
				mediaId: 'media-1',
				status: 'in_progress',
			});

			await deleteTracking('media-1');

			expect(dbTrackingRecords.has('media-1')).toBe(false);
			const tracking = await getTracking('media-1');
			expect(tracking).toBeNull();
		});
	});
});
