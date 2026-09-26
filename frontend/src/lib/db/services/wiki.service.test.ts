import { describe, it, expect } from 'vitest';
import { buildWikiPatch, planWikiUpdate } from './wiki.service';
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

describe('planWikiUpdate', () => {
	const vagabond = {
		id: 'm2',
		source: 'openlibrary',
		externalId: '2',
		type: 'manga',
		title: 'Vagabond',
		author: 'Takehiko Inoue',
		country: 'Norway',
		wikiMeta: { wikidataId: 'Q12008802', fields: ['country'] },
	} as unknown as LocalMedia;

	it('clears fields from a previous different match and refills them', () => {
		const patch = planWikiUpdate(vagabond, { wikidataId: 'Q1244799', country: 'Japan' });
		expect(patch).toEqual({
			country: 'Japan',
			wikiMeta: { wikidataId: 'Q1244799', fields: ['country'] },
		});
	});

	it('clears previous fields when nothing matches any more', () => {
		expect(planWikiUpdate(vagabond, null)).toEqual({ country: null, wikiMeta: null });
	});

	it('changes nothing when the match is unchanged and there are no new gaps', () => {
		expect(planWikiUpdate(vagabond, { wikidataId: 'Q12008802', country: 'Norway' })).toEqual({});
	});

	it('records fields on a first match without clearing provider data', () => {
		const fresh = { ...vagabond, country: undefined, wikiMeta: undefined } as LocalMedia;
		expect(planWikiUpdate(fresh, { wikidataId: 'Q1244799', country: 'Japan', author: 'X' })).toEqual({
			country: 'Japan',
			wikiMeta: { wikidataId: 'Q1244799', fields: ['country'] },
		});
	});
});
