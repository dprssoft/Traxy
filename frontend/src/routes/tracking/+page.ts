import type { PageLoad } from './$types';
import { getTrackingWithMedia } from '$lib/db/services/tracking.service';
import { getAppSetting, getTrackingTypeFilterPrefs } from '$lib/db/services/settings.service';

export const load: PageLoad = async ({ parent }) => {
	// Layout load runs initDb(); page loads run in parallel unless we wait for it.
	await parent();
	const [trackingList, typePrefs, viewSetting] = await Promise.all([
		getTrackingWithMedia(),
		getTrackingTypeFilterPrefs(),
		getAppSetting('tracking_view'),
	]);
	return {
		trackingList,
		typePrefs,
		view: (viewSetting === 'grid' ? 'grid' : 'list') as 'list' | 'grid',
	};
};