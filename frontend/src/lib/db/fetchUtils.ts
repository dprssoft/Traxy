import { getCached, setCache } from './apiCache';

/**
 * Fetches a URL and returns the parsed JSON response.
 * Automatically aborts after `timeoutMs` milliseconds.
 * Throws on non-2xx status or network/timeout error.
 */
export async function fetchJson<T>(
	url: string,
	timeoutMs = 5000,
	headers?: Record<string, string>,
): Promise<T> {
	const controller = new AbortController();
	const id = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const res = await fetch(url, { signal: controller.signal, headers });
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return res.json() as Promise<T>;
	} finally {
		clearTimeout(id);
	}
}

/**
 * Parses the year from a date string like "2021-05-12" or "2021".
 * Returns undefined for empty or invalid input.
 */
export function parseYear(dateStr?: string | null): number | undefined {
	if (!dateStr) return undefined;
	const y = parseInt(dateStr.split('-')[0]);
	return isNaN(y) ? undefined : y;
}

/**
 * Returns the cached value for `key` if fresh, otherwise calls `fetcher`,
 * stores the result, and returns it. Propagates errors from `fetcher`.
 */
export async function withCache<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
	const cached = await getCached<T>(key);
	if (cached !== null) return cached;
	const result = await fetcher();
	await setCache(key, result);
	return result;
}
