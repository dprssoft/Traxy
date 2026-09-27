<script lang="ts">
	import type { HeatmapDay } from '$lib/types/statsTypes';

	interface Props {
		year: number;
		data: HeatmapDay[];
	}

	let { year, data }: Props = $props();

	const DAY_MS = 86_400_000;

	type Cell = { date: string; count: number; inYear: boolean };

	// Sunday-first weeks covering the year. Days are UTC dates, matching `date(occurredAt)` in
	// the heatmap query — local-midnight Dates would shift every cell a day in UTC+ zones.
	const weeks = $derived.by(() => {
		const counts: Record<string, number> = Object.fromEntries(
			data.map((d) => [d.date.split('T')[0], d.count]),
		);
		const jan1 = Date.UTC(year, 0, 1);
		const firstSunday = jan1 - new Date(jan1).getUTCDay() * DAY_MS;
		const dec31 = Date.UTC(year, 11, 31);

		const result: Cell[][] = [];
		for (let weekStart = firstSunday; weekStart <= dec31; weekStart += 7 * DAY_MS) {
			const week: Cell[] = [];
			for (let i = 0; i < 7; i++) {
				const day = new Date(weekStart + i * DAY_MS);
				const date = day.toISOString().slice(0, 10);
				week.push({ date, count: counts[date] ?? 0, inYear: day.getUTCFullYear() === year });
			}
			result.push(week);
		}
		return result;
	});

	function getColor(count: number): string {
		if (count === 0) return 'bg-[#181b2e] border border-white/[0.04]';
		if (count < 3) return 'bg-indigo-600/40 border border-indigo-500/30';
		if (count < 6)
			return 'bg-indigo-500/70 border border-indigo-400/40 shadow-sm shadow-indigo-500/20';
		return 'bg-indigo-400 border border-indigo-300/50 shadow-md shadow-indigo-400/40';
	}
</script>

<div
	class="bg-[#121422]/80 backdrop-blur-xl rounded-3xl border border-white/[0.08] p-6 sm:p-8 overflow-x-auto shadow-xl"
>
	<h3 class="text-base font-bold text-white mb-4 flex items-center gap-2">
		<span>📅</span> Activity in {year}
	</h3>

	<div class="flex gap-1 min-w-max">
		{#each weeks as week (week[0].date)}
			<div class="flex flex-col gap-1">
				{#each week as day (day.date)}
					<div
						class="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-sm {getColor(day.count)} {day.inYear
							? ''
							: 'opacity-10'}"
						title="{day.date}: {day.count} actions"
					></div>
				{/each}
			</div>
		{/each}
	</div>

	<div class="flex items-center gap-2 mt-5 text-xs text-slate-400">
		<span>Less</span>
		<div class="w-3 h-3 rounded-sm bg-[#181b2e] border border-white/[0.04]"></div>
		<div class="w-3 h-3 rounded-sm bg-indigo-600/40"></div>
		<div class="w-3 h-3 rounded-sm bg-indigo-500/70"></div>
		<div class="w-3 h-3 rounded-sm bg-indigo-400"></div>
		<span>More</span>
	</div>
</div>
