import { describe, it, expect } from 'vitest';
import { buildWikiPatch } from './wiki.service';
import type { LocalMedia } from '$lib/types/mediaTypes';

const media = {
	id: 'm1',
	source: 'tmdb',
	externalId: '1',
	type: 'tv',
	title: 'Show',
	author: 'Existing Author',
	genres: [],
} as unknown as LocalMedia;

describe('buildWikiPatch', () => {
	it('fills only empty fields and never overwrites existing data', () => {
		const patch = buildWikiPatch(media, {
			wikidataId: 'Q1',
			author: 'Wiki Author',
			country: 'Japan',
			genres: ['Drama'],
			totalEpisodes: 12,
		});
		expect(patch).toEqual({ country: 'Japan', genres: ['Drama'], totalEpisodes: 12 });
	});

	it('returns an empty patch when Wikidata has nothing new', () => {
		expect(buildWikiPatch(media, { wikidataId: 'Q1', author: 'Wiki Author' })).toEqual({});
	});
});
