import { getDb } from './index';

const CACHE_MAX_AGE_DAYS = 7;

/**
 * Retrieves a cached API response if it exists and is not older than CACHE_MAX_AGE_DAYS.
 * Returns null on cache miss or expiry.
 */
export async function getCached<T>(cacheKey: string): Promise<T | null> {
	try {
		const db = getDb();
		const cutoff = new Date(Date.now() - CACHE_MAX_AGE_DAYS * 86_400_000).toISOString();
		const result = await db.query(
			'SELECT data FROM ApiCache WHERE cacheKey = ? AND cachedAt > ?',
			[cacheKey, cutoff],
		);
		if (result.values && result.values.length > 0) {
			return JSON.parse(result.values[0][0] as string) as T;
		}
	} catch {
		// Cache miss is never fatal
	}
	return null;
}

/**
 * Batch-reads multiple cache keys in a single SQL query.
 * Returns a Map of cacheKey → parsed value for all keys that had a fresh cache hit.
 * Keys with no valid cache entry are absent from the map.
 */
export async function getCachedBatch<T>(cacheKeys: string[]): Promise<Map<string, T>> {
	const result = new Map<string, T>();
	if (cacheKeys.length === 0) return result;
	try {
		const db = getDb();
		const cutoff = new Date(Date.now() - CACHE_MAX_AGE_DAYS * 86_400_000).toISOString();
		const placeholders = cacheKeys.map(() => '?').join(', ');
		const queryResult = await db.query(
			`SELECT cacheKey, data FROM ApiCache WHERE cacheKey IN (${placeholders}) AND cachedAt > ?`,
			[...cacheKeys, cutoff],
		);
		if (queryResult.values) {
			for (const row of queryResult.values) {
				const key = row[0] as string;
				const data = row[1] as string;
				try {
					result.set(key, JSON.parse(data) as T);
				} catch {
					// Skip malformed rows
				}
			}
		}
	} catch {
		// Batch cache miss is never fatal — callers will fetch individually
	}
	return result;
}

/**
 * Stores an API response in the local cache.
 * Uses INSERT OR REPLACE so stale entries are automatically overwritten.
 */
export async function setCache(cacheKey: string, data: unknown): Promise<void> {
	try {
		const db = getDb();
		await db.run(
			'INSERT OR REPLACE INTO ApiCache (cacheKey, data, cachedAt) VALUES (?, ?, ?)',
			[cacheKey, JSON.stringify(data), new Date().toISOString()],
		);
	} catch {
		// Caching failures are non-fatal
	}
}