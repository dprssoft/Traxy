import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	getContentFilterPrefs,
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
