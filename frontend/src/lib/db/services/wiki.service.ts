/**
 * Wikipedia / Wikidata enrichment — fills gaps in a Media row from Wikidata
 * and resolves the title's Wikipedia article. Never overwrites existing data.
 */
import type { LocalMedia } from '$lib/types/mediaTypes';
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
] as const;

/** Build a patch containing only the fields that are empty on `media` and present in `enrichment`. */
export function buildWikiPatch(
	media: LocalMedia,
	enrichment: WikipediaEnrichment,
): Partial<LocalMedia> {
	const patch: Partial<LocalMedia> = {};
	for (const field of FILLABLE_FIELDS) {
		if (!media[field] && enrichment[field]) {
			(patch as Record<string, unknown>)[field] = enrichment[field];
		}
	}
	if (!media.genres?.length && enrichment.genres?.length) patch.genres = enrichment.genres;
	return patch;
}

/**
 * Enrich `media` from Wikidata. Best-effort: any failure returns the media unchanged.
 */
export async function enrichMediaFromWiki(
	media: LocalMedia,
): Promise<{ media: LocalMedia; wikipediaUrl: string | null }> {
	try {
		const enrichment = await fetchWikidataEnrichment(media.title, media.type, WIKI_LANGUAGE);
		if (!enrichment) return { media, wikipediaUrl: null };

		const patch = buildWikiPatch(media, enrichment);
		if (Object.keys(patch).length > 0) {
			await updateMediaMeta(media.id, patch);
			media = (await getMediaById(media.id)) ?? media;
		}
		return { media, wikipediaUrl: enrichment.wikipediaUrl ?? null };
	} catch {
		return { media, wikipediaUrl: null };
	}
}
