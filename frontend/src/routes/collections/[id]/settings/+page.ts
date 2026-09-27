import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { getCollection } from '$lib/db/services/collection.service';

export const load: PageLoad = async ({ params, parent }) => {
	// Layout load runs initDb(); page loads run in parallel unless we wait for it.
	await parent();
	const collection = await getCollection(params.id);
	if (!collection) error(404, 'Collection not found');
	return { collection };
};
