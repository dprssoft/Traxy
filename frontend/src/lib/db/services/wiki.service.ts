/**
 * Wikipedia / Wikidata enrichment — fills gaps in a Media row from Wikidata
 * and resolves the title's Wikipedia article. Never overwrites provider data.
 *
 * The fields it fills are recorded in `Media.wikiMeta`, so when a later lookup
 * matches a different Wikidata entity (e.g. after a matching fix), the old
 * entity's values are cleared and filled again from the new one.
 */
import type { LocalMedia, MediaMetaPatch } from '$lib/types/mediaTypes';
import { fetchWikidataEnrichment, type WikipediaEnrichment } from '../sources/wikipedia';
import { getMediaById, updateMediaMeta } from './media.service';

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
 * Work out the full update for a new lookup result: clear what a previous, different
 * match filled, fill gaps from the current match, and update the wikiMeta record.
 * Returns an empty patch when nothing changes.
 */
export function planWikiUpdate(
	media: LocalMedia,
	enrichment: WikipediaEnrichment | null,
): MediaMetaPatch {
	const prev = media.wikiMeta;
	const sameMatch = !!prev && prev.wikidataId === enrichment?.wikidataId;

	const cleared: MediaMetaPatch = {};
	if (prev && !sameMatch) {
		for (const field of prev.fields) (cleared as Record<string, null>)[field] = null;
	}

	if (!enrichment) return prev ? { ...cleared, wikiMeta: null } : {};

	const base = { ...media, ...cleared } as LocalMedia;
	const filled = buildWikiPatch(base, enrichment);
	const filledFields = Object.keys(filled);
	if (sameMatch && filledFields.length === 0) return {};

	const fields = [...new Set([...(sameMatch ? prev.fields : []), ...filledFields])];
	return { ...cleared, ...filled, wikiMeta: { wikidataId: enrichment.wikidataId, fields } };
}

/**
 * Enrich `media` from Wikidata. Best-effort: any failure (e.g. offline) returns the
 * media unchanged.
 */
export async function enrichMediaFromWiki(
	media: LocalMedia,
): Promise<{ media: LocalMedia; wikipediaUrl: string | null }> {
	try {
		const enrichment = await fetchWikidataEnrichment(media.title, media.type, WIKI_LANGUAGE);
		const patch = planWikiUpdate(media, enrichment);
		if (Object.keys(patch).length > 0) {
			await updateMediaMeta(media.id, patch);
			media = (await getMediaById(media.id)) ?? media;
		}
		return { media, wikipediaUrl: enrichment?.wikipediaUrl ?? null };
	} catch {
		return { media, wikipediaUrl: null };
	}
}
