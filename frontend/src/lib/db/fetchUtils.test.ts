import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchJson, parseYear, withCache } from './fetchUtils';

vi.mock('./apiCache', () => ({
	getCached: vi.fn(async () => null),
	setCache: vi.fn(async () => {}),
}));

describe('fetchJson', () => {
	beforeEach(() => {
		vi.stubGlobal('fetch', vi.fn());
	});

	it('sends the given method/body/headers via the init param', async () => {
		(fetch as any).mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });

		await fetchJson('https://example.com', 4000, { 'X-Foo': 'bar' }, {
			method: 'POST',
			body: 'payload',
		});

		expect(fetch).toHaveBeenCalledWith(
			'https://example.com',
			expect.objectContaining({
				method: 'POST',
				body: 'payload',
				headers: expect.objectContaining({ 'X-Foo': 'bar' }),
			}),
		);
	});

	it('defaults to a GET request when no init is given', async () => {
		(fetch as any).mockResolvedValue({ ok: true, json: async () => ({}) });

		await fetchJson('https://example.com');

		const callInit = (fetch as any).mock.calls[0][1];
		expect(callInit.method).toBeUndefined();
	});

	it('throws on a non-OK response', async () => {
		(fetch as any).mockResolvedValue({ ok: false, status: 500 });

		await expect(fetchJson('https://example.com')).rejects.toThrow('HTTP 500');
	});

	it('aborts and rejects once the timeout elapses', async () => {
		vi.useFakeTimers();
		(fetch as any).mockImplementation(
			(_url: string, init: { signal: AbortSignal }) =>
				new Promise((_resolve, reject) => {
					init.signal.addEventListener('abort', () => reject(new Error('aborted')));
				}),
		);

		const promise = fetchJson('https://example.com', 1000);
		const assertion = expect(promise).rejects.toThrow();
		await vi.advanceTimersByTimeAsync(1000);
		await assertion;
		vi.useRealTimers();
	});
});

describe('parseYear', () => {
	it('parses the year out of a full date string', () => {
		expect(parseYear('2021-05-12')).toBe(2021);
	});

	it('parses a bare year string', () => {
		expect(parseYear('2021')).toBe(2021);
	});

	it('returns undefined for empty/invalid input', () => {
		expect(parseYear(undefined)).toBeUndefined();
		expect(parseYear(null)).toBeUndefined();
		expect(parseYear('not-a-date')).toBeUndefined();
	});
});

describe('withCache', () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it('returns the cached value without calling the fetcher on a cache hit', async () => {
		const { getCached } = await import('./apiCache');
		(getCached as any).mockResolvedValueOnce(['cached']);
		const fetcher = vi.fn(async () => ['fresh']);

		const result = await withCache('key', fetcher);

		expect(result).toEqual(['cached']);
		expect(fetcher).not.toHaveBeenCalled();
	});

	it('calls the fetcher and caches the result on a cache miss', async () => {
		const { getCached, setCache } = await import('./apiCache');
		(getCached as any).mockResolvedValueOnce(null);
		const fetcher = vi.fn(async () => ['fresh']);

		const result = await withCache('key', fetcher);

		expect(result).toEqual(['fresh']);
		expect(setCache).toHaveBeenCalledWith('key', ['fresh']);
	});
});
