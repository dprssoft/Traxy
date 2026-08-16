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

<div class="bg-gray-800/50 rounded-xl border border-gray-700 p-6 flex flex-col items-center">
	<h3 class="text-white font-bold mb-6 w-full text-left">Media distribution</h3>
	
	{#if total === 0}
		<div class="w-48 h-48 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center">
			<span class="text-gray-500 text-sm">No data</span>
		</div>
	{:else}
		<div class="relative w-48 h-48 mb-6">
			<!-- Simple Conic Gradient Pie Chart as CSS -->
			<div 
				class="w-full h-full rounded-full"
				style="background: conic-gradient({slices.map(s => `${s.color} ${s.startAngle}deg ${s.endAngle}deg`).join(', ')});"
			></div>
			
			<!-- Center cutout for donut style -->
			<div class="absolute inset-0 m-auto w-32 h-32 bg-gray-900 rounded-full flex flex-col items-center justify-center">
				<span class="text-2xl font-bold text-white">{total}</span>
				<span class="text-xs text-gray-400">Total</span>
			</div>
		</div>

		<div class="w-full grid grid-cols-2 gap-2 text-sm">
			{#each slices as slice}
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2 text-gray-300">
						<div class="w-3 h-3 rounded-full" style="background-color: {slice.color};"></div>
						<span>{MEDIA_TYPE_LABELS[slice.type as MediaType] ?? slice.type}</span>
					</div>
					<span class="font-medium text-white">{slice.count}</span>
				</div>
			{/each}
		</div>
	{/if}
</div>
