import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SQLiteDBConnection } from '@capacitor-community/sqlite';
import { createTestDb } from '../testDb';
import { MemoryProvider, SyncConflictError } from '../sync/provider';
import { serializeSyncDoc } from '../sync/document';
import { buildLocalSyncDoc, syncWith } from './sync.service';
import { deleteTracking, getTracking, updateScore, upsertTracking } from './tracking.service';
import {
	addToCollection,
	ensureSystemCollection,
	getCollectionEntries,
} from './collection.service';
import { getMediaByExternalId } from './media.service';
import { setAppSetting, getAppSetting } from './settings.service';

let db: SQLiteDBConnection;

vi.mock('../index', async (importOriginal) => ({
	...(await importOriginal<typeof import('../index')>()),
	getDb: () => db,
}));

let phone: SQLiteDBConnection;
let laptop: SQLiteDBConnection;
let drive: MemoryProvider;

/** Run `fn` as if on `device`. */
async function on<T>(device: SQLiteDBConnection, fn: () => Promise<T>): Promise<T> {
	db = device;
	return fn();
}

async function addTitle(device: SQLiteDBConnection, externalId: string, title: string) {
	await on(device, () =>
		db.run(
			'INSERT INTO Media (id, source, externalId, type, title, year) VALUES (?, ?, ?, ?, ?, ?)',
			[`${title}-${device === phone ? 'p' : 'l'}`, 'tmdb', externalId, 'film', title, 1995],
		),
	);
	return (await on(device, () => getMediaByExternalId('tmdb', externalId)))!;
}

describe('syncing two devices (real schema)', () => {
	beforeEach(async () => {
		phone = await createTestDb();
		laptop = await createTestDb();
		for (const d of [phone, laptop]) await d.execute('PRAGMA foreign_keys = ON');
		drive = new MemoryProvider();
		localStorage.clear();
	});

	it('brings tracking made on one device to the other', async () => {
		const heat = await addTitle(phone, '949', 'Heat');
		await on(phone, () => upsertTracking({ mediaId: heat.id, status: 'completed', score: 9 }));

		expect(await on(phone, () => syncWith(drive))).toEqual({ pulled: false, pushed: true });
		expect(await on(laptop, () => syncWith(drive))).toEqual({ pulled: true, pushed: false });

		const onLaptop = (await on(laptop, () => getMediaByExternalId('tmdb', '949')))!;
		expect(onLaptop).toMatchObject({ title: 'Heat', year: 1995, detailsPending: true });
		expect(await on(laptop, () => getTracking(onLaptop.id))).toMatchObject({
			status: 'completed',
			score: 9,
		});
	});

	it('converges after both devices change different things', async () => {
		const heat = await addTitle(phone, '949', 'Heat');
		await on(phone, () => upsertTracking({ mediaId: heat.id, status: 'in_progress' }));
		await on(phone, () => syncWith(drive));
		await on(laptop, () => syncWith(drive));

		const laptopHeat = (await on(laptop, () => getMediaByExternalId('tmdb', '949')))!;
		await on(laptop, () => updateScore(laptopHeat.id, 8));
		const dune = await addTitle(phone, '438631', 'Dune');
		await on(phone, () => upsertTracking({ mediaId: dune.id, status: 'planned' }));
		await on(phone, () => setAppSetting('tracking_view', 'grid'));

		await on(laptop, () => syncWith(drive));
		await on(phone, () => syncWith(drive));
		await on(laptop, () => syncWith(drive));

		const phoneDoc = serializeSyncDoc(await on(phone, buildLocalSyncDoc));
		const laptopDoc = serializeSyncDoc(await on(laptop, buildLocalSyncDoc));
		expect(laptopDoc).toBe(phoneDoc);
		expect(await on(phone, () => getTracking(heat.id))).toMatchObject({ score: 8 });
		expect(await on(laptop, () => getAppSetting('tracking_view'))).toBe('grid');
	});

	it('removes a deletion everywhere', async () => {
		const heat = await addTitle(phone, '949', 'Heat');
		await on(phone, () => upsertTracking({ mediaId: heat.id, status: 'planned' }));
		await on(phone, () => syncWith(drive));
		await on(laptop, () => syncWith(drive));

		await on(phone, () => deleteTracking(heat.id));
		await on(phone, () => syncWith(drive));
		await on(laptop, () => syncWith(drive));

		const laptopHeat = (await on(laptop, () => getMediaByExternalId('tmdb', '949')))!;
		expect(await on(laptop, () => getTracking(laptopHeat.id))).toBeNull();
	});

	it('merges system collections created separately on each device', async () => {
		const heat = await addTitle(phone, '949', 'Heat');
		const dune = await addTitle(laptop, '438631', 'Dune');
		const phoneFavs = await on(phone, () => ensureSystemCollection('favorites', 'film'));
		const laptopFavs = await on(laptop, () => ensureSystemCollection('favorites', 'film'));
		await on(phone, () => addToCollection(phoneFavs.id, heat.id));
		await on(laptop, () => addToCollection(laptopFavs.id, dune.id));

		await on(phone, () => syncWith(drive));
		await on(laptop, () => syncWith(drive));
		await on(phone, () => syncWith(drive));

		for (const [device, favs] of [
			[phone, phoneFavs],
			[laptop, laptopFavs],
		] as const) {
			const entries = await on(device, () => getCollectionEntries(favs.id));
			expect(entries.map((e) => e.media.title).sort()).toEqual(['Dune', 'Heat']);
		}
	});

	it('carries goals across', async () => {
		localStorage.setItem(
			'traxy:goals:2026',
			JSON.stringify({ year: 2026, watchCount: 80, updatedAt: '2026-09-01' }),
		);
		await on(phone, () => syncWith(drive));
		localStorage.clear();

		await on(laptop, () => syncWith(drive));

		expect(JSON.parse(localStorage.getItem('traxy:goals:2026')!)).toMatchObject({ watchCount: 80 });
	});

	it('re-reads and retries when another device writes mid-sync', async () => {
		const heat = await addTitle(phone, '949', 'Heat');
		await on(phone, () => upsertTracking({ mediaId: heat.id, status: 'planned' }));
		const racingDrive = new MemoryProvider();
		const write = racingDrive.write.bind(racingDrive);
		let raced = false;
		racingDrive.write = async (content, base) => {
			if (!raced) {
				raced = true;
				await write('{"version":1}', base); // another device got there first
			}
			return write(content, base);
		};

		await on(phone, () => syncWith(racingDrive));

		expect(raced).toBe(true);
		expect(racingDrive.file?.content).toContain('tmdb:949');
	});

	it('gives up after repeated conflicts', async () => {
		const stubborn = new MemoryProvider();
		stubborn.write = async () => {
			throw new SyncConflictError();
		};
		await expect(on(phone, () => syncWith(stubborn))).rejects.toThrow(SyncConflictError);
	});
});
