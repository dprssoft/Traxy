import { describe, it, expect } from 'vitest';
import type { CollectionEntry, CollectionSummary } from '$lib/types/collectionTypes';
import type { LocalMedia } from '$lib/types/mediaTypes';
import {
	collectionExportFilename,
	formatCollectionJson,
	formatCollectionText,
} from './collectionExport';

const collection = (overrides: Partial<CollectionSummary> = {}): CollectionSummary => ({
	id: 'c1',
	name: 'Cozy Games!',
	description: 'Rainy days',
	mediaType: null,
	systemKey: null,
	isRanked: false,
	itemCount: 2,
	coverUrls: [],
	createdAt: '2026-01-01',
	updatedAt: '2026-01-01',
	...overrides,
});

const entry = (media: Partial<LocalMedia>, note?: string): CollectionEntry => ({
	itemId: `i-${media.id}`,
	media: {
		source: 'igdb',
		externalId: `x-${media.id}`,
		type: 'game',
		title: '',
		...media,
	} as LocalMedia,
	sortOrder: 0,
	addedAt: '2026-02-01',
	note,
});

const entries = [
	entry({ id: 'a', title: 'Stardew Valley', year: 2016 }, 'Co-op with friends'),
	entry({ id: 'b', title: 'Dune', type: 'film' }),
];

describe('collection export', () => {
	it('formats a numbered text list with types for shared collections', () => {
		expect(formatCollectionText(collection(), entries)).toBe(
			[
				'Cozy Games!',
				'Rainy days',
				'',
				'1. Stardew Valley (2016) — Game',
				'   Co-op with friends',
				'2. Dune — Film',
			].join('\n'),
		);
	});

	it('omits the type when the collection holds one media type', () => {
		const text = formatCollectionText(collection({ mediaType: 'game', description: undefined }), [
			entries[0],
		]);
		expect(text).toBe('Cozy Games!\n\n1. Stardew Valley (2016)\n   Co-op with friends');
	});

	it('exports JSON with provider ids and positions', () => {
		const json = JSON.parse(formatCollectionJson(collection({ isRanked: true }), entries, 'now'));
		expect(json).toMatchObject({ name: 'Cozy Games!', ranked: true, exportedAt: 'now' });
		expect(json.items[1]).toMatchObject({
			position: 2,
			title: 'Dune',
			type: 'film',
			source: 'igdb',
			externalId: 'x-b',
			note: null,
		});
	});

	it('builds a safe filename', () => {
		expect(collectionExportFilename(collection(), 'json')).toBe('traxy-cozy-games.json');
		expect(collectionExportFilename(collection({ name: '???' }), 'txt')).toBe(
			'traxy-collection.txt',
		);
	});
});
