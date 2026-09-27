import { upsertMedia } from './media.service';
import { upsertTracking } from './tracking.service';
import { logActivity } from './activity.service';
import { getAnilistDetails } from '../sources/anilist';
import { getTmdbDetails } from '../sources/tmdb';
import { fetchJson } from '../fetchUtils';

// MAL export status codes (my_status); 5 is unused.
function mapMalStatus(status: string): import('$lib/db/schema').TrackingStatusType {
	switch (status) {
		case '1':
			return 'in_progress';
		case '2':
			return 'completed';
		case '3':
			return 'paused';
		case '4':
			return 'dropped';
		case '6':
			return 'planned';
		default:
			return 'planned';
	}
}

/**
 * Import a MyAnimeList XML export. Entries are stored as `manual` stubs (title only, keyed
 * `mal-<id>`) rather than fetched from a provider, so large lists import without API calls.
 */
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

			const mediaId = crypto.randomUUID();

			const media = await upsertMedia({
				id: mediaId,
				source: 'manual',
				externalId: `mal-${malId}`,
				type: 'anime',
				title: title || 'Unknown Anime',
			});

			await upsertTracking({
				mediaId: media.id,
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
		case 'CURRENT':
			return 'in_progress';
		case 'COMPLETED':
			return 'completed';
		case 'PAUSED':
			return 'paused';
		case 'DROPPED':
			return 'dropped';
		case 'PLANNING':
			return 'planned';
		case 'REPEATING':
			return 'in_progress';
		default:
			return 'planned';
	}
}

/** Import a public AniList user's anime and manga lists, fetching full details for each entry. */
export async function importFromAnilist(
	username: string,
): Promise<{ success: number; failed: number }> {
	let success = 0;
	let failed = 0;

	const types = ['ANIME', 'MANGA'];

	for (const type of types) {
		try {
			// Without a format, AniList returns the score in the user's own scale (up to 100 points).
			const query = `
				query ($userName: String, $type: MediaType) {
				  MediaListCollection(userName: $userName, type: $type) {
				    lists {
				      entries {
				        status
				        score(format: POINT_10)
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
				headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
				body: JSON.stringify({ query, variables: { userName: username, type } }),
			});

			if (!res.ok) throw new Error(`Anilist API error: ${res.status}`);
			const data = await res.json();

			const lists = data.data?.MediaListCollection?.lists || [];

			for (const list of lists) {
				for (const entry of list.entries || []) {
					try {
						const anilistId = entry.media?.id;
						if (!anilistId) {
							failed++;
							continue;
						}

						const details = await getAnilistDetails(anilistId);
						if (!details) {
							failed++;
							continue;
						}

						const media = await upsertMedia(details);

						await upsertTracking({
							mediaId: media.id,
							status: mapAnilistStatus(entry.status),
							score: entry.score > 0 ? entry.score : undefined,
							currentEpisode: type === 'ANIME' ? entry.progress : undefined,
							currentChapter: type === 'MANGA' ? entry.progress : undefined,
						});

						success++;
						// Small delay to avoid rate limits
						await new Promise((r) => setTimeout(r, 100));
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

/**
 * Import a TMDB account's watchlists (as planned) and rated titles (as completed, with the
 * rating as score). Needs a session id from `tmdbAuth`.
 */
export async function importFromTmdb(
	apiKey: string,
	sessionId: string,
): Promise<{ success: number; failed: number }> {
	let success = 0;
	let failed = 0;
	const BASE_URL = 'https://api.themoviedb.org/3';

	try {
		const accountData = await fetchJson<{ id: number }>(
			`${BASE_URL}/account?api_key=${apiKey}&session_id=${sessionId}`,
		);
		const accountId = accountData.id;

		const endpoints = [
			{
				url: `/account/${accountId}/watchlist/movies`,
				type: 'film' as const,
				status: 'planned' as const,
			},
			{
				url: `/account/${accountId}/watchlist/tv`,
				type: 'tv' as const,
				status: 'planned' as const,
			},
			{
				url: `/account/${accountId}/rated/movies`,
				type: 'film' as const,
				status: 'completed' as const,
			},
			{ url: `/account/${accountId}/rated/tv`, type: 'tv' as const, status: 'completed' as const },
		];

		for (const ep of endpoints) {
			let page = 1;
			let totalPages = 1;

			while (page <= totalPages) {
				const data = await fetchJson<{
					page: number;
					total_pages: number;
					results: { id: number; rating?: number }[];
				}>(`${BASE_URL}${ep.url}?api_key=${apiKey}&session_id=${sessionId}&page=${page}`);
				totalPages = data.total_pages;

				for (const item of data.results) {
					try {
						const details = await getTmdbDetails(item.id.toString(), ep.type);
						if (!details) {
							failed++;
							continue;
						}

						const media = await upsertMedia(details);

						await upsertTracking({
							mediaId: media.id,
							status: ep.status,
							score: item.rating ? item.rating : undefined,
						});

						success++;
						// Delay to respect TMDB 40 req/s limit
						await new Promise((r) => setTimeout(r, 50));
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
