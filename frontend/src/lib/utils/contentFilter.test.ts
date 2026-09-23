import { describe, it, expect } from 'vitest';
import { applyContentFilter, hasAdultKeywords, shouldBlurAdult } from './contentFilter';

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

describe('applyContentFilter', () => {
	const items = [
		{ title: 'Safe', isAdult: false },
		{ title: 'Adult', isAdult: true },
		{ title: 'Unknown' },
	];

	it('drops adult items in hide mode and keeps unflagged ones', () => {
		expect(applyContentFilter(items, 'hide').map((i) => i.title)).toEqual(['Safe', 'Unknown']);
	});

	it.each(['blur', 'show'] as const)('keeps every item in %s mode', (mode) => {
		expect(applyContentFilter(items, mode)).toEqual(items);
	});
});

describe('shouldBlurAdult', () => {
	it('blurs adult items while the filter is on', () => {
		expect(shouldBlurAdult({ isAdult: true }, 'blur')).toBe(true);
		expect(shouldBlurAdult({ isAdult: true }, 'hide')).toBe(true);
	});

	it('never blurs with the filter off or for non-adult items', () => {
		expect(shouldBlurAdult({ isAdult: true }, 'show')).toBe(false);
		expect(shouldBlurAdult({ isAdult: false }, 'blur')).toBe(false);
		expect(shouldBlurAdult({}, 'hide')).toBe(false);
	});
});
