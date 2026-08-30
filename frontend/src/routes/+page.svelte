<script lang="ts">
	import type { PageData } from './$types';
	import ActivityCard from '$lib/components/ActivityCard.svelte';
	import InfiniteScrollSentinel from '$lib/components/InfiniteScrollSentinel.svelte';
	import { getActivityFeed } from '$lib/db/services/activity.service';
	import type { ActivityItem, FeedItem, GroupedActivityItem } from '$lib/types/activityTypes';
	import { isGrouped } from '$lib/types/activityTypes';
	import { onMount, untrack } from 'svelte';


	let { data }: { data: PageData } = $props();

	// Filter state matching wireframe
	let filterOpen = $state(false);
	let filterUserActions = $state(true);
	let filterSystemMessages = $state(true);
	let filterMediaUpdates = $state(true);
	let filterContainerEl: HTMLElement | null = null;

	// Real database activities only
	let rawDbItems = $state<ActivityItem[]>(untrack(() => data.activities));
	let isLoading = $state(false);
	let hasMore = $state(untrack(() => data.activities.length === 20));
	let offset = $state(20);

	$effect(() => {
		rawDbItems = data.activities;
		hasMore = data.activities.length === 20;
		offset = 20;
	});

	/**
	 * Merge consecutive episode_watched / chapter_read events for the same media
	 * when the time gap between any two adjacent ones is <= MAX_GAP_MS and there
	 * are no other event types in between.
	 */
	const MAX_GAP_MS = 2 * 60 * 60 * 1000; // 2 hours

	function groupConsecutiveProgress(items: ActivityItem[]): FeedItem[] {
		const result: FeedItem[] = [];
		let i = 0;
		while (i < items.length) {
			const cur = items[i];
			const isProgress =
				cur.eventType === 'episode_watched' || cur.eventType === 'chapter_read';

			if (!isProgress) {
				result.push(cur);
				i++;
				continue;
			}

			// Collect run of same media + same eventType within time window
			const run: ActivityItem[] = [cur];
			let j = i + 1;
			while (j < items.length) {
				const next = items[j];
				if (
					next.eventType !== cur.eventType ||
					next.mediaId !== cur.mediaId
				) break;
				// Note: items are newest-first, so cur is MORE recent than next
				const gap = new Date(run[run.length - 1].occurredAt).getTime() -
					new Date(next.occurredAt).getTime();
				if (gap > MAX_GAP_MS) break;
				run.push(next);
				j++;
			}

			if (run.length === 1) {
				result.push(cur);
				i++;
				continue;
			}

			// Build grouped item from the run
			const nums = run.map((r) => {
				if (cur.eventType === 'episode_watched') return Number(r.payload?.episode ?? 0);
				return Number(r.payload?.chapter ?? 0);
			});

			// Verify this is a genuine forward-progress run:
			// Items are newest-first, so a real binge has strictly DECREASING numbers
			// in this array (ep8 newest → ep5 oldest). Decrements produce INCREASING
			// numbers (ep3 newest → ep5 oldest) and must NOT be grouped.
			const allValid = nums.every((n) => n > 0);
			const isForwardProgress = nums.every((n, idx) => idx === 0 || nums[idx - 1] > n);

			if (!allValid || !isForwardProgress) {
				// Can't determine range or it's a correction run — emit individually
				for (const r of run) result.push(r);
			} else {
				const minNum = nums[nums.length - 1]; // oldest = lowest episode
				const maxNum = nums[0];               // newest = highest episode

				// Season: only set if all episodes share the same season
				let season: number | undefined;
				if (cur.eventType === 'episode_watched') {
					const seasons = [...new Set(run.map((r) => r.payload?.season).filter(Boolean))];
					if (seasons.length === 1) season = seasons[0] as number;
				}

				let volume: number | undefined;
				if (cur.eventType === 'chapter_read') {
					const volumes = [...new Set(run.map((r) => r.payload?.volume).filter(Boolean))];
					if (volumes.length === 1) volume = volumes[0] as number;
				}

				const grouped: GroupedActivityItem = {
					isGroup: true,
					id: run.map((r) => r.id).join('-'),
					mediaId: cur.mediaId,
					mediaTitle: cur.mediaTitle,
					mediaPosterUrl: cur.mediaPosterUrl,
					mediaType: cur.mediaType,
					eventType: cur.eventType!,
					category: cur.category ?? 'user_action',
					from: minNum,
					to: maxNum,
					season,
					volume,
					count: run.length,
					occurredAt: run[0].occurredAt, // newest
				};
				result.push(grouped);
			}
			i = j;
		}
		return result;
	}

	// Items with category mapping
	const allItems = $derived(
		rawDbItems.map((item) => ({
			...item,
			category: item.category ?? 'user_action'
		}))
	);

	// Apply grouping then category filters
	const filteredItems = $derived(() => {
		const preFiltered = allItems.filter((item) => {
			const cat = item.category ?? 'user_action';
			if (cat === 'user_action' && !filterUserActions) return false;
			if (cat === 'system' && !filterSystemMessages) return false;
			if (cat === 'media_update' && !filterMediaUpdates) return false;
			return true;
		});
		return groupConsecutiveProgress(preFiltered);
	});


	async function loadMore() {
		if (isLoading || !hasMore) return;
		isLoading = true;
		try {
			const next = await getActivityFeed(20, offset);
			if (next.length > 0) {
				rawDbItems = [...rawDbItems, ...next];
				offset += next.length;
			}
			if (next.length < 20) {
				hasMore = false;
			}
		} catch (err) {
			console.error('Failed to load activity feed', err);
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		function handleClickOutside(e: PointerEvent | MouseEvent) {
			if (!filterOpen) return;
			const target = e.target as Node | null;
			if (filterContainerEl && !filterContainerEl.contains(target)) {
				filterOpen = false;
			}
		}

		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === 'Escape' && filterOpen) {
				filterOpen = false;
			}
		}

		document.addEventListener('pointerdown', handleClickOutside, true);
		document.addEventListener('keydown', handleKeyDown);

		return () => {
			document.removeEventListener('pointerdown', handleClickOutside, true);
			document.removeEventListener('keydown', handleKeyDown);
		};
	});
</script>

<svelte:head>
	<title>Activity Feed · Traxy</title>
</svelte:head>

<div class="space-y-4 sm:space-y-6 max-w-2xl mx-auto pb-6">
	<!-- Wireframe Top Header: "Activity Feed" Title on left + Funnel Filter on right -->
	<div class="flex justify-between items-center relative select-none">
		<div>
			<h1 class="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
				Activity Feed
			</h1>
		</div>

		<!-- Filter Funnel Button from wireframe -->
		<div class="relative" bind:this={filterContainerEl}>
			<button
				type="button"
				onclick={() => (filterOpen = !filterOpen)}
				class="p-2.5 rounded-2xl border transition-all duration-200 cursor-pointer flex items-center justify-center
					{filterOpen 
						? 'bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-500/25' 
						: 'bg-[#121424] text-slate-400 hover:text-white hover:bg-[#181c33] border-white/[0.08]'}"
				aria-label="Filter activity feed"
				title="Filter activities"
			>
				<!-- Funnel Icon from wireframe -->
				<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
				</svg>
			</button>

			<!-- Filter Popover Menu from Wireframe (User actions, System messages, Media updates) -->
			{#if filterOpen}
				<div 
					class="absolute right-0 top-12 w-56 p-4 bg-[#141727]/95 backdrop-blur-2xl border border-white/[0.12] rounded-2xl shadow-2xl z-40 space-y-3 animate-in fade-in zoom-in-95 duration-150"
				>
					<div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 pb-1 border-b border-white/[0.06]">
						Filter Activities
					</div>

					<label class="flex items-center gap-3 text-xs text-slate-200 hover:text-white font-medium cursor-pointer select-none">
						<input 
							type="checkbox" 
							bind:checked={filterUserActions} 
							class="w-4 h-4 rounded border-white/20 text-indigo-600 focus:ring-indigo-500/40 bg-[#0a0b12] cursor-pointer" 
						/>
						<span>User actions</span>
					</label>

					<label class="flex items-center gap-3 text-xs text-slate-200 hover:text-white font-medium cursor-pointer select-none">
						<input 
							type="checkbox" 
							bind:checked={filterSystemMessages} 
							class="w-4 h-4 rounded border-white/20 text-indigo-600 focus:ring-indigo-500/40 bg-[#0a0b12] cursor-pointer" 
						/>
						<span>System messages</span>
					</label>

					<label class="flex items-center gap-3 text-xs text-slate-200 hover:text-white font-medium cursor-pointer select-none">
						<input 
							type="checkbox" 
							bind:checked={filterMediaUpdates} 
							class="w-4 h-4 rounded border-white/20 text-indigo-600 focus:ring-indigo-500/40 bg-[#0a0b12] cursor-pointer" 
						/>
						<span>Media updates</span>
					</label>
				</div>
			{/if}
		</div>
	</div>

	<!-- Activity Cards List -->
	{#if rawDbItems.length === 0}
		<!-- Clean empty state when no activities exist yet in DB -->
		<div class="bg-[#121422]/70 backdrop-blur-xl rounded-3xl border border-white/[0.08] p-10 text-center shadow-xl space-y-4">
			<div class="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-tr from-indigo-600/30 to-purple-600/30 border border-indigo-500/30 flex items-center justify-center text-3xl shadow-lg shadow-indigo-500/20">
				🎬
			</div>
			<div>
				<h2 class="text-xl font-bold text-white mb-1">Welcome to Traxy!</h2>
				<p class="text-xs text-slate-400 max-w-sm mx-auto">
					Your activity feed is empty. Search for movies, TV series, anime, games, books, or comics to begin building your library.
				</p>
			</div>
			<a href="/search" class="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-indigo-500/25 transition-all cursor-pointer">
				<span>🔍</span> Search & Track Media
			</a>
		</div>
	{:else if filteredItems().length === 0}
		<!-- Empty state when all items are filtered out by checkboxes -->
		<div class="bg-[#121422]/70 backdrop-blur-xl rounded-3xl border border-white/[0.08] p-8 text-center shadow-xl space-y-3">
			<div class="w-12 h-12 mx-auto rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-xl text-slate-400">
				🔍
			</div>
			<h2 class="text-base font-bold text-white">No activities match your filter</h2>
			<p class="text-xs text-slate-400 max-w-xs mx-auto">
				Try enabling more filters in the top-right menu to view recent events.
			</p>
			<button
				type="button"
				onclick={() => {
					filterUserActions = true;
					filterSystemMessages = true;
					filterMediaUpdates = true;
				}}
				class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors"
			>
				Reset Filters
			</button>
		</div>
	{:else}
		<div class="flex flex-col gap-3">
			{#each filteredItems() as item (item.id)}
				<ActivityCard activity={item} />
			{/each}

			<InfiniteScrollSentinel onLoadMore={loadMore} loading={isLoading} {hasMore} />
		</div>
	{/if}
</div>