<script lang="ts">
	import type { MediaType } from '$lib/db/schema';
	import { MEDIA_TYPE_LABELS, getMediaTypeGroup } from '$lib/constants';

	interface Props {
		data: { type: MediaType | string; count: number }[];
	}

	let { data }: Props = $props();

	// Calculate percentages
	const total = $derived(data.reduce((acc, curr) => acc + curr.count, 0));
	
	const slices = $derived.by(() => {
		let currentAngle = 0;
		return data.map(item => {
			const percentage = total === 0 ? 0 : (item.count / total) * 100;
			const sliceAngle = (percentage / 100) * 360;
			
			const res = {
				...item,
				percentage,
				startAngle: currentAngle,
				endAngle: currentAngle + sliceAngle,
				color: getColorForType(item.type)
			};
			currentAngle += sliceAngle;
			return res;
		});
	});

	function getColorForType(type: string): string {
		const group = getMediaTypeGroup(type as MediaType);
		switch (group) {
			case 'watch': return type === 'anime' ? '#ec4899' : '#3b82f6'; // pink-500 for anime, blue-500 for film/tv
			case 'game': return '#22c55e'; // green-500
			case 'read': return '#eab308'; // yellow-500
			default: return '#6b7280'; // gray-500
		}
	}

	// SVG circle math
	function getCoordinatesForPercent(percent: number) {
		const x = Math.cos(2 * Math.PI * percent);
		const y = Math.sin(2 * Math.PI * percent);
		return [x, y];
	}
</script>

<div class="bg-[#121422]/80 backdrop-blur-xl rounded-3xl border border-white/[0.08] p-6 sm:p-8 flex flex-col items-center shadow-xl">
	<h3 class="text-base font-bold text-white mb-6 w-full text-left flex items-center gap-2">
		<span>📊</span> Media Distribution
	</h3>
	
	{#if total === 0}
		<div class="w-44 h-44 rounded-full bg-[#181b2e] border border-white/[0.06] flex items-center justify-center">
			<span class="text-slate-500 text-xs font-semibold">No data</span>
		</div>
	{:else}
		<div class="relative w-44 h-44 mb-6">
			<!-- Simple Conic Gradient Pie Chart as CSS -->
			<div 
				class="w-full h-full rounded-full shadow-lg"
				style="background: conic-gradient({slices.map(s => `${s.color} ${s.startAngle}deg ${s.endAngle}deg`).join(', ')});"
			></div>
			
			<!-- Center cutout for donut style -->
			<div class="absolute inset-0 m-auto w-28 h-28 bg-[#0a0b12] rounded-full flex flex-col items-center justify-center border border-white/[0.06] shadow-inner">
				<span class="text-2xl font-black text-white">{total}</span>
				<span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total</span>
			</div>
		</div>

		<div class="w-full grid grid-cols-2 gap-2 text-xs">
			{#each slices as slice}
				<div class="flex items-center justify-between p-2 rounded-xl bg-[#16192b]/50 border border-white/[0.04]">
					<div class="flex items-center gap-2 text-slate-300">
						<div class="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style="background-color: {slice.color};"></div>
						<span class="truncate font-medium">{MEDIA_TYPE_LABELS[slice.type as MediaType] ?? slice.type}</span>
					</div>
					<span class="font-bold text-white ml-2">{slice.count}</span>
				</div>
			{/each}
		</div>
	{/if}
</div>

