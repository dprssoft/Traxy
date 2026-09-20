import type { PageLoad } from './$types';
import { getTrackingWithMedia } from '$lib/db/services/tracking.service';
import { getTrackingTypeFilterPrefs } from '$lib/db/services/settings.service';

export const load: PageLoad = async ({ parent }) => {
	// Layout load runs initDb(); page loads run in parallel unless we wait for it.
	await parent();
	const [trackingList, typePrefs] = await Promise.all([
		getTrackingWithMedia(),
		getTrackingTypeFilterPrefs(),
	]);
	return {
		trackingList,
		typePrefs,
	};
};