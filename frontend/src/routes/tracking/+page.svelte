<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';
	import type { TrackingListItem } from '$lib/types/trackingTypes';
	import type { MediaType } from '$lib/db/schema';
	import { MEDIA_TYPE_LABELS } from '$lib/constants';
	import TrackingTab from '$lib/components/TrackingTab.svelte';
	import { setAppSetting, setTrackingTypeFilterPrefs } from '$lib/db/services/settings.service';
	import { dndzone } from 'svelte-dnd-action';
	import { Button, Toggle } from '$lib/components/ui';

	let { data }: { data: PageData } = $props();

	const baseTabs = [
		{ id: 'in_progress', label: 'In Progress' },
		{ id: 'planned', label: 'Planned' },
		{ id: 'completed', label: 'Completed' },
		{ id: 'paused', label: 'Paused' },
		{ id: 'dropped', label: 'Dropped' },
	] as const;
	const letsPlayTab = { id: 'watched_letsplay', label: "Let's Play" } as const;

	type StatusTab = (typeof baseTabs)[number]['id'] | typeof letsPlayTab.id;

	// Local copy so status changes from cards move items between tabs immediately
	let items = $derived(data.trackingList);

	function handleTrackingChanged(id: string, t: TrackingListItem['tracking'] | null) {
		items = t
			? items.map((i) => (i.media.id === id ? { ...i, tracking: t } : i))
			: items.filter((i) => i.media.id !== id);
	}

	let activeTab = $state<StatusTab>('in_progress');
	let activeType = $state<MediaType | 'all'>('all');

	type SortOption = 'updatedDesc' | 'scoreDesc' | 'titleAsc';
	let currentSort = $state<SortOption>('updatedDesc');

	const allTypes = Object.keys(MEDIA_TYPE_LABELS) as MediaType[];
	const trackedTypes = $derived(new Set(items.map((t) => t.media.type)));

	let view = $derived(data.view);

	function toggleView() {
		view = view === 'list' ? 'grid' : 'list';
		setAppSetting('tracking_view', view);
	}

	let editing = $state(false);
	let typeOrder = $state<MediaType[]>([]);
	let showUntracked = $state(false);

	$effect.pre(() => {
		const saved = data.typePrefs.order as MediaType[];
		typeOrder = [
			...saved.filter((t) => allTypes.includes(t)),
			...allTypes.filter((t) => !saved.includes(t)),
		];
		showUntracked = data.typePrefs.showUntracked;
	});

	// Chips: ordered types; untracked ones only when enabled (always all in edit mode)
	const availableTypes = $derived(
		typeOrder.filter((t) => editing || showUntracked || trackedTypes.has(t)),
	);

	function savePrefs() {
		setTrackingTypeFilterPrefs({ order: typeOrder, showUntracked });
	}

	let dndItems = $state<{ id: MediaType }[]>([]);

	function toggleEditing() {
		editing = !editing;
		if (editing) {
			activeType = 'all';
			dndItems = typeOrder.map((id) => ({ id }));
		}
	}

	function handleDnd(e: CustomEvent<{ items: { id: MediaType }[] }>, final: boolean) {
		dndItems = e.detail.items;
		if (!final) return;
		typeOrder = dndItems.map((i) => i.id);
		savePrefs();
	}

	// Let's Play only exists for games
	const tabs = $derived(activeType === 'game' ? [...baseTabs, letsPlayTab] : baseTabs);

	$effect(() => {
		if (!tabs.some((t) => t.id === activeTab)) activeTab = 'in_progress';
	});

	const typeList = $derived(
		items.filter((t) => activeType === 'all' || t.media.type === activeType),
	);
	const countFor = (id: StatusTab) => typeList.filter((t) => t.tracking.status === id).length;

	const filteredList = $derived(
		items
			.filter((item) => item.tracking.status === activeTab)
			.filter((item) => activeType === 'all' || item.media.type === activeType)
			.sort((a, b) => {
				if (currentSort === 'updatedDesc') {
					return (
						new Date(b.tracking.updatedAt).getTime() - new Date(a.tracking.updatedAt).getTime()
					);
				}
				if (currentSort === 'scoreDesc') {
					return (b.tracking.score || 0) - (a.tracking.score || 0);
				}
				if (currentSort === 'titleAsc') {
					return a.media.title.localeCompare(b.media.title);
				}
				return 0;
			}),
	);
</script>

<div class="space-y-6">
	<div class="flex flex-row justify-between items-center gap-4">
		<div class="flex items-center gap-4">
			<h1 class="text-3xl font-extrabold text-white tracking-tight">My List</h1>
		</div>

		<div class="flex items-center gap-2">
			<select
				bind:value={currentSort}
				class="bg-[#121422] border border-white/[0.08] text-white text-xs font-semibold rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 block p-2.5 cursor-pointer shadow-inner"
			>
				<option value="updatedDesc">Recently updated</option>
				<option value="scoreDesc">Highest score</option>
				<option value="titleAsc">By title (A-Z)</option>
			</select>
			<button
				type="button"
				onclick={toggleView}
				aria-label={view === 'list' ? 'Switch to grid view' : 'Switch to list view'}
				class="p-2.5 rounded-xl bg-[#121422] border border-white/[0.08] text-slate-300 hover:text-white cursor-pointer transition-colors"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					{#if view === 'list'}
						<rect x="3" y="3" width="7" height="7" rx="1"></rect><rect
							x="14"
							y="3"
							width="7"
							height="7"
							rx="1"
						></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect><rect
							x="14"
							y="14"
							width="7"
							height="7"
							rx="1"
						></rect>
					{:else}
						<line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"
						></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"
						></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line
							x1="3"
							y1="18"
							x2="3.01"
							y2="18"
						></line>
					{/if}
				</svg>
			</button>
		</div>
	</div>

	<!-- Status Tabs -->
	<div class="flex overflow-x-auto gap-1 sm:gap-2 border-b border-white/[0.06] pb-3 scrollbar-hide">
		{#each tabs as tab (tab.id)}
			{@const active = activeTab === tab.id}
			<button
				class="flex items-center gap-2 px-3 sm:px-4 py-2 text-xs font-bold whitespace-nowrap rounded-xl transition-all cursor-pointer {active
					? 'text-white bg-indigo-600 shadow-md shadow-indigo-600/30'
					: 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'}"
				onclick={() => (activeTab = tab.id)}
			>
				{tab.label}
				<span
					class="text-[10px] px-1.5 py-0.5 rounded-full {active
						? 'bg-white/20 text-white'
						: 'bg-[#181b2e] text-slate-400'} font-bold"
				>
					{countFor(tab.id)}
				</span>
			</button>
		{/each}
	</div>

	<!-- Type Filters -->
	<div class="space-y-3">
		<div class="flex items-start justify-between gap-3">
			<div class="flex flex-wrap gap-1.5 items-center">
				<button
					class="px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer {activeType ===
					'all'
						? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/40 shadow-sm shadow-indigo-500/10'
						: 'bg-[#121422] border border-white/[0.06] text-slate-400 hover:text-slate-200'}"
					onclick={() => (activeType = 'all')}
				>
					All types
				</button>
				{#if editing}
					<div
						class="flex flex-wrap gap-1.5"
						use:dndzone={{ items: dndItems, flipDurationMs: 150, dropTargetStyle: {} }}
						onconsider={(e) => handleDnd(e, false)}
						onfinalize={(e) => handleDnd(e, true)}
					>
						{#each dndItems as item (item.id)}
							<div
								class="px-3 py-1 rounded-full text-xs font-semibold bg-[#121422] border border-dashed border-white/[0.15] cursor-grab active:cursor-grabbing select-none touch-none {trackedTypes.has(
									item.id,
								)
									? 'text-slate-200'
									: 'text-slate-500'}"
							>
								{MEDIA_TYPE_LABELS[item.id] ?? item.id}
							</div>
						{/each}
					</div>
				{:else}
					{#each availableTypes as type (type)}
						<button
							class="px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer {activeType ===
							type
								? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/40 shadow-sm shadow-indigo-500/10'
								: 'bg-[#121422] border border-white/[0.06] text-slate-400 hover:text-slate-200'}"
							onclick={() => (activeType = type)}
						>
							{MEDIA_TYPE_LABELS[type] ?? type}
						</button>
					{/each}
				{/if}
			</div>
			<Button variant="ghost" size="sm" onclick={toggleEditing}>
				{editing ? 'Done' : 'Edit'}
			</Button>
		</div>
		{#if editing}
			<div class="flex items-center gap-3 text-xs text-slate-300">
				<Toggle bind:checked={showUntracked} onchange={savePrefs} label="Show untracked types" />
				<span>Show untracked types</span>
			</div>
			<p class="text-[11px] text-slate-500">Drag types to reorder them.</p>
		{/if}
	</div>

	<!-- List Grid -->
	{#if filteredList.length === 0}
		<div
			class="py-16 text-center text-slate-400 bg-[#121422]/50 backdrop-blur-xl rounded-3xl border border-white/[0.06] border-dashed space-y-3"
		>
			<span class="text-3xl block">📋</span>
			<p class="text-sm font-medium">Nothing here yet in this list.</p>
			<a
				href={resolve('/search')}
				class="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors shadow-md shadow-indigo-600/20"
			>
				Search and Add Media
			</a>
		</div>
	{:else}
		<div
			class="grid {view === 'grid' ? 'grid-cols-2' : 'grid-cols-1 md:grid-cols-2'} gap-3 sm:gap-4"
		>
			{#each filteredList as item (item.tracking.id)}
				<TrackingTab
					{item}
					compact={view === 'grid'}
					onTrackingChanged={(t) => handleTrackingChanged(item.media.id, t)}
				/>
			{/each}
		</div>
	{/if}
</div>
