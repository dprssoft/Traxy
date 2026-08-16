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
		if (count === 0) return 'bg-gray-800';
		if (count < 3) return 'bg-brand-accent/30';
		if (count < 6) return 'bg-brand-accent/60';
		return 'bg-brand-accent';
	}
</script>

<div class="bg-gray-800/50 rounded-xl border border-gray-700 p-6 overflow-x-auto">
	<h3 class="text-white font-bold mb-4">Activity in {year}</h3>
	
	<div class="flex gap-1 min-w-max">
		{#each weeks as week}
			<div class="flex flex-col gap-1">
				{#each week as day}
					<div 
						class="w-3 h-3 sm:w-4 sm:h-4 rounded-sm {getColor(day.count)} {day.inYear ? '' : 'opacity-20'}"
						title="{day.date}: {day.count} actions"
					></div>
				{/each}
			</div>
		{/each}
	</div>
	
	<div class="flex items-center gap-2 mt-4 text-xs text-gray-400">
		<span>Less</span>
		<div class="w-3 h-3 sm:w-4 sm:h-4 rounded-sm bg-gray-800"></div>
		<div class="w-3 h-3 sm:w-4 sm:h-4 rounded-sm bg-brand-accent/30"></div>
		<div class="w-3 h-3 sm:w-4 sm:h-4 rounded-sm bg-brand-accent/60"></div>
		<div class="w-3 h-3 sm:w-4 sm:h-4 rounded-sm bg-brand-accent"></div>
		<span>More</span>
	</div>
</div>
