import type { NavItem } from '$lib/stores/layout';

export const BOTTOM_NAV_MIN = 3;
export const BOTTOM_NAV_MAX = 5;

/**
 * Turn saved shortcut ids (nav hrefs) into nav items. Unknown and duplicate ids are
 * dropped; if fewer than BOTTOM_NAV_MIN remain, the defaults are used instead.
 */
export function resolveBottomNavItems(
	ids: string[] | null | undefined,
	catalogue: NavItem[],
	defaults: NavItem[],
): NavItem[] {
	if (!ids) return defaults;
	const seen = new Set<string>();
	const items: NavItem[] = [];
	for (const id of ids) {
		const item = catalogue.find((n) => n.href === id);
		if (item && !seen.has(id)) {
			seen.add(id);
			items.push(item);
		}
	}
	return items.length >= BOTTOM_NAV_MIN ? items.slice(0, BOTTOM_NAV_MAX) : defaults;
}
