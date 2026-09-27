import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
import { tick } from 'svelte';
import CatalogueRow from './CatalogueRow.svelte';
import type { SearchResult } from '$lib/types/mediaTypes';

// jsdom doesn't implement IntersectionObserver, and we want explicit control over when the
// "scrolled into view" callback fires anyway (rather than firing immediately on mount, which
// would cascade through every batch in one synchronous pass) — so capture the callback the
// component registers and invoke it manually per test step.
let capturedCallback: (() => void) | null = null;
vi.mock('$lib/utils/onEnterView', () => ({
	onEnterView: (_node: HTMLElement, param: (() => void) | { callback: () => void }) => {
		capturedCallback = typeof param === 'function' ? param : param.callback;
		return { destroy: () => {} };
	},
}));

function makeItems(count: number): SearchResult[] {
	return Array.from({ length: count }, (_, i) => ({
		source: 'tmdb',
		externalId: String(i),
		type: 'film',
		title: `Item ${i}`,
	}));
}

const posterCards = (container: HTMLElement) => container.querySelectorAll('[data-poster-card]');

describe('CatalogueRow batch reveal', () => {
	beforeEach(() => {
		capturedCallback = null;
	});

	it('mounts only the first batch of cards, not every item, for a large result set', () => {
		const { container } = render(CatalogueRow, {
			props: { title: 'All', items: makeItems(60), loading: false, onItemClick: () => {} },
		});

		expect(posterCards(container).length).toBe(24);
	});

	it('reveals the next batch each time the sentinel fires, and caps at the item count', async () => {
		const { container } = render(CatalogueRow, {
			props: { title: 'All', items: makeItems(60), loading: false, onItemClick: () => {} },
		});

		expect(posterCards(container).length).toBe(24);
		expect(capturedCallback).not.toBeNull();

		capturedCallback!();
		await tick();
		expect(posterCards(container).length).toBe(48);

		capturedCallback!();
		await tick();
		expect(posterCards(container).length).toBe(60);

		// No more to reveal — a further trigger must not overshoot items.length.
		capturedCallback!();
		await tick();
		expect(posterCards(container).length).toBe(60);
	});

	it('does not cap single-provider-sized rows (under one batch) at all', () => {
		const { container } = render(CatalogueRow, {
			props: { title: 'Films', items: makeItems(20), loading: false, onItemClick: () => {} },
		});

		expect(posterCards(container).length).toBe(20);
	});

	it('resets the reveal window when a new items array arrives', async () => {
		const { container, rerender } = render(CatalogueRow, {
			props: { title: 'All', items: makeItems(60), loading: false, onItemClick: () => {} },
		});

		capturedCallback!();
		await tick();
		expect(posterCards(container).length).toBe(48);

		await rerender({ title: 'All', items: makeItems(60), loading: false, onItemClick: () => {} });

		expect(posterCards(container).length).toBe(24);
	});
});
