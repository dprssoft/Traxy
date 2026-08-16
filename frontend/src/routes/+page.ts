import type { PageLoad } from './$types';
import { getActivityFeed } from '$lib/db/services/activity.service';

export const load: PageLoad = async () => {
	try {
		const initialActivities = await getActivityFeed(20, 0);
		return { activities: initialActivities };
	} catch {
		// DB may not be initialized yet on very first render — return empty feed
		return { activities: [] };
	}
};