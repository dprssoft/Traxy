<script lang="ts">
	import type { PageData } from './$types';
	import ActivityCard from '$lib/components/ActivityCard.svelte';
	import InfiniteScrollSentinel from '$lib/components/InfiniteScrollSentinel.svelte';
	import { getActivityFeed } from '$lib/db/services/activity.service';
	import type { ActivityItem } from '$lib/types/activityTypes';
	import { onMount, untrack } from 'svelte';

	let { data }: { data: PageData } = $props();

	// Filter state matching wireframe
	let filterOpen = $state(false);
	let filterUserActions = $state(true);
	let filterSystemMessages = $state(true);
	let filterMediaUpdates = $state(true);
	let filterContainerEl: HTMLElement | null = null;

	// Wireframe initial / companion feed data demonstrating all 3 categories
	const wireframeFeedItems: ActivityItem[] = [
		{
			id: 'wf-1',
			category: 'user_action',
			actionText: 'Action',
			subtitle: 'Title',
			mediaTitle: 'Title',
			icon: '🎬',
			occurredAt: new Date(Date.now() - 1000 * 60 * 8).toISOString()
		},
		{
			id: 'wf-2',
			category: 'user_action',
			actionText: 'Read chapter 24',
			subtitle: 'Chainsaw Man',
			mediaTitle: 'Chainsaw Man',
			icon: '📖',
			occurredAt: new Date(Date.now() - 1000 * 60 * 25).toISOString()
		},
		{
			id: 'wf-3',
			category: 'user_action',
			actionText: 'Read chapters 10-20',
			subtitle: 'Berserk Deluxe Edition 2',
			mediaTitle: 'Berserk',
			icon: '📖',
			occurredAt: new Date(Date.now() - 1000 * 60 * 65).toISOString()
		},
		{
			id: 'wf-4',
			category: 'user_action',
			actionText: 'Marked as "Completed"',
			subtitle: 'Cyberpunk 2077',
			mediaTitle: 'Cyberpunk 2077',
			icon: '🎮',
			occurredAt: new Date(Date.now() - 1000 * 60 * 180).toISOString()
		},
		{
			id: 'wf-5',
			category: 'user_action',
			actionText: 'Marked as "Dropped"',
			subtitle: 'The Idol (Season 1)',
			mediaTitle: 'The Idol',
			icon: '📺',
			occurredAt: new Date(Date.now() - 1000 * 60 * 320).toISOString()
		},
		{
			id: 'wf-6',
			category: 'user_action',
			actionText: 'Marked as "Planned"',
			subtitle: 'Dune: Part Two (Novel)',
			mediaTitle: 'Dune',
			icon: '📚',
			occurredAt: new Date(Date.now() - 1000 * 60 * 480).toISOString()
		},
		{
			id: 'wf-7',
			category: 'user_action',
			actionText: 'Created new mono list',
			subtitle: 'Top Sci-Fi Films, Movies',
			mediaTitle: 'Top Sci-Fi Films',
			href: '/collections',
			icon: '📑',
			occurredAt: new Date(Date.now() - 1000 * 60 * 720).toISOString()
		},
		{
			id: 'wf-8',
			category: 'user_action',
			actionText: 'Created new list',
			subtitle: 'Favorite Cozy Games',
			mediaTitle: 'Favorite Cozy Games',
			href: '/collections',
			icon: '📑',
			occurredAt: new Date(Date.now() - 1000 * 60 * 1440).toISOString()
		},
		{
			id: 'wf-9',
			category: 'user_action',
			actionText: 'Updated profile',
			subtitle: 'Changed pfp',
			mediaTitle: 'Profile',
			href: '/profile',
			icon: '👤',
			occurredAt: new Date(Date.now() - 1000 * 60 * 1800).toISOString()
		},
		{
			id: 'wf-10',
			category: 'system',
			actionText: 'Autosave completed',
			subtitle: 'Local SQLite database synchronized',
			mediaTitle: 'System Backup',
			icon: '💾',
			occurredAt: new Date(Date.now() - 1000 * 60 * 2880).toISOString()
		},
		{
			id: 'wf-11',
			category: 'media_update',
			actionText: 'New Arcane episode!',
			subtitle: 'Season 2 Episode 4 is now available',
			mediaTitle: 'Arcane',
			icon: '🔔',
			occurredAt: new Date(Date.now() - 1000 * 60 * 4320).toISOString()
		},
		{
			id: 'wf-12',
			category: 'media_update',
			actionText: 'Hunter x Hunter now on hiatus!',
			subtitle: 'Weekly Shonen Jump editorial notice',
			mediaTitle: 'Hunter x Hunter',
			icon: '📢',
			occurredAt: new Date(Date.now() - 1000 * 60 * 5760).toISOString()
		}
	];

	// Combine DB activities with wireframe activities (ensuring DB items default to user_action category)
	let rawDbItems = $state<ActivityItem[]>(untrack(() => data.activities));
	let isLoading = $state(false);
	let hasMore = $state(untrack(() => data.activities.length === 20));
	let offset = $state(20);

	$effect(() => {
		rawDbItems = data.activities;
		hasMore = data.activities.length === 20;
		offset = 20;
	});

	// Merged items list
	const allItems = $derived.by(() => {
		const mappedDbItems: ActivityItem[] = rawDbItems.map((item) => ({
			...item,
			category: item.category ?? 'user_action'
		}));

		if (mappedDbItems.length === 0) {
			return wireframeFeedItems;
		}

		// When DB items exist, prepend DB items and append wireframe items for system/media updates
		return [...mappedDbItems, ...wireframeFeedItems];
	});

	// Filtered list based on wireframe checkboxes
	const filteredItems = $derived.by(() => {
		return allItems.filter((item) => {
			const cat = item.category ?? 'user_action';
			if (cat === 'user_action' && !filterUserActions) return false;
			if (cat === 'system' && !filterSystemMessages) return false;
			if (cat === 'media_update' && !filterMediaUpdates) return false;
			return true;
		});
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

	<!-- Activity Cards List from Wireframe Image 2 -->
	{#if filteredItems.length === 0}
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
			{#each filteredItems as item (item.id)}
				<ActivityCard activity={item} />
			{/each}

			{#if rawDbItems.length > 0}
				<InfiniteScrollSentinel onLoadMore={loadMore} loading={isLoading} {hasMore} />
			{/if}
		</div>
	{/if}
</div>