<script lang="ts">
	import type { PageData } from './$types';
	import type { TrackingListItem } from '$lib/types/trackingTypes';
	import type { MediaType } from '$lib/db/schema';
	import { MEDIA_TYPE_LABELS } from '$lib/constants';
	import TrackingTab from '$lib/components/TrackingTab.svelte';
	import MalImport from '$lib/components/MalImport.svelte';

	let { data }: { data: PageData } = $props();

	const tabs = [
		{ id: 'in_progress', label: 'In Progress' },
		{ id: 'planned', label: 'Planned' },
		{ id: 'completed', label: 'Completed' },
		{ id: 'watched_letsplay', label: 'Let\'s Play' },
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

<div class="space-y-6">
	<div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
		<div class="flex items-center gap-4">
			<h1 class="text-3xl font-extrabold text-white tracking-tight">My List</h1>
			<MalImport />
		</div>
		
		<select 
			bind:value={currentSort}
			class="bg-[#121422] border border-white/[0.08] text-white text-xs font-semibold rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 block p-2.5 cursor-pointer shadow-inner"
		>
			<option value="updatedDesc">Recently updated</option>
			<option value="scoreDesc">Highest score</option>
			<option value="titleAsc">By title (A-Z)</option>
		</select>
	</div>

	<!-- Status Tabs -->
	<div class="flex overflow-x-auto gap-2 border-b border-white/[0.06] pb-3 scrollbar-hide">
		{#each tabs as tab}
			{@const active = activeTab === tab.id}
			<button
				class="flex items-center gap-2 px-4 py-2 text-xs font-bold whitespace-nowrap rounded-xl transition-all cursor-pointer {active ? 'text-white bg-indigo-600 shadow-md shadow-indigo-600/30' : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'}"
				onclick={() => activeTab = tab.id}
			>
				{tab.label}
				<span class="text-[10px] px-1.5 py-0.5 rounded-full {active ? 'bg-white/20 text-white' : 'bg-[#181b2e] text-slate-400'} font-bold">
					{data.trackingList.filter(t => t.tracking.status === tab.id).length}
				</span>
			</button>
		{/each}
	</div>

	<!-- Type Filters -->
	{#if availableTypes.length > 0}
		<div class="flex flex-wrap gap-1.5">
			<button
				class="px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer {activeType === 'all' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/40 shadow-sm shadow-indigo-500/10' : 'bg-[#121422] border border-white/[0.06] text-slate-400 hover:text-slate-200'}"
				onclick={() => activeType = 'all'}
			>
				All types
			</button>
			{#each availableTypes as type}
				<button
					class="px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer {activeType === type ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/40 shadow-sm shadow-indigo-500/10' : 'bg-[#121422] border border-white/[0.06] text-slate-400 hover:text-slate-200'}"
					onclick={() => activeType = type}
				>
					{MEDIA_TYPE_LABELS[type] ?? type}
				</button>
			{/each}
		</div>
	{/if}

	<!-- List Grid -->
	{#if filteredList.length === 0}
		<div class="py-16 text-center text-slate-400 bg-[#121422]/50 backdrop-blur-xl rounded-3xl border border-white/[0.06] border-dashed space-y-3">
			<span class="text-3xl block">📋</span>
			<p class="text-sm font-medium">Nothing here yet in this list.</p>
			<a href="/search" class="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors shadow-md shadow-indigo-600/20">
				Search and Add Media
			</a>
		</div>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
			{#each filteredList as item (item.tracking.id)}
				<TrackingTab {item} />
			{/each}
		</div>
	{/if}
</div>