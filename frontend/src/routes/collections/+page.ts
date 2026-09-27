import type { PageLoad } from './$types';
import { listCollections } from '$lib/db/services/collection.service';

export const load: PageLoad = async ({ parent }) => {
	// Layout load runs initDb(); page loads run in parallel unless we wait for it.
	await parent();
	return { collections: await listCollections() };
};
