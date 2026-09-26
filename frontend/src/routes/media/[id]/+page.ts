import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import type { LocalMedia } from '$lib/types/mediaTypes';
import { fillMissingDetails, getMediaById } from '$lib/db/services/media.service';
import { getTracking } from '$lib/db/services/tracking.service';
import { getCycles } from '$lib/db/services/cycle.service';
import { getAppSettingBool, getWikiEnrichmentEnabled } from '$lib/db/services/settings.service';
import { enrichMediaFromWiki } from '$lib/db/services/wiki.service';

/** Network-bound enrichment, run after the page is shown. */
async function enrich(media: LocalMedia): Promise<{ media: LocalMedia; wikipediaUrl: string | null }> {
	media = await fillMissingDetails(media);
	if (await getWikiEnrichmentEnabled()) return enrichMediaFromWiki(media);
	return { media, wikipediaUrl: null };
}

export const load: PageLoad = async ({ params, parent }) => {
	// Layout load runs initDb(); page loads run in parallel unless we wait for it.
	await parent();
	const media = await getMediaById(params.id);
	if (!media) {
		error(404, 'Media not found');
	}

	const tracking = await getTracking(params.id);
	const cycles = await getCycles(params.id);
	const showCountryFlags = await getAppSettingBool('ui_country_flags', false);

	return {
		media,
		tracking,
		cycles,
		showCountryFlags,
		// Not awaited: the page renders from local data and swaps in the enriched media
		enriched: enrich(media).catch(() => ({ media, wikipediaUrl: null })),
	};
};
