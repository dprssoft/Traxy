<script lang="ts">
	import type { SearchResult } from '$lib/types/mediaTypes';
	import CataloguePosterCard from './CataloguePosterCard.svelte';
	import Shimmer from '$lib/components/ui/Shimmer.svelte';

	interface Props {
		title: string;
		items: SearchResult[];
		loading: boolean;
		onItemClick: (item: SearchResult) => void;
		emptyMessage?: string;
	}

	let {
		title,
		items,
		loading,
		onItemClick,
		emptyMessage = 'No results available',
	}: Props = $props();

	let scrollEl: HTMLElement | null = null;

	function scrollLeft() {
		scrollEl?.scrollBy({ left: -320, behavior: 'smooth' });
	}

	function scrollRight() {
		scrollEl?.scrollBy({ left: 320, behavior: 'smooth' });
	}
</script>

<section class="space-y-3">
	<!-- Header -->
	<div class="flex items-center justify-between px-1">
		<h3 class="text-base sm:text-lg font-bold text-white tracking-tight">{title}</h3>

		<!-- Scroll arrows (desktop only) -->
		{#if items.length > 3}
			<div class="hidden sm:flex items-center gap-1.5">
				<button
					type="button"
					onclick={scrollLeft}
					class="w-8 h-8 rounded-xl bg-[#181b2e] hover:bg-[#20243d] border border-white/[0.08] flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer"
					aria-label="Scroll left"
				>
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
					</svg>
				</button>
				<button
					type="button"
					onclick={scrollRight}
					class="w-8 h-8 rounded-xl bg-[#181b2e] hover:bg-[#20243d] border border-white/[0.08] flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer"
					aria-label="Scroll right"
				>
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
					</svg>
				</button>
			</div>
		{/if}
	</div>

	<!-- Scrollable row -->
	{#if loading}
		<div class="flex gap-3 overflow-hidden px-1">
			{#each Array(6) as _}
				<div class="flex-shrink-0 w-[140px] sm:w-[160px]">
					<Shimmer class="aspect-[2/3] !rounded-2xl" />
				</div>
			{/each}
		</div>
	{:else if items.length === 0}
		<div
			class="px-4 py-8 rounded-2xl bg-[#121422]/60 border border-white/[0.06] text-center"
		>
			<p class="text-xs text-slate-500">{emptyMessage}</p>
		</div>
	{:else}
		<div
			bind:this={scrollEl}
			class="flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 px-1 scrollbar-hide"
		>
			{#each items as item (item.externalId + item.source)}
				<div class="snap-start">
					<CataloguePosterCard {item} onclick={() => onItemClick(item)} />
				</div>
			{/each}
		</div>
	{/if}
</section>
