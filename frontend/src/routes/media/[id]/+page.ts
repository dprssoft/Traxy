import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { getMediaById } from '$lib/db/services/media.service';
import { getTracking } from '$lib/db/services/tracking.service';
import { getCycles } from '$lib/db/services/cycle.service';

export const load: PageLoad = async ({ params }) => {
	const media = await getMediaById(params.id);
	if (!media) {
		error(404, 'Media not found');
	}

	const tracking = await getTracking(params.id);
	const cycles = await getCycles(params.id);

	return {
		media,
		tracking,
		cycles,
	};
};