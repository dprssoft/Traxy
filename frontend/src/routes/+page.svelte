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

<div class="max-w-3xl mx-auto py-8 px-4">
	<div class="flex justify-between items-center mb-6">
		<h1 class="text-3xl font-bold text-white">Activity feed</h1>
		<a href="/search" class="p-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-full transition-colors" aria-label="Search">
			<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
		</a>
	</div>

	{#if items.length === 0}
		<div class="bg-gray-800/50 rounded-xl border border-gray-700 p-8 text-center">
			<span class="text-4xl mb-4 block">👋</span>
			<h2 class="text-xl font-bold text-white mb-2">Welcome to Traxy!</h2>
			<p class="text-gray-400 mb-6">
				Your feed is empty. Start adding films, series, or games to your list.
			</p>
			<!-- Using href instead of interactive search bar for empty state to keep it simple -->
			<a href="/search" class="px-6 py-2 bg-brand-accent hover:bg-brand-accent/90 text-white rounded-lg font-medium transition-colors">
				Search
			</a>
		</div>
	{:else}
		<div class="flex flex-col gap-4">
			{#each items as item (item.id)}
				<ActivityCard activity={item} />
			{/each}

			<InfiniteScrollSentinel onLoadMore={loadMore} loading={isLoading} {hasMore} />
		</div>
	{/if}
</div>