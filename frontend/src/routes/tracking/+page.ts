import type { PageLoad } from './$types';
import { getTrackingWithMedia } from '$lib/db/services/tracking.service';

export const load: PageLoad = async () => {
	const trackingList = await getTrackingWithMedia();
	return {
		trackingList,
	};
};