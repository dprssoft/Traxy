import type { PageLoad } from './$types';
import { getActivityFeed } from '$lib/db/services/activity.service';

export const load: PageLoad = async ({ parent }) => {
	// Layout load runs initDb(); page loads run in parallel unless we wait for it.
	await parent();
	try {
		const initialActivities = await getActivityFeed(20, 0);
		return { activities: initialActivities };
	} catch {
		// Feed is non-critical — fall back to empty on DB errors
		return { activities: [] };
	}
};
