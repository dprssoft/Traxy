<!--
@component
Search. With `?q=` it shows every result for that query as a poster grid, narrowed by type chips
and the filter sheet (year, sort, library, game platform). The URL holds the whole state, so
Back/Forward and reloads restore the results. Without a query it's the search landing page.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Searchbar from '$lib/components/Searchbar.svelte';
	import CataloguePosterCard from '$lib/components/CataloguePosterCard.svelte';
	import SearchFilterSheet from '$lib/components/SearchFilterSheet.svelte';
	import { Badge, Button, ChipGroup, EmptyState, Shimmer } from '$lib/components/ui';
	import { searchAll, RESULT_TYPES } from '$lib/db/services/search.service';
	import { ensureLocalMedia } from '$lib/db/services/media.service';
	import { getTrackedExternalKeys } from '$lib/db/services/tracking.service';
	import { searchPrefsStore } from '$lib/stores/searchPrefs.svelte';
	import { contentFilterStore } from '$lib/stores/contentFilter.svelte';
	import { quickEdit } from '$lib/stores/quickEdit.svelte';
	import { applyContentFilter } from '$lib/utils/contentFilter';
	import {
		applySearchFilters,
		countSheetFilters,
		DEFAULT_SEARCH_FILTERS,
		LIBRARY_LABELS,
		parseSearchFilters,
		platformOptions,
		resultKey,
		searchFiltersParams,
		SORT_LABELS,
		yearPresets,
		type SearchFilters,
	} from '$lib/utils/searchFilters';
	import { MEDIA_TYPE_PLURAL_LABELS } from '$lib/constants';
	import type { MediaType } from '$lib/db/schema';
	import type { SearchResult } from '$lib/types/mediaTypes';

	type TypeChip = MediaType | 'all';

	const query = $derived(page.url.searchParams.get('q')?.trim() ?? '');
	const filters = $derived(parseSearchFilters(page.url.searchParams, RESULT_TYPES));
	// A string, so changing only the sort or year doesn't re-run the provider search.
	const typesKey = $derived(filters.types.join());

	const typeChips: { value: TypeChip; label: string }[] = [
		{ value: 'all', label: 'All' },
		...RESULT_TYPES.map((t) => ({ value: t, label: MEDIA_TYPE_PLURAL_LABELS[t] })),
	];

	let results = $state<SearchResult[]>([]);
	let isLoading = $state(false);
	let trackedKeys = $state(new Set<string>());
	let sheetOpen = $state(false);
	let currentSearchId = 0;

	const allowed = $derived(applyContentFilter(results, contentFilterStore.effectiveMode));
	const shown = $derived(applySearchFilters(allowed, filters, trackedKeys));
	const platforms = $derived(platformOptions(allowed));
	const sheetCount = $derived(countSheetFilters(filters));

	/** Removable chips for the active sheet filters. */
	const activeFilters = $derived.by(() => {
		const chips: { id: string; label: string; clear: Partial<SearchFilters> }[] = [];
		const { yearFrom: from, yearTo: to } = filters;
		if (from !== undefined || to !== undefined) {
			const preset = yearPresets().find((p) => p.from === from && p.to === to);
			const label =
				preset?.label ??
				(from === undefined
					? `Until ${to}`
					: to === undefined
						? `From ${from}`
						: from === to
							? `${from}`
							: `${from}–${to}`);
			chips.push({ id: 'year', label, clear: { yearFrom: undefined, yearTo: undefined } });
		}
		if (filters.sort !== 'relevance') {
			chips.push({
				id: 'sort',
				label: `Sort: ${SORT_LABELS[filters.sort]}`,
				clear: { sort: 'relevance' },
			});
		}
		if (filters.library !== 'all') {
			chips.push({ id: 'lib', label: LIBRARY_LABELS[filters.library], clear: { library: 'all' } });
		}
		for (const p of filters.platforms) {
			chips.push({
				id: `platform:${p}`,
				label: p,
				clear: { platforms: filters.platforms.filter((x) => x !== p) },
			});
		}
		return chips;
	});

	$effect(() => {
		const q = query;
		const types = typesKey ? (typesKey.split(',') as MediaType[]) : [];
		const searchId = ++currentSearchId;
		results = [];
		if (!q) return;
		isLoading = true;
		searchPrefsStore
			.load()
			.then(() => searchAll(q, types, searchPrefsStore.current))
			.then((found) => {
				if (searchId === currentSearchId) results = found;
			})
			.catch((err) => console.error('Search failed', err))
			.finally(() => {
				if (searchId === currentSearchId) isLoading = false;
			});
	});

	async function loadTracked() {
		try {
			trackedKeys = await getTrackedExternalKeys();
		} catch (err) {
			console.error('Failed to load library', err);
		}
	}

	onMount(loadTracked);

	/** Apply a filter change in place: refining filters shouldn't add history entries. */
	function updateFilters(patch: Partial<SearchFilters>) {
		goto(resolve(`/search${searchFiltersParams(query, { ...filters, ...patch })}`), {
			replaceState: true,
			keepFocus: true,
			noScroll: true,
		});
	}

	function selectTypes(selected: TypeChip[]) {
		// "All" clears the type filter; picking a type switches "All" off.
		const pickedAll = selected.includes('all') && filters.types.length > 0;
		const types = pickedAll ? [] : (selected.filter((t) => t !== 'all') as MediaType[]);
		updateFilters({ types });
	}

	function clearSheetFilters() {
		const { sort, library, platforms: none } = DEFAULT_SEARCH_FILTERS;
		updateFilters({ yearFrom: undefined, yearTo: undefined, sort, library, platforms: none });
	}

	async function openResult(item: SearchResult) {
		const media = await ensureLocalMedia(item);
		goto(resolve(`/media/${media.id}`));
	}

	async function editResult(item: SearchResult) {
		quickEdit.open(await ensureLocalMedia(item), { onClosed: loadTracked });
	}
</script>

{#if query}
	<div class="space-y-4 sm:space-y-5">
		<div>
			<h1 class="text-xl sm:text-2xl font-extrabold text-white tracking-tight break-words">
				Results for “{query}”
			</h1>
			{#if !isLoading}
				<p class="text-xs sm:text-sm text-slate-400 mt-1">
					{#if shown.length === allowed.length}
						{shown.length} {shown.length === 1 ? 'result' : 'results'}
					{:else}
						{shown.length} of {allowed.length} results
					{/if}
				</p>
			{/if}
		</div>

		<div class="flex items-center gap-2">
			<ChipGroup
				label="Media type"
				multiple
				class="flex-1 min-w-0"
				options={typeChips}
				selected={filters.types.length > 0 ? filters.types : ['all']}
				onchange={selectTypes}
			/>
			<Button variant="secondary" size="sm" class="shrink-0" onclick={() => (sheetOpen = true)}>
				Filters
				{#if sheetCount > 0}
					<Badge variant="indigo" size="xs">{sheetCount}</Badge>
				{/if}
			</Button>
		</div>

		{#if activeFilters.length > 0}
			<div class="flex flex-wrap items-center gap-1.5">
				{#each activeFilters as chip (chip.id)}
					<Button variant="secondary" size="sm" onclick={() => updateFilters(chip.clear)}>
						{chip.label}
						<span aria-hidden="true" class="text-slate-500">✕</span>
						<span class="sr-only">Remove filter</span>
					</Button>
				{/each}
				<Button variant="ghost" size="sm" onclick={clearSheetFilters}>Clear all</Button>
			</div>
		{/if}

		{#if isLoading}
			<div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-4">
				{#each { length: 12 }, i (i)}
					<Shimmer class="aspect-[2/3]" />
				{/each}
			</div>
		{:else if allowed.length === 0}
			<EmptyState
				icon="🔍"
				title="Nothing found"
				description="Try another spelling or a different type filter."
			/>
		{:else if shown.length === 0}
			<EmptyState
				icon="🧭"
				title="No results match these filters"
				description="{allowed.length} results are hidden by your filters."
			>
				{#snippet action()}
					<Button variant="secondary" onclick={clearSheetFilters}>Clear filters</Button>
				{/snippet}
			</EmptyState>
		{:else}
			<div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-4">
				{#each shown as item (resultKey(item))}
					<div class="min-w-0">
						<CataloguePosterCard
							{item}
							fluid
							inLibrary={trackedKeys.has(resultKey(item))}
							onclick={() => openResult(item)}
							onEdit={() => editResult(item)}
						/>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<SearchFilterSheet bind:open={sheetOpen} {filters} {platforms} onchange={updateFilters} />
{:else}
	<div
		class="flex flex-col items-center justify-start min-h-[60vh] pt-8 sm:pt-14 px-4 space-y-8 max-w-2xl mx-auto text-center"
	>
		<div>
			<div
				class="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center text-3xl shadow-xl shadow-indigo-500/25 mb-4"
			>
				🔍
			</div>
			<h1 class="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
				Explore & Search
			</h1>
			<p class="text-xs sm:text-sm text-slate-400 mt-2 max-w-md">
				Find movies, TV series, anime, video games, manga, books, and comics across all connected
				public databases.
			</p>
		</div>

		<div class="w-full">
			<Searchbar />
		</div>

		<div class="flex flex-wrap items-center justify-center gap-2 pt-4">
			<span class="text-xs text-slate-500 font-medium">Supported sources:</span>
			<span
				class="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
				>TMDB</span
			>
			<span
				class="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
				>IGDB / RAWG</span
			>
			<span
				class="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-pink-500/10 text-pink-400 border border-pink-500/20"
				>AniList</span
			>
			<span
				class="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20"
				>ComicVine</span
			>
			<span
				class="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20"
				>OpenLibrary</span
			>
		</div>
	</div>
{/if}
