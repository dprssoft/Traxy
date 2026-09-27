import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import SyncAgent from './SyncAgent.svelte';
import { performSync } from '$lib/stores/sync.svelte';
import { getCloudSyncEnabled } from '$lib/db/services/settings.service';

const listeners = vi.hoisted(() => new Set<() => void>());
const connected = vi.hoisted(() => ({ value: true }));

vi.mock('$app/navigation', () => ({ invalidateAll: vi.fn() }));
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn() } }));
vi.mock('$lib/db/services/settings.service', () => ({ getCloudSyncEnabled: vi.fn() }));
vi.mock('$lib/db/services/sync.service', () => ({
	onLocalChange: (listener: () => void) => {
		listeners.add(listener);
		return () => listeners.delete(listener);
	},
}));
vi.mock('$lib/stores/sync.svelte', () => ({
	syncStore: { status: { syncing: false, needsSignIn: false } },
	currentSyncProvider: () => ({ isConnected: () => connected.value }),
	performSync: vi.fn(async () => ({ pulled: false, pushed: true })),
}));

const change = () => listeners.forEach((l) => l());

describe('SyncAgent', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		connected.value = true;
		vi.mocked(getCloudSyncEnabled).mockResolvedValue(true);
	});
	afterEach(() => {
		cleanup();
		vi.useRealTimers();
	});

	it('syncs on start and again shortly after a local change', async () => {
		render(SyncAgent);
		await vi.advanceTimersByTimeAsync(1_000);
		expect(performSync).toHaveBeenCalledTimes(1);
		expect(performSync).toHaveBeenLastCalledWith(false);

		change();
		change();
		await vi.advanceTimersByTimeAsync(9_000);
		expect(performSync).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1_000);
		expect(performSync).toHaveBeenCalledTimes(2);
	});

	it('does nothing while sync is switched off', async () => {
		vi.mocked(getCloudSyncEnabled).mockResolvedValue(false);
		render(SyncAgent);
		change();
		await vi.advanceTimersByTimeAsync(20_000);
		expect(performSync).not.toHaveBeenCalled();
	});

	it('does nothing until the drive is connected', async () => {
		connected.value = false;
		render(SyncAgent);
		await vi.advanceTimersByTimeAsync(20_000);
		expect(performSync).not.toHaveBeenCalled();
	});
});
