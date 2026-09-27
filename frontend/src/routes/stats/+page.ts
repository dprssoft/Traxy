import type { PageLoad } from './$types';
import { getTrackingWithMedia } from '$lib/db/services/tracking.service';

export const load: PageLoad = async ({ parent }) => {
	// Layout load runs initDb(); page loads run in parallel unless we wait for it.
	await parent();
	const trackingList = await getTrackingWithMedia();

	return {
		trackingList,
	};
};
