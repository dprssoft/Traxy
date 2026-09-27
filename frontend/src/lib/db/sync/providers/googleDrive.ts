/**
 * Google Drive: the sync file lives in the app's hidden `appDataFolder` (scope `drive.appdata`),
 * so Traxy can't see anything else on the drive and the file doesn't clutter "My Drive".
 *
 * Sign-in differs per platform — Google blocks OAuth inside an Android WebView:
 * - web: Google Identity Services token client (needs the site's origin on the Web client);
 * - Android: @capgo/capacitor-social-login (Credential Manager), which also takes the Web client
 *   ID; an Android client with the app's package + signing SHA-1 must exist in the same project.
 */
import { Capacitor } from '@capacitor/core';
import { SyncAuthError, SyncConflictError, type RemoteFile, type SyncProvider } from '../provider';

const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const FILE_NAME = 'traxy-sync.json';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const TOKEN_KEY = 'traxy:sync:google-token';
const CONNECTED_KEY = 'traxy:sync:google-connected';

interface CachedToken {
	token: string;
	expiresAt: number;
}

// Minimal typings for the parts of Google Identity Services used here.
interface GisTokenResponse {
	access_token?: string;
	expires_in?: number;
	error?: string;
	error_description?: string;
}
interface GisOAuth2 {
	initTokenClient(config: {
		client_id: string;
		scope: string;
		prompt?: string;
		callback: (response: GisTokenResponse) => void;
		error_callback?: (error: { type?: string; message?: string }) => void;
	}): { requestAccessToken(): void };
	revoke(token: string, done?: () => void): void;
}
declare global {
	interface Window {
		google?: { accounts?: { oauth2?: GisOAuth2 } };
	}
}

let gisLoading: Promise<GisOAuth2> | null = null;
function loadGis(): Promise<GisOAuth2> {
	gisLoading ??= new Promise((resolve, reject) => {
		const script = document.createElement('script');
		script.src = 'https://accounts.google.com/gsi/client';
		script.async = true;
		script.onload = () =>
			window.google?.accounts?.oauth2
				? resolve(window.google.accounts.oauth2)
				: reject(new Error('Google sign-in failed to load'));
		script.onerror = () => {
			gisLoading = null;
			reject(new Error('Could not reach Google sign-in. Check your connection.'));
		};
		document.head.appendChild(script);
	});
	return gisLoading;
}

function readToken(): CachedToken | null {
	try {
		const cached = JSON.parse(localStorage.getItem(TOKEN_KEY) ?? 'null') as CachedToken | null;
		// Renew a minute early so a request doesn't start with a token about to expire.
		return cached && cached.expiresAt - 60_000 > Date.now() ? cached : null;
	} catch {
		return null;
	}
}

function saveToken(token: string, expiresInSeconds: number) {
	const cached: CachedToken = { token, expiresAt: Date.now() + expiresInSeconds * 1000 };
	localStorage.setItem(TOKEN_KEY, JSON.stringify(cached));
	localStorage.setItem(CONNECTED_KEY, '1');
	return token;
}

export class GoogleDriveProvider implements SyncProvider {
	readonly id = 'google-drive';
	readonly label = 'Google Drive';
	private readonly native = Capacitor.isNativePlatform();
	private nativeReady: Promise<typeof import('@capgo/capacitor-social-login').SocialLogin> | null =
		null;

	constructor(private readonly clientId: string) {}

	isConnected(): boolean {
		return localStorage.getItem(CONNECTED_KEY) === '1';
	}

	async connect(): Promise<void> {
		if (this.native) {
			const SocialLogin = await this.socialLogin();
			const { result } = await SocialLogin.login({
				provider: 'google',
				options: { scopes: [SCOPE] },
			});
			const token = 'accessToken' in result ? result.accessToken?.token : undefined;
			if (!token) throw new SyncAuthError('Google did not grant access to Drive');
			saveToken(token, 3000);
			return;
		}
		const oauth2 = await loadGis();
		await new Promise<void>((resolve, reject) => {
			oauth2
				.initTokenClient({
					client_id: this.clientId,
					scope: SCOPE,
					callback: (r) => {
						if (r.access_token) {
							saveToken(r.access_token, r.expires_in ?? 3600);
							resolve();
						} else reject(new SyncAuthError(r.error_description ?? r.error));
					},
					error_callback: (e) =>
						reject(new SyncAuthError(e.message ?? 'Google sign-in was closed')),
				})
				.requestAccessToken();
		});
	}

	async disconnect(): Promise<void> {
		const cached = readToken();
		localStorage.removeItem(TOKEN_KEY);
		localStorage.removeItem(CONNECTED_KEY);
		try {
			if (this.native) await (await this.socialLogin()).logout({ provider: 'google' });
			else if (cached) (await loadGis()).revoke(cached.token);
		} catch (err) {
			console.warn('[sync] signing out of Google failed', err);
		}
	}

	async read(): Promise<RemoteFile | null> {
		const file = await this.findFile();
		if (!file) return null;
		const res = await this.request(`${API}/files/${file.id}?alt=media`);
		return { content: await res.text(), revision: file.version };
	}

	async write(content: string, baseRevision: string | null): Promise<string> {
		// Drive has no conditional write, so compare versions right before writing; the window
		// for another device to slip in between is a single request.
		const file = await this.findFile();
		if ((file?.version ?? null) !== baseRevision) throw new SyncConflictError();

		if (file) {
			const res = await this.request(
				`${UPLOAD_API}/files/${file.id}?uploadType=media&fields=version`,
				{
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: content,
				},
			);
			return String(((await res.json()) as { version: string }).version);
		}

		const boundary = `traxy${Date.now()}`;
		const metadata = { name: FILE_NAME, parents: ['appDataFolder'], mimeType: 'application/json' };
		const body =
			`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
			`--${boundary}\r\nContent-Type: application/json\r\n\r\n${content}\r\n--${boundary}--`;
		const res = await this.request(`${UPLOAD_API}/files?uploadType=multipart&fields=version`, {
			method: 'POST',
			headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
			body,
		});
		return String(((await res.json()) as { version: string }).version);
	}

	/** The newest sync file, if any (a racing first sync on two devices can create two). */
	private async findFile(): Promise<{ id: string; version: string } | null> {
		const q = encodeURIComponent(`name = '${FILE_NAME}' and trashed = false`);
		const res = await this.request(
			`${API}/files?spaces=appDataFolder&q=${q}&orderBy=modifiedTime desc&pageSize=1&fields=files(id,version)`,
		);
		const { files } = (await res.json()) as { files?: { id: string; version: string }[] };
		return files?.[0] ? { id: files[0].id, version: String(files[0].version) } : null;
	}

	private async request(url: string, init: RequestInit = {}, retry = true): Promise<Response> {
		const token = await this.accessToken();
		const res = await fetch(url, {
			...init,
			headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` },
		});
		if (res.status === 401) {
			localStorage.removeItem(TOKEN_KEY);
			if (retry && this.native) return this.request(url, init, false);
			throw new SyncAuthError();
		}
		if (!res.ok) {
			throw new Error(
				`Google Drive request failed (${res.status}): ${(await res.text()).slice(0, 200)}`,
			);
		}
		return res;
	}

	/** A usable access token; renewed silently on Android, needs a click on the web. */
	private async accessToken(): Promise<string> {
		const cached = readToken();
		if (cached) return cached.token;
		if (!this.isConnected() || !this.native) throw new SyncAuthError();

		const SocialLogin = await this.socialLogin();
		try {
			await SocialLogin.refresh({ provider: 'google', options: { scopes: [SCOPE] } });
			const { accessToken } = await SocialLogin.getAuthorizationCode({ provider: 'google' });
			if (accessToken) return saveToken(accessToken, 3000);
		} catch (err) {
			console.warn('[sync] renewing the Google token failed', err);
		}
		throw new SyncAuthError();
	}

	private socialLogin() {
		this.nativeReady ??= import('@capgo/capacitor-social-login').then(async ({ SocialLogin }) => {
			await SocialLogin.initialize({ google: { webClientId: this.clientId, mode: 'online' } });
			return SocialLogin;
		});
		return this.nativeReady;
	}
}
