import { describe, it, expect } from 'vitest';
import { formatDate } from './format';

describe('formatDate', () => {
	it('formats an ISO date string in en-US locale (M/D/YYYY)', () => {
		// 1 Jan 2026 - en-US renders as "1/1/2026"
		expect(formatDate('2026-01-01T00:00:00Z')).toBe('1/1/2026');
	});

	it('formats a date-only ISO string', () => {
		expect(formatDate('2026-06-09')).toBe('6/9/2026');
	});

	it('returns "Invalid Date" for unparseable input (documents the contract)', () => {
		expect(formatDate('not a date')).toBe('Invalid Date');
	});
});
