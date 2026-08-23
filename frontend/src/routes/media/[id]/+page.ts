import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { getMediaById, updateMediaMeta } from '$lib/db/services/media.service';
import { getTracking } from '$lib/db/services/tracking.service';
import { getCycles } from '$lib/db/services/cycle.service';
import { getTmdbDetails } from '$lib/db/sources/tmdb';
import { getAnilistDetails } from '$lib/db/sources/anilist';

export const load: PageLoad = async ({ params }) => {
	const media = await getMediaById(params.id);
	if (!media) {
		error(404, 'Media not found');
	}

	// Silently refresh stale metadata
	if (!media.seasonData) {
		if (media.source === 'tmdb' && media.type === 'tv') {
			getTmdbDetails(media.externalId, 'tv').then((details) => {
				if (details?.seasonData) {
					updateMediaMeta(media.id, {
						totalSeasons: details.totalSeasons,
						totalEpisodes: details.totalEpisodes,
						seasonData: details.seasonData
					});
				}
			}).catch(() => {});
		} else if (media.source === 'anilist' && media.type === 'anime') {
			getAnilistDetails(parseInt(media.externalId)).then((details) => {
				if (details?.seasonData) {
					updateMediaMeta(media.id, {
						totalSeasons: details.totalSeasons,
						seasonData: details.seasonData
					});
				}
			}).catch(() => {});
		}
	}

	const tracking = await getTracking(params.id);
	const cycles = await getCycles(params.id);

	return {
		media,
		tracking,
		cycles,
	};
};