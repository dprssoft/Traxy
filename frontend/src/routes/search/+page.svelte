<!--
@component
Search. With `?q=` it shows every result for that query as a poster grid (optionally narrowed by
`?type=`); the URL holds the whole state, so Back/Forward and reloads restore the results.
Without a query it's the search landing page.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Searchbar from '$lib/components/Searchbar.svelte';
	import CataloguePosterCard from '$lib/components/CataloguePosterCard.svelte';
	import { EmptyState, Shimmer, Tabs } from '$lib/components/ui';
	import { searchAll, SEARCH_TYPES, type SearchType } from '$lib/db/services/search.service';
	import { ensureLocalMedia } from '$lib/db/services/media.service';
	import { getSearchTypeLabel, searchPageParams } from '$lib/stores/search.svelte';
	import { searchPrefsStore } from '$lib/stores/searchPrefs.svelte';
	import { contentFilterStore } from '$lib/stores/contentFilter.svelte';
	import { quickEdit } from '$lib/stores/quickEdit.svelte';
	import { applyContentFilter } from '$lib/utils/contentFilter';
	import type { SearchResult } from '$lib/types/mediaTypes';

	const query = $derived(page.url.searchParams.get('q')?.trim() ?? '');
	const type = $derived.by((): SearchType => {
		const t = page.url.searchParams.get('type') as SearchType | null;
		return t && SEARCH_TYPES.includes(t) ? t : 'all';
	});
	const typeTabs = SEARCH_TYPES.map((t) => ({ id: t, label: getSearchTypeLabel(t) }));

	let results = $state<SearchResult[]>([]);
	let isLoading = $state(false);
	const visibleResults = $derived(applyContentFilter(results, contentFilterStore.effectiveMode));
	let currentSearchId = 0;

	$effect(() => {
		const q = query;
		const t = type;
		const searchId = ++currentSearchId;
		results = [];
		if (!q) return;
		isLoading = true;
		searchPrefsStore
			.load()
			.then(() => searchAll(q, t, searchPrefsStore.current))
			.then((found) => {
				if (searchId === currentSearchId) results = found;
			})
			.catch((err) => console.error('Search failed', err))
			.finally(() => {
				if (searchId === currentSearchId) isLoading = false;
			});
	});

	function selectType(t: string) {
		goto(resolve(`/search${searchPageParams(query, t as SearchType)}`), {
			replaceState: true,
			keepFocus: true,
		});
	}

	async function openResult(item: SearchResult) {
		const media = await ensureLocalMedia(item);
		goto(resolve(`/media/${media.id}`));
	}

	async function editResult(item: SearchResult) {
		quickEdit.open(await ensureLocalMedia(item));
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
					{visibleResults.length}
					{visibleResults.length === 1 ? 'result' : 'results'}
				</p>
			{/if}
		</div>

		<Tabs tabs={typeTabs} active={type} onchange={selectType} />

		{#if isLoading}
			<div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-4">
				{#each { length: 12 }, i (i)}
					<Shimmer class="aspect-[2/3]" />
				{/each}
			</div>
		{:else if visibleResults.length === 0}
			<EmptyState
				icon="🔍"
				title="Nothing found"
				description="Try another spelling or a different type filter."
			/>
		{:else}
			<div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-4">
				{#each visibleResults as item (`${item.source}:${item.externalId}`)}
					<div class="min-w-0">
						<CataloguePosterCard
							{item}
							fluid
							onclick={() => openResult(item)}
							onEdit={() => editResult(item)}
						/>
					</div>
				{/each}
			</div>
		{/if}
	</div>
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
