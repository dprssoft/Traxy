const DEFAULT_OPTIONS: IntersectionObserverInit = { rootMargin: '300px 0px 600px 0px' };

type OnEnterViewParam = (() => void) | { callback: () => void; options?: IntersectionObserverInit };

/**
 * Svelte action: fire callback when the element scrolls into view.
 * `use:onEnterView={callback}` — default rootMargin pre-loads ~600px below viewport, tuned
 * for vertical infinite scroll. Svelte actions only take one bound parameter, so to override
 * the margin (e.g. a horizontal lookahead for a horizontally scrolling row) pass an object
 * instead: `use:onEnterView={{ callback, options: { rootMargin: '0px 400px 0px 0px' } }}`.
 */
export function onEnterView(node: HTMLElement, param: OnEnterViewParam) {
	const callback = typeof param === 'function' ? param : param.callback;
	const options = (typeof param === 'object' && param.options) || DEFAULT_OPTIONS;

	const observer = new IntersectionObserver((entries) => {
		if (entries[0].isIntersecting) callback();
	}, options);
	observer.observe(node);
	return { destroy: () => observer.disconnect() };
}
