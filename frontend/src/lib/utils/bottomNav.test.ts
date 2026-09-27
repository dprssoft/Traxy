import { describe, it, expect } from 'vitest';
import { resolveBottomNavItems } from './bottomNav';
import type { NavItem } from '$lib/stores/layout';

// Fake paths keep the fixture short; the resolver only compares hrefs as strings.
const mk = (href: string): NavItem => ({
	href: href as NavItem['href'],
	label: href,
	icon: '',
	match: () => false,
});
const catalogue = ['/', '/a', '/b', '/c', '/d', '/e', '/f'].map(mk);
const defaults = catalogue.slice(0, 5);

describe('resolveBottomNavItems', () => {
	it('returns defaults when nothing saved', () => {
		expect(resolveBottomNavItems(null, catalogue, defaults)).toBe(defaults);
	});

	it('keeps the saved order', () => {
		const r = resolveBottomNavItems(['/c', '/a', '/'], catalogue, defaults);
		expect(r.map((i) => i.href)).toEqual(['/c', '/a', '/']);
	});

	it('drops unknown and duplicate ids', () => {
		const r = resolveBottomNavItems(['/a', '/a', '/nope', '/b', '/c'], catalogue, defaults);
		expect(r.map((i) => i.href)).toEqual(['/a', '/b', '/c']);
	});

	it('falls back to defaults below the minimum', () => {
		expect(resolveBottomNavItems(['/a', '/b'], catalogue, defaults)).toBe(defaults);
	});

	it('caps at the maximum', () => {
		const r = resolveBottomNavItems(['/', '/a', '/b', '/c', '/d', '/e'], catalogue, defaults);
		expect(r).toHaveLength(5);
	});
});
