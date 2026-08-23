import { getDb } from '../index';
import { upsertMedia } from './media.service';
import { upsertTracking } from './tracking.service';
import { logActivity } from './activity.service';
import { getAnilistDetails } from '../sources/anilist';
import { getTmdbDetails } from '../sources/tmdb';
import { fetchJson } from '../fetchUtils';

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

function mapAnilistStatus(status: string): import('$lib/db/schema').TrackingStatusType {
	switch (status) {
		case 'CURRENT': return 'in_progress';
		case 'COMPLETED': return 'completed';
		case 'PAUSED': return 'paused';
		case 'DROPPED': return 'dropped';
		case 'PLANNING': return 'planned';
		case 'REPEATING': return 'in_progress';
		default: return 'planned';
	}
}

export async function importFromAnilist(username: string): Promise<{ success: number; failed: number }> {
	let success = 0;
	let failed = 0;

	const types = ['ANIME', 'MANGA'];

	for (const type of types) {
		try {
			const query = `
				query ($userName: String, $type: MediaType) {
				  MediaListCollection(userName: $userName, type: $type) {
				    lists {
				      entries {
				        status
				        score
				        progress
				        media {
				          id
				        }
				      }
				    }
				  }
				}
			`;

			const res = await fetch('https://graphql.anilist.co', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
				body: JSON.stringify({ query, variables: { userName: username, type } })
			});

			if (!res.ok) throw new Error(`Anilist API error: ${res.status}`);
			const data = await res.json();

			const lists = data.data?.MediaListCollection?.lists || [];
			
			for (const list of lists) {
				for (const entry of list.entries || []) {
					try {
						const anilistId = entry.media?.id;
						if (!anilistId) { failed++; continue; }

						const details = await getAnilistDetails(anilistId);
						if (!details) { failed++; continue; }

						const mediaId = crypto.randomUUID();
						
						await upsertMedia({
							id: mediaId,
							source: details.source,
							externalId: details.externalId,
							type: details.type,
							title: details.title,
							year: details.year,
							posterUrl: details.posterUrl,
							description: details.description,
							totalEpisodes: details.totalEpisodes,
							totalSeasons: details.totalSeasons,
							totalPages: details.totalPages,
						});

						await upsertTracking({
							mediaId: mediaId,
							status: mapAnilistStatus(entry.status),
							score: entry.score > 0 ? entry.score : undefined,
							currentEpisode: type === 'ANIME' ? entry.progress : undefined,
							currentChapter: type === 'MANGA' ? entry.progress : undefined,
						});

						success++;
						// Small delay to avoid rate limits
						await new Promise(r => setTimeout(r, 100));
					} catch (err) {
						console.error('Failed to import anilist entry', err);
						failed++;
					}
				}
			}
		} catch (err) {
			console.error(`Failed to fetch Anilist ${type} list`, err);
		}
	}

	if (success > 0) {
		await logActivity({
			mediaId: 'system',
			mediaType: 'anime', // dummy
			mediaTitle: 'System',
			eventType: 'anilist_import',
			payload: { count: success },
		});
	}

	return { success, failed };
}

export async function importFromTmdb(apiKey: string, sessionId: string): Promise<{ success: number; failed: number }> {
	let success = 0;
	let failed = 0;
	const BASE_URL = 'https://api.themoviedb.org/3';

	try {
		const accountData = await fetchJson<{ id: number }>(`${BASE_URL}/account?api_key=${apiKey}&session_id=${sessionId}`);
		const accountId = accountData.id;

		const endpoints = [
			{ url: `/account/${accountId}/watchlist/movies`, type: 'film' as const, status: 'planned' as const },
			{ url: `/account/${accountId}/watchlist/tv`, type: 'tv' as const, status: 'planned' as const },
			{ url: `/account/${accountId}/rated/movies`, type: 'film' as const, status: 'completed' as const },
			{ url: `/account/${accountId}/rated/tv`, type: 'tv' as const, status: 'completed' as const },
		];

		for (const ep of endpoints) {
			let page = 1;
			let totalPages = 1;

			while (page <= totalPages) {
				const data = await fetchJson<{ page: number; total_pages: number; results: any[] }>(
					`${BASE_URL}${ep.url}?api_key=${apiKey}&session_id=${sessionId}&page=${page}`
				);
				totalPages = data.total_pages;

				for (const item of data.results) {
					try {
						const details = await getTmdbDetails(item.id.toString(), ep.type);
						if (!details) { failed++; continue; }

						const mediaId = crypto.randomUUID();

						await upsertMedia({
							id: mediaId,
							source: details.source,
							externalId: details.externalId,
							type: details.type,
							title: details.title,
							year: details.year,
							posterUrl: details.posterUrl,
							description: details.description,
							totalEpisodes: details.totalEpisodes,
							totalSeasons: details.totalSeasons,
						});

						const score = item.rating ? (item.rating / 2) : undefined; // TMDB uses 1-10, we use 1-10? Wait, Traxy schema says score is 1-10. So item.rating is 1-10. Let's use item.rating directly.

						await upsertTracking({
							mediaId: mediaId,
							status: ep.status,
							score: item.rating ? item.rating : undefined,
						});

						success++;
						// Delay to respect TMDB 40 req/s limit
						await new Promise(r => setTimeout(r, 50));
					} catch (err) {
						console.error('Failed to import TMDB entry', err);
						failed++;
					}
				}
				page++;
			}
		}

		if (success > 0) {
			await logActivity({
				mediaId: 'system',
				mediaType: 'film',
				mediaTitle: 'System',
				eventType: 'tmdb_import',
				payload: { count: success },
			});
		}

	} catch (err) {
		console.error('Failed to import from TMDB', err);
	}

	return { success, failed };
}
