import { getSyncProviderInfo, type SyncProviderConfig } from '$lib/db/sync/providers';
import { SyncAuthError, type SyncProvider } from '$lib/db/sync/provider';
import { runSync, type SyncResult } from '$lib/db/services/sync.service';
import { nowIso } from '$lib/utils/format';

const STORAGE_KEY = 'traxy:sync';

/** Which drive this device syncs through, and its credentials. Never synced itself. */
interface SyncSettings extends SyncProviderConfig {
	providerId: string | null;
	clientId: string;
}

interface SyncStatus {
	syncing: boolean;
	lastSyncAt: string | null;
	error: string | null;
	/** The drive needs the user to sign in again before sync can continue. */
	needsSignIn: boolean;
}

const DEFAULT_SETTINGS: SyncSettings = {
	providerId: 'google-drive',
	clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '',
};

function load(): { settings: SyncSettings; lastSyncAt: string | null } {
	try {
		const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
		return {
			settings: { ...DEFAULT_SETTINGS, ...stored.settings },
			lastSyncAt: stored.lastSyncAt ?? null,
		};
	} catch {
		return { settings: DEFAULT_SETTINGS, lastSyncAt: null };
	}
}

/** Cloud sync configuration and live status for this device. */
export const syncStore = $state<{ settings: SyncSettings; status: SyncStatus }>({
	settings: DEFAULT_SETTINGS,
	status: { syncing: false, lastSyncAt: null, error: null, needsSignIn: false },
});

if (typeof window !== 'undefined') {
	const stored = load();
	syncStore.settings = stored.settings;
	syncStore.status.lastSyncAt = stored.lastSyncAt;
}

function persist() {
	localStorage.setItem(
		STORAGE_KEY,
		JSON.stringify({ settings: syncStore.settings, lastSyncAt: syncStore.status.lastSyncAt }),
	);
}

export function saveSyncSettings(patch: Partial<SyncSettings>) {
	syncStore.settings = { ...syncStore.settings, ...patch };
	persist();
}

export function setSyncStatus(patch: Partial<SyncStatus>) {
	syncStore.status = { ...syncStore.status, ...patch };
	if (patch.lastSyncAt !== undefined) persist();
}

let provider: { key: string; instance: SyncProvider } | null = null;

/** The configured drive, or null until one is chosen and its credentials are filled in. */
export function currentSyncProvider(): SyncProvider | null {
	const { settings } = syncStore;
	const info = getSyncProviderInfo(settings.providerId);
	if (!info || info.needs.some((field) => !settings[field])) return null;
	const key = JSON.stringify(settings);
	if (provider?.key !== key) provider = { key, instance: info.create(settings) };
	return provider.instance;
}

/**
 * Sync now and record the outcome in `syncStore.status`. Returns null when sync isn't set up,
 * already running, or failed (the error is in the status).
 */
export async function performSync(interactive: boolean): Promise<SyncResult | null> {
	const drive = currentSyncProvider();
	if (!drive || syncStore.status.syncing) return null;
	setSyncStatus({ syncing: true, error: null });
	try {
		const result = await runSync(drive, { interactive });
		setSyncStatus({ lastSyncAt: nowIso(), needsSignIn: false });
		return result;
	} catch (err) {
		console.error('[sync] failed', err);
		setSyncStatus({
			error: err instanceof Error ? err.message : String(err),
			needsSignIn: err instanceof SyncAuthError,
		});
		return null;
	} finally {
		setSyncStatus({ syncing: false });
	}
}
