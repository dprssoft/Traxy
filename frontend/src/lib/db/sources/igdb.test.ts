import { describe, it, expect, vi, beforeEach } from 'vitest';
import { discoverIgdbTrending } from './igdb';

vi.mock('../apiCache', () => ({
	getCached: vi.fn(async () => null),
	setCache: vi.fn(async () => {}),
}));

vi.mock('$lib/stores/apiKeys.svelte', () => ({
	apiKeyStore: { current: { igdbClientId: 'client-id', igdbClientSecret: 'client-secret' } },
}));

describe('discoverIgdbTrending', () => {
	beforeEach(() => {
		localStorage.clear();
		vi.clearAllMocks();
		vi.stubGlobal(
			'fetch',
			vi.fn(async (url: string) => {
				if (url.includes('oauth2/token')) {
					return {
						ok: true,
						json: async () => ({ access_token: 'tok', expires_in: 7200 }),
					};
				}
				return {
					ok: true,
					json: async () => [
						{ id: 1, name: 'Trending Game', first_release_date: 1600000000, platforms: [] },
					],
				};
			}),
		);
	});

	it('fetches a Twitch token then queries IGDB, returning mapped results', async () => {
		const result = await discoverIgdbTrending();

		expect(result).toEqual([
			expect.objectContaining({ externalId: '1', source: 'igdb', title: 'Trending Game' }),
		]);
		expect(fetch).toHaveBeenCalledTimes(2);
		expect((fetch as any).mock.calls[0][0]).toContain('oauth2/token');
	});

	it('returns [] without ever calling fetch when no IGDB credentials are configured', async () => {
		const { apiKeyStore } = await import('$lib/stores/apiKeys.svelte');
		(apiKeyStore as any).current.igdbClientId = '';
		(apiKeyStore as any).current.igdbClientSecret = '';

		const result = await discoverIgdbTrending();

		expect(result).toEqual([]);
		expect(fetch).not.toHaveBeenCalled();

		(apiKeyStore as any).current.igdbClientId = 'client-id';
		(apiKeyStore as any).current.igdbClientSecret = 'client-secret';
	});
});
