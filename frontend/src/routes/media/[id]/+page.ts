import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { getMediaById, updateMediaMeta } from '$lib/db/services/media.service';
import { getTracking } from '$lib/db/services/tracking.service';
import { getCycles } from '$lib/db/services/cycle.service';
import { getTmdbDetails } from '$lib/db/sources/tmdb';
import { getAnilistDetails } from '$lib/db/sources/anilist';
import { getAppSettingBool } from '$lib/db/services/settings.service';
import { fetchWikidataEnrichment } from '$lib/db/sources/wikipedia';

export const load: PageLoad = async ({ params }) => {
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
			} catch {}
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
		} catch {}
	}
	
	if (refreshed) {
		const updated = await getMediaById(params.id);
		if (updated) media = updated;
	}

	// Wikidata enrichment — fill in missing fields when feature is enabled
	const hasMissingFields = !media.author || !media.country || !media.releaseStatus;
	if (hasMissingFields) {
		try {
			const enabled = await getAppSettingBool('feat_wikipedia_enrichment', false);
			if (enabled) {
				const enrichment = await fetchWikidataEnrichment(media.title, media.type);
				if (enrichment) {
					// Only fill in fields that are currently empty
					const patch: Record<string, unknown> = {};
					if (!media.author && enrichment.author) patch.author = enrichment.author;
					if (!media.country && enrichment.country) patch.country = enrichment.country;
					if (!media.releaseStatus && enrichment.releaseStatus) patch.releaseStatus = enrichment.releaseStatus;
					if ((!media.genres || media.genres.length === 0) && enrichment.genres) patch.genres = enrichment.genres;
					if (!media.totalEpisodes && enrichment.totalEpisodes) patch.totalEpisodes = enrichment.totalEpisodes;
					if (!media.totalSeasons && enrichment.totalSeasons) patch.totalSeasons = enrichment.totalSeasons;
					if (!media.totalVolumes && enrichment.totalVolumes) patch.totalVolumes = enrichment.totalVolumes;
					if (!media.totalChapters && enrichment.totalChapters) patch.totalChapters = enrichment.totalChapters;
					if (!media.totalPages && enrichment.totalPages) patch.totalPages = enrichment.totalPages;
					if (!media.runtimeMinutes && enrichment.runtimeMinutes) patch.runtimeMinutes = enrichment.runtimeMinutes;

					if (Object.keys(patch).length > 0) {
						await updateMediaMeta(media.id, patch);
						// Re-fetch so the returned media object reflects the enriched fields
						const enriched = await getMediaById(params.id);
						if (enriched) media = enriched;
					}
				}
			}
		} catch {
			// Wikidata enrichment is best-effort — never block page load on failure
		}
	}

	const tracking = await getTracking(params.id);
	const cycles = await getCycles(params.id);
	const showCountryFlags = await getAppSettingBool('ui_country_flags', false);

	return {
		media,
		tracking,
		cycles,
		showCountryFlags,
	};
};