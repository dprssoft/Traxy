/**
 * Wikipedia / Wikidata enrichment — fills gaps in a Media row from Wikidata
 * and resolves the title's Wikipedia article. Never overwrites provider data.
 *
 * The fields it fills are recorded in `Media.wikiMeta`, so when a later lookup
 * matches a different Wikidata entity (e.g. after a matching fix), the old
 * entity's values are cleared and filled again from the new one.
 *
 * Rows without `wikiMeta` (new, or enriched before it existed) are first checked
 * against their provider once: provider values win, and stored values the provider
 * lacks — possibly from an old wrong match — are replaced if the current match has
 * them. Nothing is cleared on that pass, so imported data can't be lost.
 */
import type { LocalMedia, MediaMetaPatch, SearchResult } from '$lib/types/mediaTypes';
import { fetchWikidataEnrichment, type WikipediaEnrichment } from '../sources/wikipedia';
import { fetchProviderDetails, getMediaById, updateMediaMeta } from './media.service';

/** Display language for Wikidata labels and article links. Switch to the app locale once i18n lands. */
const WIKI_LANGUAGE = 'en';

const FILLABLE_FIELDS = [
	'author',
	'country',
	'description',
	'releaseStatus',
	'totalEpisodes',
	'totalSeasons',
	'totalVolumes',
	'totalChapters',
	'totalPages',
	'runtimeMinutes',
	'genres',
] as const;

/** Metadata fields a provider owns; its non-empty values win over stored ones. */
const PROVIDER_FIELDS = [
	...FILLABLE_FIELDS,
	'title',
	'year',
	'posterUrl',
	'originalTitle',
	'serializationYears',
	'platforms',
	'seasonData',
	'isAdult',
] as const;

function isEmpty(value: unknown): boolean {
	return Array.isArray(value) ? value.length === 0 : !value;
}

/** Build a patch containing only the fields that are empty on `media` and present in `enrichment`. */
export function buildWikiPatch(
	media: LocalMedia,
	enrichment: WikipediaEnrichment,
): Partial<LocalMedia> {
	const patch: Record<string, unknown> = {};
	for (const field of FILLABLE_FIELDS) {
		if (isEmpty(media[field]) && !isEmpty(enrichment[field])) patch[field] = enrichment[field];
	}
	return patch as Partial<LocalMedia>;
}

/**
 * Compare a stored row with fresh provider details. Returns the provider values that differ
 * (never empties) and the fillable fields that hold a value the provider doesn't have.
 */
export function diffWithProvider(
	media: LocalMedia,
	details: SearchResult,
): { patch: Partial<LocalMedia>; suspects: string[] } {
	const patch: Record<string, unknown> = {};
	for (const field of PROVIDER_FIELDS) {
		const value = details[field];
		if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) continue;
		if (JSON.stringify(value) !== JSON.stringify(media[field])) patch[field] = value;
	}
	const suspects = FILLABLE_FIELDS.filter((f) => !isEmpty(media[f]) && isEmpty(details[f]));
	return { patch: patch as Partial<LocalMedia>, suspects };
}

/**
 * Work out the full update for a lookup result: clear what a previous, different match
 * filled, fill gaps (and `suspects`) from the current match, and update wikiMeta.
 * Returns an empty patch when nothing changes.
 */
export function planWikiUpdate(
	media: LocalMedia,
	enrichment: WikipediaEnrichment | null,
	suspects: readonly string[] = [],
): MediaMetaPatch {
	const prev = media.wikiMeta;
	const wikidataId = enrichment?.wikidataId ?? null;
	const sameMatch = !!prev && prev.wikidataId === wikidataId;

	const cleared: Record<string, null> = {};
	if (prev && !sameMatch) {
		for (const field of prev.fields) cleared[field] = null;
	}

	// Suspect values count as gaps, but stay put unless the match has a replacement
	const base: Record<string, unknown> = { ...media, ...cleared };
	for (const field of suspects) base[field] = undefined;
	const filled = enrichment ? buildWikiPatch(base as unknown as LocalMedia, enrichment) : {};
	const filledFields = Object.keys(filled);
	if (sameMatch && filledFields.length === 0) return {};

	const fields = [...new Set([...(sameMatch ? prev.fields : []), ...filledFields])];
	return { ...cleared, ...filled, wikiMeta: { wikidataId, fields } };
}

/**
 * Enrich `media` from Wikidata. Best-effort: any failure (e.g. offline) returns the
 * media unchanged, and an unchecked row is retried on the next open.
 */
export async function enrichMediaFromWiki(
	media: LocalMedia,
): Promise<{ media: LocalMedia; wikipediaUrl: string | null }> {
	try {
		let providerPatch: Partial<LocalMedia> = {};
		let suspects: string[] = [];
		if (!media.wikiMeta) {
			// Provider details are cached from when the item was added, so this is usually local
			const details = await fetchProviderDetails(media).catch(() => null);
			if (details) ({ patch: providerPatch, suspects } = diffWithProvider(media, details));
		}

		const merged = { ...media, ...providerPatch };
		const enrichment = await fetchWikidataEnrichment(merged.title, merged.type, WIKI_LANGUAGE);
		const patch = { ...providerPatch, ...planWikiUpdate(merged, enrichment, suspects) };
		if (Object.keys(patch).length > 0) {
			await updateMediaMeta(media.id, patch);
			media = (await getMediaById(media.id)) ?? media;
		}
		return { media, wikipediaUrl: enrichment?.wikipediaUrl ?? null };
	} catch {
		return { media, wikipediaUrl: null };
	}
}
