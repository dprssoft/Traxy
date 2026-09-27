import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleDriveProvider } from './googleDrive';
import { SyncAuthError, SyncConflictError } from '../provider';

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }));

/** A fake Drive: one optional file in appDataFolder. */
let file: { id: string; version: number; content: string } | null;
const calls: { method: string; url: string }[] = [];

function respond(body: unknown, status = 200) {
	return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
}

beforeEach(() => {
	file = null;
	calls.length = 0;
	localStorage.clear();
	localStorage.setItem(
		'traxy:sync:google-token',
		JSON.stringify({ token: 'tok', expiresAt: Date.now() + 3_600_000 }),
	);
	localStorage.setItem('traxy:sync:google-connected', '1');
	vi.stubGlobal(
		'fetch',
		vi.fn(async (url: string, init: RequestInit = {}) => {
			const method = init.method ?? 'GET';
			calls.push({ method, url });
			expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
			if (url.includes('/drive/v3/files?spaces=appDataFolder')) {
				return respond({ files: file ? [{ id: file.id, version: String(file.version) }] : [] });
			}
			if (url.endsWith('?alt=media')) return respond(file!.content);
			if (method === 'POST') {
				file = {
					id: 'f1',
					version: 1,
					content: String(init.body).split('\r\n\r\n')[2].split('\r\n')[0],
				};
				return respond({ version: '1' });
			}
			if (method === 'PATCH') {
				file = { ...file!, version: file!.version + 1, content: String(init.body) };
				return respond({ version: String(file.version) });
			}
			return respond('not found', 404);
		}),
	);
});

describe('GoogleDriveProvider', () => {
	const drive = () => new GoogleDriveProvider('client-id');

	it('reads nothing before the first sync', async () => {
		expect(await drive().read()).toBeNull();
	});

	it('creates the file in appDataFolder, then updates it', async () => {
		const v1 = await drive().write('{"a":1}', null);
		expect(calls.find((c) => c.method === 'POST')?.url).toContain('uploadType=multipart');
		expect(await drive().read()).toEqual({ content: '{"a":1}', revision: v1 });

		const v2 = await drive().write('{"a":2}', v1);
		expect(v2).not.toBe(v1);
		expect((await drive().read())?.content).toBe('{"a":2}');
	});

	it('refuses to overwrite a newer version', async () => {
		const v1 = await drive().write('{"a":1}', null);
		await drive().write('{"a":2}', v1);
		await expect(drive().write('{"a":3}', v1)).rejects.toBeInstanceOf(SyncConflictError);
		await expect(drive().write('{"a":3}', null)).rejects.toBeInstanceOf(SyncConflictError);
	});

	it('asks for sign-in when the web token has expired', async () => {
		localStorage.setItem(
			'traxy:sync:google-token',
			JSON.stringify({ token: 'tok', expiresAt: Date.now() - 1 }),
		);
		await expect(drive().read()).rejects.toBeInstanceOf(SyncAuthError);
	});

	it('asks for sign-in when Google rejects the token', async () => {
		vi.mocked(fetch).mockResolvedValueOnce(respond('unauthorized', 401));
		await expect(drive().read()).rejects.toBeInstanceOf(SyncAuthError);
		expect(localStorage.getItem('traxy:sync:google-token')).toBeNull();
	});
});
