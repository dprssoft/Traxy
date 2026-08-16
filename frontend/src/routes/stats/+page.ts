import type { PageLoad } from './$types';
import { getActivityHeatmap } from '$lib/db/services/activity.service';
import { getTrackingWithMedia } from '$lib/db/services/tracking.service';

export const load: PageLoad = async () => {
	const currentYear = new Date().getFullYear();
	const heatmapDays = await getActivityHeatmap(currentYear);
	const trackingList = await getTrackingWithMedia();

	return {
		year: currentYear,
		heatmapDays,
		trackingList
	};
};
