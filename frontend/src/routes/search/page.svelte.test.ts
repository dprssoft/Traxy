import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import SearchPage from './+page.svelte';
import { goto } from '$app/navigation';
import { searchAll } from '$lib/db/services/search.service';
import type { SearchResult } from '$lib/types/mediaTypes';

const mockPage = vi.hoisted(() => ({ url: new URL('http://localhost/search') }));

vi.mock('$app/state', () => ({ page: mockPage }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$lib/db/services/search.service', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/db/services/search.service')>()),
	searchAll: vi.fn(),
}));
vi.mock('$lib/db/services/media.service', () => ({ ensureLocalMedia: vi.fn() }));
vi.mock('$lib/db/services/tracking.service', () => ({
	getTrackedExternalKeys: async () => new Set(['tmdb:2']),
}));
vi.mock('$lib/stores/searchPrefs.svelte', () => ({
	searchPrefsStore: { load: async () => {}, current: {} },
}));

const results: SearchResult[] = [
	{ source: 'tmdb', externalId: '1', type: 'film', title: 'Heat', year: 1995 },
	{ source: 'tmdb', externalId: '2', type: 'film', title: 'Heat Wave', year: 2021 },
];

describe('search page', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(searchAll).mockResolvedValue(results);
	});
	afterEach(cleanup);

	it('shows every result for the query in the URL', async () => {
		mockPage.url = new URL('http://localhost/search?q=heat&type=film');
		render(SearchPage);

		expect(await screen.findByText('2 results')).toBeTruthy();
		expect(screen.getByText('Results for “heat”')).toBeTruthy();
		expect(screen.getAllByText('Heat Wave').length).toBeGreaterThan(0);
		expect(searchAll).toHaveBeenCalledWith('heat', ['film'], {});
	});

	it('adds a type to the filter in place, without adding a history entry', async () => {
		mockPage.url = new URL('http://localhost/search?q=heat&type=film');
		render(SearchPage);

		await fireEvent.click(await screen.findByRole('button', { name: 'Games' }));

		expect(goto).toHaveBeenCalledWith('/search?q=heat&type=film&type=game', {
			replaceState: true,
			keepFocus: true,
			noScroll: true,
		});
	});

	it('"All" clears the type filter', async () => {
		mockPage.url = new URL('http://localhost/search?q=heat&type=film');
		render(SearchPage);

		await fireEvent.click(await screen.findByRole('button', { name: 'All' }));

		expect(goto).toHaveBeenCalledWith('/search?q=heat', expect.anything());
	});

	it('applies year and library filters from the URL without searching again', async () => {
		mockPage.url = new URL('http://localhost/search?q=heat&from=2000&lib=tracked');
		render(SearchPage);

		expect(await screen.findByText('1 of 2 results')).toBeTruthy();
		expect(screen.getAllByText('Heat Wave').length).toBeGreaterThan(0);
		expect(screen.getByText('✓ In library')).toBeTruthy();
		expect(screen.getByRole('button', { name: /From 2000/ })).toBeTruthy();
		expect(searchAll).toHaveBeenCalledTimes(1);
	});

	it('shows the landing page without a query', () => {
		mockPage.url = new URL('http://localhost/search');
		render(SearchPage);

		expect(screen.getByText('Explore & Search')).toBeTruthy();
		expect(searchAll).not.toHaveBeenCalled();
	});
});
