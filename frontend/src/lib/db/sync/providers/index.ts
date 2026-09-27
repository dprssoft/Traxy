/**
 * Every drive Traxy can sync through. Adding one (WebDAV, Dropbox, OneDrive…) means a class
 * implementing `SyncProvider` plus an entry here; the engine and settings page pick it up.
 */
import type { SyncProvider } from '../provider';
import { GoogleDriveProvider } from './googleDrive';

export interface SyncProviderConfig {
	/** OAuth client ID (Google: the Web client ID). */
	clientId?: string;
}

export interface SyncProviderInfo {
	id: string;
	label: string;
	/** What the settings page has to ask for before `create` can work. */
	needs: (keyof SyncProviderConfig)[];
	create(config: SyncProviderConfig): SyncProvider;
}

export const SYNC_PROVIDERS: SyncProviderInfo[] = [
	{
		id: 'google-drive',
		label: 'Google Drive',
		needs: ['clientId'],
		create: (config) => new GoogleDriveProvider(config.clientId ?? ''),
	},
];

export function getSyncProviderInfo(id: string | null | undefined): SyncProviderInfo | undefined {
	return SYNC_PROVIDERS.find((p) => p.id === id);
}
