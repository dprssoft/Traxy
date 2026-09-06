import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	CATEGORIES,
	recordVisitedMedia,
	getVisitedMedia,
} from './catalogue.service';
import type { SearchResult } from '$lib/types/mediaTypes';

vi.mock('../index', () => ({
	getDb: vi.fn(() => null),
}));

describe('Catalogue Service', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('defines the 5 categories in wireframe order with clean labels', () => {
		expect(CATEGORIES.map((c) => c.id)).toEqual([
			'trending',
			'new',
			'top_rated',
			'random',
			'visited',
		]);
		expect(CATEGORIES.map((c) => c.label)).toEqual([
			'Trending',
			'New Releases',
			'Top Rated',
			'Random',
			'Visited Earlier',
		]);
	});

	it('records and retrieves visited media from localStorage', async () => {
		const item1: SearchResult = {
			source: 'tmdb',
			externalId: '101',
			type: 'film',
			title: 'Inception',
			year: 2010,
		};
		const item2: SearchResult = {
			source: 'tmdb',
			externalId: '102',
			type: 'tv',
			title: 'Breaking Bad',
			year: 2008,
		};

		recordVisitedMedia(item1);
		recordVisitedMedia(item2);

		const allVisited = await getVisitedMedia('all');
		expect(allVisited).toHaveLength(2);
		expect(allVisited[0].title).toBe('Breaking Bad');
		expect(allVisited[1].title).toBe('Inception');

		// Filter by film
		const filmVisited = await getVisitedMedia('film');
		expect(filmVisited).toHaveLength(1);
		expect(filmVisited[0].title).toBe('Inception');

		// Filter by tv
		const tvVisited = await getVisitedMedia('tv');
		expect(tvVisited).toHaveLength(1);
		expect(tvVisited[0].title).toBe('Breaking Bad');
	});

	it('deduplicates visited items and moves latest to the top', async () => {
		const item1: SearchResult = {
			source: 'tmdb',
			externalId: '101',
			type: 'film',
			title: 'Inception',
			year: 2010,
		};
		const item2: SearchResult = {
			source: 'tmdb',
			externalId: '102',
			type: 'film',
			title: 'Interstellar',
			year: 2014,
		};

		recordVisitedMedia(item1);
		recordVisitedMedia(item2);
		recordVisitedMedia(item1); // Re-visit item1

		const visited = await getVisitedMedia('all');
		expect(visited).toHaveLength(2);
		expect(visited[0].title).toBe('Inception');
		expect(visited[1].title).toBe('Interstellar');
	});
});
