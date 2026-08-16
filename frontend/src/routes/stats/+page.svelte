<script lang="ts">
	import type { PageData } from './$types';
	import ActivityHeatmap from '$lib/components/ActivityHeatmap.svelte';
	import MediaPieChart from '$lib/components/MediaPieChart.svelte';
	import GoalProgress from '$lib/components/GoalProgress.svelte';

	let { data }: { data: PageData } = $props();

	// Calculate counts for pie chart based on current tracking list
	const typeCounts = $derived.by(() => {
		const counts: Record<string, number> = {};
		for (const item of data.trackingList) {
			const t = item.media.type;
			counts[t] = (counts[t] || 0) + 1;
		}
		return Object.entries(counts)
			.map(([type, count]) => ({ type, count }))
			.sort((a, b) => b.count - a.count);
	});

	// Quick stats
	const totalItems = $derived(data.trackingList.length);
	const completedItems = $derived(data.trackingList.filter(t => t.tracking.status === 'completed').length);
	
	const avgScore = $derived.by(() => {
		const scored = data.trackingList.filter(t => t.tracking.score && t.tracking.score > 0);
		if (scored.length === 0) return 0;
		const sum = scored.reduce((acc, curr) => acc + (curr.tracking.score || 0), 0);
		return (sum / scored.length).toFixed(1);
	});
</script>

<div class="max-w-5xl mx-auto py-8 px-4 space-y-8">
	<h1 class="text-3xl font-bold text-white mb-6">Statistics</h1>

	<!-- Quick Overview Cards -->
	<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
		<div class="bg-gray-800/50 rounded-xl border border-gray-700 p-6 flex items-center justify-between">
			<div>
				<p class="text-gray-400 text-sm mb-1">Total in list</p>
				<p class="text-3xl font-bold text-white">{totalItems}</p>
			</div>
			<div class="w-12 h-12 rounded-full bg-brand-accent/20 text-brand-accent flex items-center justify-center text-xl">
				📚
			</div>
		</div>

		<div class="bg-gray-800/50 rounded-xl border border-gray-700 p-6 flex items-center justify-between">
			<div>
				<p class="text-gray-400 text-sm mb-1">Completed</p>
				<p class="text-3xl font-bold text-white">{completedItems}</p>
			</div>
			<div class="w-12 h-12 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center text-xl">
				✅
			</div>
		</div>

		<div class="bg-gray-800/50 rounded-xl border border-gray-700 p-6 flex items-center justify-between">
			<div>
				<p class="text-gray-400 text-sm mb-1">Average score</p>
				<p class="text-3xl font-bold text-white">{avgScore} <span class="text-base font-normal text-gray-500">/ 10</span></p>
			</div>
			<div class="w-12 h-12 rounded-full bg-yellow-500/20 text-yellow-500 flex items-center justify-center text-xl">
				⭐
			</div>
		</div>
	</div>

	<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
		<div class="lg:col-span-2 space-y-6">
			<ActivityHeatmap year={data.year} data={data.heatmapDays} />
			<GoalProgress trackingList={data.trackingList} />
		</div>
		<div class="lg:col-span-1">
			<MediaPieChart data={typeCounts} />
		</div>
	</div>
</div>
