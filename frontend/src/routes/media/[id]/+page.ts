import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { getMediaById, updateMediaMeta } from '$lib/db/services/media.service';
import { getTracking } from '$lib/db/services/tracking.service';
import { getCycles } from '$lib/db/services/cycle.service';
import { getTmdbDetails } from '$lib/db/sources/tmdb';
import { getAnilistDetails } from '$lib/db/sources/anilist';
import { getAppSettingBool, getWikiEnrichmentEnabled } from '$lib/db/services/settings.service';
import { enrichMediaFromWiki } from '$lib/db/services/wiki.service';

export const load: PageLoad = async ({ params, parent }) => {
	// Layout load runs initDb(); page loads run in parallel unless we wait for it.
	await parent();
	let media = await getMediaById(params.id);
	if (!media) {
		error(404, 'Media not found');
	}

	// Silently refresh stale metadata
	let refreshed = false;
	if ((media.type === 'tv' && !media.seasonData) || (media.type === 'film' && !media.runtimeMinutes)) {
		if (media.source === 'tmdb') {
			try {
				const details = await getTmdbDetails(media.externalId, media.type);
				const patch: Record<string, unknown> = {};
				if (details?.seasonData) {
					patch.totalSeasons = details.totalSeasons;
					patch.totalEpisodes = details.totalEpisodes;
					patch.seasonData = details.seasonData;
				}
				if (details?.runtimeMinutes) {
					patch.runtimeMinutes = details.runtimeMinutes;
				}
				if (Object.keys(patch).length > 0) {
					await updateMediaMeta(params.id, patch);
					refreshed = true;
				}
			} catch {
				// Best effort fallback
			}
		}
	} else if (media.type === 'anime' && media.source === 'anilist' && (!media.seasonData || !media.runtimeMinutes)) {
		try {
			const details = await getAnilistDetails(parseInt(media.externalId));
			const patch: Record<string, unknown> = {};
			if (details?.seasonData) {
				patch.totalSeasons = details.totalSeasons;
				patch.seasonData = details.seasonData;
			}
			if (details?.runtimeMinutes) {
				patch.runtimeMinutes = details.runtimeMinutes;
			}
			if (Object.keys(patch).length > 0) {
				await updateMediaMeta(params.id, patch);
				refreshed = true;
			}
		} catch {
			// Best effort fallback
		}
	} else if (media.type === 'game' && !media.timeToBeat) {
		try {
			if (media.source === 'igdb') {
				// Direct IGDB lookup using the stored game ID
				const { fetchIgdbTimeToBeat } = await import('$lib/db/sources/igdb');
				const ttb = await fetchIgdbTimeToBeat(media.externalId);
				if (ttb) {
					await updateMediaMeta(params.id, { timeToBeat: JSON.stringify(ttb) });
					refreshed = true;
				} else {
					console.error('[TTB] IGDB returned no data for id:', media.externalId);
				}
			} else {
				// Non-IGDB source: search IGDB by title
				const { fetchIgdbTimeToBeatByTitle } = await import('$lib/db/sources/igdb');
				const ttb = await fetchIgdbTimeToBeatByTitle(media.title);
				if (ttb) {
					await updateMediaMeta(params.id, { timeToBeat: JSON.stringify(ttb) });
					refreshed = true;
				} else {
					console.error('[TTB] IGDB title search returned no data for:', media.title);
				}
			}
		} catch (e) {
			console.error('[TTB] enrichment failed:', e);
		}
	}
	
	if (refreshed) {
		const updated = await getMediaById(params.id);
		if (updated) media = updated;
	}

	// Wikidata enrichment — fills missing fields and finds the Wikipedia article
	let wikipediaUrl: string | null = null;
	if (await getWikiEnrichmentEnabled()) {
		({ media, wikipediaUrl } = await enrichMediaFromWiki(media));
	}

	const tracking = await getTracking(params.id);
	const cycles = await getCycles(params.id);
	const showCountryFlags = await getAppSettingBool('ui_country_flags', false);

	return {
		media,
		tracking,
		cycles,
		showCountryFlags,
		wikipediaUrl,
	};
};