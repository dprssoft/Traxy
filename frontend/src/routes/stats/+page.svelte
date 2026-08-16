<script lang="ts">
	import type { PageData } from './$types';
	import ActivityHeatmap from '$lib/components/ActivityHeatmap.svelte';
	import MediaPieChart from '$lib/components/MediaPieChart.svelte';

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

<div class="space-y-8">
	<div>
		<h1 class="text-3xl font-extrabold text-white tracking-tight">Statistics</h1>
		<p class="text-xs text-slate-400 mt-1">Overview of your activity and completed media.</p>
	</div>

	<!-- Quick Overview Cards -->
	<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
		<div class="bg-[#121422]/80 backdrop-blur-xl rounded-3xl border border-white/[0.08] p-6 flex items-center justify-between shadow-xl">
			<div>
				<p class="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Total in list</p>
				<p class="text-3xl font-extrabold text-white">{totalItems}</p>
			</div>
			<div class="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center text-xl shadow-inner">
				📚
			</div>
		</div>

		<div class="bg-[#121422]/80 backdrop-blur-xl rounded-3xl border border-white/[0.08] p-6 flex items-center justify-between shadow-xl">
			<div>
				<p class="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Completed</p>
				<p class="text-3xl font-extrabold text-emerald-400">{completedItems}</p>
			</div>
			<div class="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-xl shadow-inner">
				✅
			</div>
		</div>

		<div class="bg-[#121422]/80 backdrop-blur-xl rounded-3xl border border-white/[0.08] p-6 flex items-center justify-between shadow-xl">
			<div>
				<p class="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Average score</p>
				<p class="text-3xl font-extrabold text-amber-400">{avgScore} <span class="text-xs font-medium text-slate-500">/ 10</span></p>
			</div>
			<div class="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center text-xl shadow-inner">
				⭐
			</div>
		</div>
	</div>

	<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
		<div class="lg:col-span-2 space-y-6">
			<ActivityHeatmap year={data.year} data={data.heatmapDays} />
		</div>
		<div class="lg:col-span-1">
			<MediaPieChart data={typeCounts} />
		</div>
	</div>
</div>
