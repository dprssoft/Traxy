/**
 * Adult-content keyword heuristics, for providers that expose no explicit adult flag
 * (ComicVine descriptions, Open Library subjects).
 */

const ADULT_KEYWORDS = [
	'erotica',
	'erotic',
	'eroticism',
	'hentai',
	'porn',
	'porno',
	'pornography',
	'pornographic',
	'smut',
	'nsfw',
	'xxx',
	'sexually explicit',
	'adults only',
	'adult only',
	'18\\+',
];

// Whole-word match: letters/digits may not touch the keyword, so "homoerotic" or
// "adultery" don't count.
const ADULT_KEYWORD_RE = new RegExp(
	`(?<![\\p{L}\\p{N}])(?:${ADULT_KEYWORDS.join('|')})(?![\\p{L}\\p{N}])`,
	'iu',
);

/** True if any of the given texts contains an adult-content keyword. */
export function hasAdultKeywords(...texts: (string | undefined | null)[]): boolean {
	return texts.some((t) => !!t && ADULT_KEYWORD_RE.test(t));
}

/** How adult content is treated: removed, shown blurred, or shown as-is. */
export type ContentFilterMode = 'hide' | 'blur' | 'show';

/** Drop adult items in 'hide' mode; 'blur' and 'show' keep the list intact. */
export function applyContentFilter<T extends { isAdult?: boolean }>(
	items: T[],
	mode: ContentFilterMode,
): T[] {
	return mode === 'hide' ? items.filter((i) => !i.isAdult) : items;
}

/** Whether an item's artwork should be blurred: adult content while the filter is on. */
export function shouldBlurAdult(item: { isAdult?: boolean }, mode: ContentFilterMode): boolean {
	return !!item.isAdult && mode !== 'show';
}
