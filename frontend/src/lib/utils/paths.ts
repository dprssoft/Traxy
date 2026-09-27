import { resolve } from '$app/paths';
import type { Pathname, ResolvedPathname } from '$app/types';

/**
 * `resolve()` for a path held in a variable (nav items, settings tabs). Past ~25 routes TypeScript
 * gives up matching `resolve()`'s per-route signatures against a union like `Pathname`, so the
 * call is typed once here instead of at every call site.
 */
export function resolvePath(path: Pathname): ResolvedPathname {
	return (resolve as (route: string) => ResolvedPathname)(path);
}
