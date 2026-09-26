import type { PageLoad } from './$types';
import { getWikiEnrichmentEnabled } from '$lib/db/services/settings.service';

export const load: PageLoad = async ({ parent }) => {
	// Layout load runs initDb(); wait for it before reading settings.
	await parent();
	return { wikiEnabled: await getWikiEnrichmentEnabled() };
};
