<script lang="ts">
	import type { PageData } from './$types';
	import ActivityCard from '$lib/components/ActivityCard.svelte';
	import InfiniteScrollSentinel from '$lib/components/InfiniteScrollSentinel.svelte';
	import { getActivityFeed } from '$lib/db/services/activity.service';
	import type { ActivityItem } from '$lib/types/activityTypes';

	import { untrack } from 'svelte';

	let { data }: { data: PageData } = $props();

	let items = $state<ActivityItem[]>(untrack(() => data.activities));
	let isLoading = $state(false);
	let hasMore = $state(untrack(() => data.activities.length === 20));
	let offset = $state(20);

	$effect(() => {
		// Keep local state in sync if data changes (e.g. during client-side navigation)
		items = data.activities;
		hasMore = data.activities.length === 20;
		offset = 20;
	});

	async function loadMore() {
		if (isLoading || !hasMore) return;
		isLoading = true;
		try {
			const next = await getActivityFeed(20, offset);
			if (next.length > 0) {
				items = [...items, ...next];
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
</script>

<div class="space-y-6 max-w-4xl mx-auto">
	<div class="flex justify-between items-center">
		<div>
			<h1 class="text-3xl font-extrabold text-white tracking-tight">Activity Feed</h1>
			<p class="text-xs text-slate-400 mt-0.5">Recent updates from your tracked media.</p>
		</div>
		<a href="/search" class="p-2.5 bg-[#121422] hover:bg-[#181b2e] border border-white/[0.08] text-slate-300 hover:text-white rounded-xl transition-all shadow-sm cursor-pointer" aria-label="Search">
			<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
		</a>
	</div>

	{#if items.length === 0}
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
	{:else}
		<div class="flex flex-col gap-3.5">
			{#each items as item (item.id)}
				<ActivityCard activity={item} />
			{/each}

			<InfiniteScrollSentinel onLoadMore={loadMore} loading={isLoading} {hasMore} />
		</div>
	{/if}
</div>