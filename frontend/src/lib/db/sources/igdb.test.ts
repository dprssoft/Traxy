import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
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
		expect((fetch as Mock).mock.calls[0][0]).toContain('oauth2/token');
	});

	it('requests themes and flags games with the Erotic theme as adult', async () => {
		(fetch as Mock).mockImplementation(async (url: string) =>
			url.includes('oauth2/token')
				? { ok: true, json: async () => ({ access_token: 'tok', expires_in: 7200 }) }
				: {
						ok: true,
						json: async () => [
							{ id: 1, name: 'Adult Game', themes: [1, 42] },
							{ id: 2, name: 'Safe Game', themes: [1] },
							{ id: 3, name: 'No Themes' },
						],
					},
		);

		const results = await discoverIgdbTrending();

		expect(results.map((r) => r.isAdult)).toEqual([true, false, false]);
		expect((fetch as Mock).mock.calls[1][1].body).toContain('themes');
	});

	it('returns [] without ever calling fetch when no IGDB credentials are configured', async () => {
		const { apiKeyStore } = await import('$lib/stores/apiKeys.svelte');
		apiKeyStore.current.igdbClientId = '';
		apiKeyStore.current.igdbClientSecret = '';

		const result = await discoverIgdbTrending();

		expect(result).toEqual([]);
		expect(fetch).not.toHaveBeenCalled();

		apiKeyStore.current.igdbClientId = 'client-id';
		apiKeyStore.current.igdbClientSecret = 'client-secret';
	});
});
