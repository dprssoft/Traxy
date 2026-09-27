import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	DEFAULT_SEARCH_PREFS,
	getContentFilterPrefs,
	getSearchPrefs,
	setSearchPrefs,
	setContentFilterEnabled,
	setContentFilterMode,
} from './settings.service';

let settings: Record<string, string> = {};

vi.mock('../index', () => ({
	getDb: () => ({
		query: vi.fn(async (_sql: string, [key]: string[]) => ({
			values: key in settings ? [[settings[key]]] : [],
		})),
		run: vi.fn(async (_sql: string, [key, value]: string[]) => {
			settings[key] = value;
			return { changes: 1 };
		}),
	}),
}));

describe('content filter prefs', () => {
	beforeEach(() => {
		settings = {};
	});

	it('defaults to an enabled hide filter that has not been asked yet', async () => {
		expect(await getContentFilterPrefs()).toEqual({
			enabled: true,
			mode: 'hide',
			asked: false,
		});
	});

	it('marks the prompt as answered once the flag is written', async () => {
		await setContentFilterEnabled(false);
		expect(await getContentFilterPrefs()).toEqual({
			enabled: false,
			mode: 'hide',
			asked: true,
		});
	});

	it('persists the blur mode', async () => {
		await setContentFilterEnabled(true);
		await setContentFilterMode('blur');
		expect(await getContentFilterPrefs()).toEqual({ enabled: true, mode: 'blur', asked: true });
	});
});

describe('search prefs', () => {
	beforeEach(() => {
		settings = {};
	});

	it('defaults when nothing is stored', async () => {
		expect(await getSearchPrefs()).toEqual(DEFAULT_SEARCH_PREFS);
	});

	it('round-trips saved prefs and fills keys added later', async () => {
		settings.search_prefs = JSON.stringify({ flashpointEnabled: true });
		expect(await getSearchPrefs()).toEqual({ ...DEFAULT_SEARCH_PREFS, flashpointEnabled: true });

		await setSearchPrefs({ ...DEFAULT_SEARCH_PREFS, anilistWinsAnime: false });
		expect((await getSearchPrefs()).anilistWinsAnime).toBe(false);
	});

	it('falls back to defaults on unreadable JSON', async () => {
		settings.search_prefs = '{oops';
		expect(await getSearchPrefs()).toEqual(DEFAULT_SEARCH_PREFS);
	});
});
