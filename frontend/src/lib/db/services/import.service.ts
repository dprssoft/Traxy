import { getDb } from '../index';
import { upsertMedia } from './media.service';
import { upsertTracking } from './tracking.service';
import { logActivity } from './activity.service';

function mapMalStatus(status: string): import('$lib/db/schema').TrackingStatusType {
	switch (status) {
		case '1': return 'in_progress';
		case '2': return 'completed';
		case '3': return 'paused';
		case '4': return 'dropped';
		case '6': return 'planned';
		default: return 'planned';
	}
}

export async function importFromMal(xmlText: string): Promise<{ success: number; failed: number }> {
	const parser = new DOMParser();
	const xml = parser.parseFromString(xmlText, 'text/xml');
	
	const animes = xml.querySelectorAll('anime');
	let success = 0;
	let failed = 0;

	for (const anime of Array.from(animes)) {
		try {
			const malId = anime.querySelector('series_animedb_id')?.textContent;
			const title = anime.querySelector('series_title')?.textContent;
			const myWatched = parseInt(anime.querySelector('my_watched_episodes')?.textContent || '0');
			const myScore = parseInt(anime.querySelector('my_score')?.textContent || '0');
			const myStatus = anime.querySelector('my_status')?.textContent;

			if (!malId) {
				failed++;
				continue;
			}

			// We need full details to get poster, year, etc. 
			// AniList accepts MAL IDs via external links, but getting details by MAL ID directly is tricky in AniList GraphQL.
			// Actually, AniList allows querying by `idMal`.
			// Since we don't have an `idMal` query built, we will just insert it as a stub or try to search AniList by title.
			// Or we can just insert the basic details manually!
			
			// Let's insert a basic record first. If the user clicks it later, it will be somewhat sparse,
			// but we can at least display the title.
			
			const mediaId = crypto.randomUUID();
			
			// We use 'manual' source if we don't fetch full AniList metadata right now, 
			// or we can mark it as 'anilist' and use the MAL ID as externalId (which might break details fetching).
			// Better approach: use 'manual' and externalId = malId
			
			await upsertMedia({
				id: mediaId,
				source: 'manual',
				externalId: `mal-${malId}`,
				type: 'anime',
				title: title || 'Unknown Anime',
			});

			await upsertTracking({
				mediaId: mediaId,
				status: mapMalStatus(myStatus || '6'),
				score: myScore > 0 ? myScore : undefined,
				currentEpisode: myWatched,
			});

			success++;
		} catch (err) {
			console.error('Failed to import item', err);
			failed++;
		}
	}

	if (success > 0) {
		await logActivity({
			mediaId: 'system',
			mediaType: 'film', // dummy
			mediaTitle: 'System',
			eventType: 'mal_import',
			payload: { count: success },
		});
	}

	return { success, failed };
}
