<script lang="ts">
	import type { SearchResult } from '$lib/types/mediaTypes';
	import { MEDIA_TYPE_LABELS } from '$lib/constants';
	import { getTypeColor } from '$lib/stores/search.svelte';

	interface Props {
		item: SearchResult;
		onclick: () => void;
	}

	let { item, onclick }: Props = $props();
</script>

<button
	type="button"
	{onclick}
	class="group relative flex-shrink-0 w-[140px] sm:w-[160px] cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/40 rounded-2xl transition-all"
>
	<!-- Poster -->
	<div
		class="relative aspect-[2/3] rounded-2xl overflow-hidden bg-[#181b2e] border border-white/[0.08] shadow-lg group-hover:shadow-indigo-500/20 group-hover:border-indigo-500/30 transition-all duration-300 group-hover:scale-[1.04]"
	>
		{#if item.posterUrl}
			<img
				src={item.posterUrl}
				alt={item.title}
				class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
				loading="lazy"
			/>
		{:else}
			<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1a1d2e] to-[#121422]">
				<span class="text-3xl font-black text-slate-600">{item.title.substring(0, 2)}</span>
			</div>
		{/if}

		<!-- Bottom gradient overlay -->
		<div
			class="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none"
		></div>

		<!-- Media type badge -->
		<div class="absolute top-2 left-2">
			<span
				class="text-[9px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-md {getTypeColor(item.type)} border border-white/[0.1]"
			>
				{MEDIA_TYPE_LABELS[item.type] ?? item.type}
			</span>
		</div>

		<!-- Title + Year overlay at bottom -->
		<div class="absolute inset-x-0 bottom-0 p-2.5">
			<h3
				class="text-white text-xs font-bold leading-tight line-clamp-2 group-hover:text-indigo-300 transition-colors"
			>
				{item.title}
			</h3>
			{#if item.year}
				<span class="text-[10px] text-slate-400 font-medium mt-0.5 block">{item.year}</span>
			{/if}
		</div>

		<!-- Hover glow -->
		<div
			class="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/[0.06] group-hover:ring-indigo-500/30 transition-all pointer-events-none"
		></div>
	</div>
</button>
