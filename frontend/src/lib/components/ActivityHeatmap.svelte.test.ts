import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import ActivityHeatmap from './ActivityHeatmap.svelte';

describe('ActivityHeatmap', () => {
	// Tests run in Europe/Kyiv (see vite.config.ts), where local midnight is the previous UTC day.
	it('puts each count on its own date in a UTC+ time zone', () => {
		const { container } = render(ActivityHeatmap, {
			props: { year: 2026, data: [{ date: '2026-03-05', count: 7 }] },
		});

		expect(container.querySelector('[title="2026-03-05: 7 actions"]')).not.toBeNull();
		expect(container.querySelector('[title="2026-03-04: 7 actions"]')).toBeNull();
	});

	it('starts on a Sunday and covers the whole year', () => {
		const { container } = render(ActivityHeatmap, { props: { year: 2026, data: [] } });
		const titles = [...container.querySelectorAll('[title]')].map((el) => el.getAttribute('title'));

		expect(titles[0]).toBe('2025-12-28: 0 actions'); // Jan 1 2026 is a Thursday
		expect(titles).toContain('2026-12-31: 0 actions');
		expect(titles.length % 7).toBe(0);
	});
});
