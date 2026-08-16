<script lang="ts">
	import type { HeatmapDay } from '$lib/types/statsTypes';

	interface Props {
		year: number;
		data: HeatmapDay[];
	}

	let { year, data }: Props = $props();

	// Generate a 53-week matrix of days for the given year
	const weeks = $derived.by(() => {
		const start = new Date(year, 0, 1);
		const end = new Date(year, 11, 31);
		
		const dataMap = new Map<string, number>();
		for (const d of data) {
			dataMap.set(d.date.split('T')[0], d.count);
		}

		let curr = new Date(start);
		// back up to Sunday
		while (curr.getDay() !== 0) {
			curr.setDate(curr.getDate() - 1);
		}

		const result: { date: string; count: number; inYear: boolean }[][] = [];
		let currentWeek: { date: string; count: number; inYear: boolean }[] = [];

		while (curr <= end || currentWeek.length > 0) {
			const ds = curr.toISOString().split('T')[0];
			currentWeek.push({
				date: ds,
				count: dataMap.get(ds) || 0,
				inYear: curr.getFullYear() === year
			});

			if (currentWeek.length === 7) {
				result.push(currentWeek);
				currentWeek = [];
			}
			curr.setDate(curr.getDate() + 1);
		}
		return result;
	});

	function getColor(count: number): string {
		if (count === 0) return 'bg-[#181b2e] border border-white/[0.04]';
		if (count < 3) return 'bg-indigo-600/40 border border-indigo-500/30';
		if (count < 6) return 'bg-indigo-500/70 border border-indigo-400/40 shadow-sm shadow-indigo-500/20';
		return 'bg-indigo-400 border border-indigo-300/50 shadow-md shadow-indigo-400/40';
	}
</script>

<div class="bg-[#121422]/80 backdrop-blur-xl rounded-3xl border border-white/[0.08] p-6 sm:p-8 overflow-x-auto shadow-xl">
	<h3 class="text-base font-bold text-white mb-4 flex items-center gap-2">
		<span>📅</span> Activity in {year}
	</h3>
	
	<div class="flex gap-1 min-w-max">
		{#each weeks as week}
			<div class="flex flex-col gap-1">
				{#each week as day}
					<div 
						class="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-sm {getColor(day.count)} {day.inYear ? '' : 'opacity-10'}"
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
