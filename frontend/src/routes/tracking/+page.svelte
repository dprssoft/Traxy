<script lang="ts">
	import type { PageData } from './$types';
	import type { TrackingListItem } from '$lib/types/trackingTypes';
	import type { MediaType } from '$lib/db/schema';
	import { MEDIA_TYPE_LABELS } from '$lib/constants';
	import TrackingTab from '$lib/components/TrackingTab.svelte';
	import MalImport from '$lib/components/MalImport.svelte';

	let { data }: { data: PageData } = $props();

	// Add paused to standard tabs, watching is now in_progress
	const tabs = [
		{ id: 'in_progress', label: 'In Progress' },
		{ id: 'planned', label: 'Planned' },
		{ id: 'completed', label: 'Completed' },
		{ id: 'paused', label: 'Paused' },
		{ id: 'dropped', label: 'Dropped' },
	] as const;

	type StatusTab = typeof tabs[number]['id'];

	let activeTab = $state<StatusTab>('in_progress');
	let activeType = $state<MediaType | 'all'>('all');
	
	type SortOption = 'updatedDesc' | 'scoreDesc' | 'titleAsc';
	let currentSort = $state<SortOption>('updatedDesc');

	// All media types that exist in the user's list
	const availableTypes = $derived(
		Array.from(new Set(data.trackingList.map(t => t.media.type)))
	);

	const filteredList = $derived(
		data.trackingList
			.filter(item => item.tracking.status === activeTab)
			.filter(item => activeType === 'all' || item.media.type === activeType)
			.sort((a, b) => {
				if (currentSort === 'updatedDesc') {
					return new Date(b.tracking.updatedAt).getTime() - new Date(a.tracking.updatedAt).getTime();
				}
				if (currentSort === 'scoreDesc') {
					return (b.tracking.score || 0) - (a.tracking.score || 0);
				}
				if (currentSort === 'titleAsc') {
					return a.media.title.localeCompare(b.media.title);
				}
				return 0;
			})
	);
</script>

<div class="max-w-5xl mx-auto py-8 px-4">
	<div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
		<div class="flex items-center gap-4">
			<h1 class="text-3xl font-bold text-white">My List</h1>
			<MalImport />
		</div>
		
		<select 
			bind:value={currentSort}
			class="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg focus:ring-brand-accent focus:border-brand-accent block p-2.5"
		>
			<option value="updatedDesc">Recently updated</option>
			<option value="scoreDesc">Highest score</option>
			<option value="titleAsc">За назвою (А-Я)</option>
		</select>
	</div>

	<!-- Status Tabs -->
	<div class="flex overflow-x-auto border-b border-gray-700 mb-6 scrollbar-hide">
		{#each tabs as tab}
			<button
				class="px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors {activeTab === tab.id ? 'text-brand-accent border-b-2 border-brand-accent' : 'text-gray-400 hover:text-gray-300'}"
				onclick={() => activeTab = tab.id}
			>
				{tab.label}
				<span class="ml-1.5 text-xs px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-400">
					{data.trackingList.filter(t => t.tracking.status === tab.id).length}
				</span>
			</button>
		{/each}
	</div>

	<!-- Type Filters -->
	{#if availableTypes.length > 0}
		<div class="flex flex-wrap gap-2 mb-6">
			<button
				class="px-3 py-1.5 rounded-full text-xs font-medium transition-colors {activeType === 'all' ? 'bg-brand-accent text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}"
				onclick={() => activeType = 'all'}
			>
				All types
			</button>
			{#each availableTypes as type}
				<button
					class="px-3 py-1.5 rounded-full text-xs font-medium transition-colors {activeType === type ? 'bg-brand-accent text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}"
					onclick={() => activeType = type}
				>
					{MEDIA_TYPE_LABELS[type] ?? type}
				</button>
			{/each}
		</div>
	{/if}

	<!-- List Grid -->
	{#if filteredList.length === 0}
		<div class="py-12 text-center text-gray-500 bg-gray-800/20 rounded-xl border border-gray-800 border-dashed">
			Тут поки нічого немає.
		</div>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
			{#each filteredList as item (item.tracking.id)}
				<TrackingTab {item} />
			{/each}
		</div>
	{/if}
</div>