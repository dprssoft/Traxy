import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SQLiteDBConnection } from '@capacitor-community/sqlite';
import { createTestDb } from '../testDb';
import { fillMissingDetails, getMediaById } from './media.service';

let db: SQLiteDBConnection;

vi.mock('../index', async (importOriginal) => ({
	...(await importOriginal<typeof import('../index')>()),
	getDb: () => db,
}));

const mockGetTmdbDetails = vi.fn();
vi.mock('../sources/tmdb', () => ({
	getTmdbDetails: (...args: unknown[]) => mockGetTmdbDetails(...args),
}));

async function insertSlimFilm(extra = '') {
	await db.run(
		`INSERT INTO Media (id, source, externalId, type, title, year, detailsPending${extra ? ', country' : ''})
		 VALUES ('m1', 'tmdb', '949', 'film', 'Heat', 1995, 1${extra ? `, '${extra}'` : ''})`,
	);
	return (await getMediaById('m1'))!;
}

describe('fillMissingDetails with detailsPending (real schema)', () => {
	beforeEach(async () => {
		db = await createTestDb();
		mockGetTmdbDetails.mockReset();
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	it('reloads stripped details from the provider and clears the mark', async () => {
		mockGetTmdbDetails.mockResolvedValue({
			source: 'tmdb',
			externalId: '949',
			type: 'film',
			title: 'Heat',
			description: 'A heist.',
			genres: ['Crime'],
			runtimeMinutes: 170,
		});

		const media = await fillMissingDetails(await insertSlimFilm());

		expect(media).toMatchObject({
			description: 'A heist.',
			genres: ['Crime'],
			runtimeMinutes: 170,
		});
		expect(media.detailsPending).toBeUndefined();
		expect(mockGetTmdbDetails).toHaveBeenCalledTimes(1);
	});

	it('only fills fields that are empty', async () => {
		mockGetTmdbDetails.mockResolvedValue({
			source: 'tmdb',
			externalId: '949',
			type: 'film',
			title: 'Heat',
			country: 'US',
			runtimeMinutes: 170,
		});

		const media = await fillMissingDetails(await insertSlimFilm('FR'));

		expect(media.country).toBe('FR');
	});

	it('keeps the mark when the provider is unreachable', async () => {
		mockGetTmdbDetails.mockRejectedValue(new Error('offline'));

		const media = await fillMissingDetails(await insertSlimFilm());

		expect(media.detailsPending).toBe(true);
		expect((await getMediaById('m1'))?.detailsPending).toBe(true);
	});
});
