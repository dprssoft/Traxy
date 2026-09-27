import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SQLiteDBConnection } from '@capacitor-community/sqlite';
import { createTestDb } from '../testDb';
import { closeCycle, createCycle, getCycles } from './cycle.service';

let db: SQLiteDBConnection;

vi.mock('../index', async (importOriginal) => ({
	...(await importOriginal<typeof import('../index')>()),
	getDb: () => db,
}));

describe('closeCycle', () => {
	beforeEach(async () => {
		db = await createTestDb();
	});

	it('finishes the open cycle', async () => {
		await createCycle('m1', '2026-01-01');
		await closeCycle('m1', '2026-02-01');

		const cycles = await getCycles('m1');
		expect(cycles).toHaveLength(1);
		expect(cycles[0]).toMatchObject({ cycleNumber: 1, startedAt: '2026-01-01', finishedAt: '2026-02-01' });
	});

	it('records one finished cycle for media completed without ever starting', async () => {
		await closeCycle('m1', '2026-02-01');

		const cycles = await getCycles('m1');
		expect(cycles).toHaveLength(1);
		expect(cycles[0]).toMatchObject({ cycleNumber: 1, startedAt: '2026-02-01', finishedAt: '2026-02-01' });
	});

	it('does not add a cycle when every earlier one is already finished', async () => {
		await createCycle('m1', '2026-01-01');
		await closeCycle('m1', '2026-02-01');
		await closeCycle('m1', '2026-03-01');

		expect(await getCycles('m1')).toHaveLength(1);
	});
});
