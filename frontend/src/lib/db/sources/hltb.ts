import { Capacitor } from '@capacitor/core';
import { getCached, setCache } from '../apiCache';

interface HLTBResult {
	main: number;
	extra: number;
	completionist: number;
}

interface HLTBToken {
	token: string;
	hpKey: string;
	hpVal: string;
}

const isNative = () =>
	typeof window !== 'undefined' && Capacitor.getPlatform() !== 'web';

function getHltbBaseUrl(): string {
	if (!isNative()) {
		// Web dev server — requests are proxied via Vite
		return '/api-proxy/hltb';
	}
	// Android / iOS — Capacitor bypasses CORS natively
	return 'https://howlongtobeat.com';
}

/**
 * Headers to spoof a browser on native (Capacitor allows setting these;
 * the Fetch API in a plain WebView silently drops them, but that's fine —
 * the Vite proxy injects them on the web side).
 */
function getNativeOnlyHeaders(): Record<string, string> {
	if (!isNative()) return {};
	return {
		'User-Agent':
			'Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
		'Referer': 'https://howlongtobeat.com/',
		'Origin': 'https://howlongtobeat.com',
	};
}

/**
 * Fetches a fresh auth token from HLTB's init endpoint.
 * HLTB now requires x-auth-token, x-hp-key, and x-hp-val on every search.
 */
async function fetchHltbToken(): Promise<HLTBToken | null> {
	try {
		const base = getHltbBaseUrl();
		const res = await fetch(`${base}/api/search/site/init?t=${Date.now()}`, {
			method: 'GET',
			// No Content-Type — GET has no body
			headers: { ...getNativeOnlyHeaders() },
		});
		if (!res.ok) {
			console.warn('HLTB token fetch failed:', res.status);
			return null;
		}
		const data = (await res.json()) as { token?: string; hpKey?: string; hpVal?: string };
		if (!data?.token) return null;
		return { token: data.token, hpKey: data.hpKey ?? '', hpVal: data.hpVal ?? '' };
	} catch (e) {
		console.warn('HLTB token fetch error:', e);
		return null;
	}
}

export async function searchHltb(gameName: string): Promise<HLTBResult | null> {
	if (!gameName || !gameName.trim()) return null;

	const cacheKey = `hltb:${gameName.toLowerCase().trim()}`;

	try {
		// Return a previously-cached successful result; skip stale nulls
		const cached = await getCached<HLTBResult>(cacheKey);
		if (cached !== null && cached.main !== undefined) return cached;

		// Step 1: get fresh auth token
		const authToken = await fetchHltbToken();
		if (!authToken) {
			console.warn('HLTB: could not obtain auth token');
			return null;
		}

		const base = getHltbBaseUrl();
		const terms = gameName.split(' ').filter((t) => t.trim().length > 0);

		const payload = {
			searchType: 'games',
			searchTerms: terms,
			searchPage: 1,
			size: 5,
			searchOptions: {
				games: {
					userId: 0,
					platform: '',
					sortCategory: 'popular',
					rangeCategory: 'main',
					rangeTime: { min: null, max: null },
					gameplay: { perspective: '', flow: '', genre: '' },
					modifier: '',
				},
				users: { sortCategory: 'postcount' },
				filter: '',
				sort: 0,
				randomizer: 0,
			},
			useCache: true,
		};

		// Step 2: search with auth headers
		const res = await fetch(`${base}/api/search/site`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...getNativeOnlyHeaders(),
				'x-auth-token': authToken.token,
				'x-hp-key': authToken.hpKey,
				'x-hp-val': authToken.hpVal,
			},
			body: JSON.stringify(payload),
		});

		if (!res.ok) {
			console.warn('HLTB search failed with status:', res.status);
			return null;
		}

		const data = await res.json();
		if (!data?.data || data.data.length === 0) {
			return null;
		}

		// Find best match — exact title first, otherwise top result
		const targetName = gameName.toLowerCase().replace(/[^a-z0-9\s]/g, '');
		let bestMatch = data.data[0];

		for (const item of data.data) {
			const itemName = (item.game_name as string).toLowerCase().replace(/[^a-z0-9\s]/g, '');
			if (itemName === targetName) {
				bestMatch = item;
				break;
			}
		}

		// HLTB returns times in seconds; convert to hours (1 decimal)
		const toHours = (seconds: number) => {
			if (!seconds) return 0;
			return Math.round((seconds / 3600) * 10) / 10;
		};

		const result: HLTBResult = {
			main: toHours(bestMatch.comp_main as number),
			extra: toHours(bestMatch.comp_plus as number),
			completionist: toHours(bestMatch.comp_100 as number),
		};

		// Cache only real results — never cache null so future retries work
		await setCache(cacheKey, result);
		return result;
	} catch (e) {
		console.warn('HLTB fetch error:', e);
		return null;
	}
}
