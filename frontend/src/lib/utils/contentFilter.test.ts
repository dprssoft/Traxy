import { describe, it, expect } from 'vitest';
import { hasAdultKeywords } from './contentFilter';

describe('hasAdultKeywords', () => {
	it.each([
		'An erotic thriller',
		'Fiction, erotica',
		'HENTAI collection',
		'Cartoon Porn',
		'Sexually explicit content',
		'For adults only',
		'Rated 18+ by the publisher',
	])('flags "%s"', (text) => {
		expect(hasAdultKeywords(text)).toBe(true);
	});

	it.each([
		'Batman: The Long Halloween',
		'Themes of adultery and betrayal',
		'A homoerotic subtext',
		'Popcorn and pornographers', // "pornographers" is not a listed keyword
		'Published in 2018',
	])('does not flag "%s"', (text) => {
		expect(hasAdultKeywords(text)).toBe(false);
	});

	it('checks every text and ignores missing ones', () => {
		expect(hasAdultKeywords(undefined, null, '', 'Romance', 'Erotica')).toBe(true);
		expect(hasAdultKeywords(undefined, null)).toBe(false);
	});
});
