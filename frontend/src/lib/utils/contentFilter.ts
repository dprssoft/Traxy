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
