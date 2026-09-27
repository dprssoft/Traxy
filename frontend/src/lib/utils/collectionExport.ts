import type { CollectionEntry, CollectionSummary } from '$lib/types/collectionTypes';
import { MEDIA_TYPE_LABELS } from '$lib/constants';

/** Plain-text list for pasting into a chat or note: one numbered line per item. */
export function formatCollectionText(
	collection: CollectionSummary,
	entries: CollectionEntry[],
): string {
	const lines = [collection.name];
	if (collection.description) lines.push(collection.description);
	lines.push('');
	entries.forEach((entry, i) => {
		const { media } = entry;
		const year = media.year ? ` (${media.year})` : '';
		const type = collection.mediaType ? '' : ` — ${MEDIA_TYPE_LABELS[media.type]}`;
		lines.push(`${i + 1}. ${media.title}${year}${type}`);
		if (entry.note) lines.push(`   ${entry.note}`);
	});
	return lines.join('\n');
}

/** Structured export that keeps provider ids, so a list can be matched back to real titles. */
export function formatCollectionJson(
	collection: CollectionSummary,
	entries: CollectionEntry[],
	exportedAt = new Date().toISOString(),
): string {
	return JSON.stringify(
		{
			name: collection.name,
			description: collection.description ?? null,
			mediaType: collection.mediaType,
			ranked: collection.isRanked,
			exportedAt,
			items: entries.map((entry, i) => ({
				position: i + 1,
				title: entry.media.title,
				originalTitle: entry.media.originalTitle ?? null,
				year: entry.media.year ?? null,
				type: entry.media.type,
				source: entry.media.source,
				externalId: entry.media.externalId,
				note: entry.note ?? null,
				addedAt: entry.addedAt,
			})),
		},
		null,
		2,
	);
}

/** Filesystem-safe base name for an exported collection. */
export function collectionExportFilename(collection: CollectionSummary, ext: string): string {
	const slug = collection.name
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, '-')
		.replace(/^-+|-+$/g, '');
	return `traxy-${slug || 'collection'}.${ext}`;
}
