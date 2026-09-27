<script lang="ts">
	import type { SearchResult } from '$lib/types/mediaTypes';
	import CataloguePosterCard from './CataloguePosterCard.svelte';
	import Shimmer from '$lib/components/ui/Shimmer.svelte';
	import { onEnterView } from '$lib/utils/onEnterView';

	interface Props {
		title: string;
		items: SearchResult[];
		loading: boolean;
		onItemClick: (item: SearchResult) => void;
		/** Enables the ✎ quick-edit button on each poster. */
		onItemEdit?: (item: SearchResult) => void | Promise<void>;
		emptyMessage?: string;
		error?: boolean;
	}

	let {
		title,
		items,
		loading,
		onItemClick,
		onItemEdit,
		emptyMessage = 'No results available',
		error = false,
	}: Props = $props();

	let scrollEl = $state<HTMLElement | null>(null);

	// Cap mounted cards instead of rendering the full (up to ~120-item, for "All types")
	// result list at once — a "load more on scroll" batch reveal, same IntersectionObserver
	// idiom InfiniteScrollSentinel already uses for the main feed's vertical infinite scroll,
	// just axis-flipped for this row's horizontal scroll.
	const BATCH_SIZE = 24;
	let visibleCount = $state(BATCH_SIZE);

	// New category data (refresh, type switch, etc.) replaces `items` wholesale — reset the
	// reveal window rather than keeping a stale count from the previous array.
	$effect(() => {
		const _ = items; // establishes the reactive dependency this effect resets on
		visibleCount = BATCH_SIZE;
	});

	const visibleItems = $derived(items.slice(0, visibleCount));

	function revealMore() {
		if (visibleCount < items.length) {
			visibleCount = Math.min(visibleCount + BATCH_SIZE, items.length);
		}
	}

	function scrollLeft() {
		scrollEl?.scrollBy({ left: -320, behavior: 'smooth' });
	}

	function scrollRight() {
		scrollEl?.scrollBy({ left: 320, behavior: 'smooth' });
	}
</script>

<section class="space-y-2.5">
	<!-- Header -->
	<div class="flex items-center justify-between px-1">
		<h3 class="text-sm sm:text-base font-bold text-white tracking-tight">{title}</h3>

		<!-- Scroll arrows (desktop only) -->
		{#if items.length > 3}
			<div class="hidden sm:flex items-center gap-1.5">
				<button
					type="button"
					onclick={scrollLeft}
					class="w-7 h-7 rounded-xl bg-[#181b2e] hover:bg-[#20243d] border border-white/[0.08] flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer"
					aria-label="Scroll left"
				>
					<svg
						class="w-3.5 h-3.5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
					</svg>
				</button>
				<button
					type="button"
					onclick={scrollRight}
					class="w-7 h-7 rounded-xl bg-[#181b2e] hover:bg-[#20243d] border border-white/[0.08] flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer"
					aria-label="Scroll right"
				>
					<svg
						class="w-3.5 h-3.5"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
					</svg>
				</button>
			</div>
		{/if}
	</div>

	<!-- Scrollable row -->
	{#if loading}
		<div class="flex gap-2.5 sm:gap-3 overflow-hidden px-1">
			{#each Array(6) as _, i (i)}
				<div class="flex-shrink-0 w-[105px] xs:w-[120px] sm:w-[145px] md:w-[160px]">
					<Shimmer class="aspect-[2/3] !rounded-2xl" />
				</div>
			{/each}
		</div>
	{:else if items.length === 0}
		{#if error}
			<div
				class="px-4 py-8 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center mx-1"
			>
				<p class="text-xs text-amber-500/80">
					⚠️ Couldn't reach the server. Pull down or click refresh to try again.
				</p>
			</div>
		{:else}
			<div
				class="px-4 py-8 rounded-2xl bg-[#121422]/60 border border-white/[0.06] text-center mx-1"
			>
				<p class="text-xs text-slate-500">{emptyMessage}</p>
			</div>
		{/if}
	{:else}
		<div
			bind:this={scrollEl}
			class="flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 px-1 scrollbar-hide"
		>
			{#each visibleItems as item (item.externalId + item.source)}
				<div class="snap-start">
					<CataloguePosterCard
						{item}
						onclick={() => onItemClick(item)}
						onEdit={onItemEdit && (() => onItemEdit(item))}
					/>
				</div>
			{/each}
			{#if visibleCount < items.length}
				<div
					use:onEnterView={{ callback: revealMore, options: { rootMargin: '0px 400px 0px 0px' } }}
					class="w-px h-full flex-shrink-0"
				></div>
			{/if}
		</div>
	{/if}
</section>
