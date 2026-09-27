import type { PageLoad } from './$types';
import { getCloudSyncEnabled } from '$lib/db/services/settings.service';

export const load: PageLoad = async ({ parent }) => {
	// Layout load runs initDb(); wait for it before reading settings.
	await parent();
	return { syncEnabled: await getCloudSyncEnabled() };
};
