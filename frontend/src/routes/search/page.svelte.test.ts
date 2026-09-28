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
vi.mock('$lib/stores/searchPrefs.svelte', () => ({
	searchPrefsStore: { load: async () => {}, current: {} },
}));

const results: SearchResult[] = [
	{ source: 'tmdb', externalId: '1', type: 'film', title: 'Heat' },
	{ source: 'tmdb', externalId: '2', type: 'film', title: 'Heat Wave' },
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
		expect(searchAll).toHaveBeenCalledWith('heat', 'film', {});
	});

	it('changes the type filter in place, without adding a history entry', async () => {
		mockPage.url = new URL('http://localhost/search?q=heat');
		render(SearchPage);

		await fireEvent.click(await screen.findByRole('tab', { name: 'Game' }));

		expect(goto).toHaveBeenCalledWith('/search?q=heat&type=game', {
			replaceState: true,
			keepFocus: true,
		});
	});

	it('shows the landing page without a query', () => {
		mockPage.url = new URL('http://localhost/search');
		render(SearchPage);

		expect(screen.getByText('Explore & Search')).toBeTruthy();
		expect(searchAll).not.toHaveBeenCalled();
	});
});
