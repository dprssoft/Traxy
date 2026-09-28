<!--
@component
Global search: queries every provider that matches the type filter (`search.service`) and applies
the adult-content filter. Picking a result imports it locally and opens its media page; submitting
the query (Enter / the keyboard's search key) opens the full results page at `/search?q=`.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import {
		searchState,
		addRecentSearch,
		loadRecentSearches,
		getTypeColor,
		getSearchTypeLabel,
		searchPageParams,
		SEARCH_PAGE_PATH,
	} from '$lib/stores/search.svelte';
	import { ensureLocalMedia } from '$lib/db/services/media.service';
	import { quickEdit } from '$lib/stores/quickEdit.svelte';
	import QuickEditButton from './QuickEditButton.svelte';
	import { searchAll, SEARCH_TYPES, type SearchType } from '$lib/db/services/search.service';
	import { searchPrefsStore } from '$lib/stores/searchPrefs.svelte';
	import { contentFilterStore } from '$lib/stores/contentFilter.svelte';
	import { applyContentFilter } from '$lib/utils/contentFilter';
	import SensitiveContent from '$lib/components/ui/SensitiveContent.svelte';
	import type { SearchResult } from '$lib/types/mediaTypes';
	import { MEDIA_TYPE_LABELS } from '$lib/constants';

	let query = $state('');
	let isFocused = $state(false);
	let isLoading = $state(false);
	let results = $state<SearchResult[]>([]);
	const visibleResults = $derived(applyContentFilter(results, contentFilterStore.effectiveMode));
	let searchTimeout: ReturnType<typeof setTimeout>;
	let currentSearchId = 0;
	// Query and type the dropdown results belong to; the bar can be filled from the URL without them.
	let searchedKey = '';

	let containerEl: HTMLElement | null = null;
	let inputEl: HTMLInputElement | null = null;

	// Mirror the results page's query and type in the bar; clear the bar everywhere else.
	$effect(() => {
		if (page.url.pathname === resolve(SEARCH_PAGE_PATH)) {
			query = page.url.searchParams.get('q') ?? '';
			const type = page.url.searchParams.get('type') as SearchType | null;
			if (type && SEARCH_TYPES.includes(type)) searchState.selectedType = type;
		} else {
			query = '';
		}
	});

	function openSearch() {
		isFocused = true;
		searchState.isOpen = true;
		if (query.trim() && searchedKey !== `${searchState.selectedType}:${query}`) {
			performSearch(query);
		}
	}

	function closeSearch() {
		isFocused = false;
		searchState.isOpen = false;
		inputEl?.blur();
	}

	function toggleSearch() {
		if (searchState.isOpen) {
			closeSearch();
		} else {
			openSearch();
			inputEl?.focus();
		}
	}

	onMount(() => {
		loadRecentSearches();
		searchPrefsStore.load();

		function handlePointerDownOutside(e: PointerEvent | MouseEvent) {
			if (!searchState.isOpen) return;
			const target = e.target as Node | null;
			if (containerEl && !containerEl.contains(target)) {
				closeSearch();
			}
		}

		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === 'Escape' && searchState.isOpen) {
				closeSearch();
			}
		}

		document.addEventListener('pointerdown', handlePointerDownOutside, true);
		document.addEventListener('keydown', handleKeyDown);

		return () => {
			document.removeEventListener('pointerdown', handlePointerDownOutside, true);
			document.removeEventListener('keydown', handleKeyDown);
		};
	});

	async function performSearch(q: string) {
		if (!q.trim()) {
			results = [];
			return;
		}

		isLoading = true;
		results = [];
		searchedKey = `${searchState.selectedType}:${q}`;
		const searchId = ++currentSearchId;

		try {
			const found = await searchAll(q, searchState.selectedType, searchPrefsStore.current);
			if (searchId === currentSearchId) results = found;
		} catch (err) {
			console.error('Search failed', err);
		} finally {
			if (searchId === currentSearchId) {
				isLoading = false;
			}
		}
	}

	function onInput() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			performSearch(query);
		}, 400);
	}

	function onSubmit(e: SubmitEvent) {
		e.preventDefault();
		const q = query.trim();
		if (!q) return;
		clearTimeout(searchTimeout);
		addRecentSearch(q);
		closeSearch();
		// Refining a search replaces the results entry, so Back leaves the results page.
		const onResults =
			page.url.pathname === resolve(SEARCH_PAGE_PATH) && page.url.searchParams.has('q');
		goto(resolve(`${SEARCH_PAGE_PATH}${searchPageParams(q, searchState.selectedType)}`), {
			replaceState: onResults,
		});
	}

	function onTypeSelect(type: SearchType) {
		searchState.selectedType = type;
		performSearch(query);
	}

	async function onResultClick(item: SearchResult) {
		addRecentSearch(item.title);
		closeSearch();
		query = '';

		const media = await ensureLocalMedia(item);
		goto(resolve(`/media/${media.id}`));
	}

	async function onResultEdit(item: SearchResult) {
		const media = await ensureLocalMedia(item);
		closeSearch();
		quickEdit.open(media);
	}
</script>

<div class="relative w-full min-w-0" bind:this={containerEl}>
	<!-- Search icon (clickable to toggle search) -->
	<button
		type="button"
		onclick={toggleSearch}
		class="absolute inset-y-0 left-2.5 sm:left-3 flex items-center text-slate-400 hover:text-white transition-colors z-30 p-1 cursor-pointer"
		aria-label="Toggle search"
		title="Toggle search"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="15"
			height="15"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<circle cx="11" cy="11" r="8"></circle>
			<line x1="21" y1="21" x2="16.65" y2="16.65"></line>
		</svg>
	</button>

	<form role="search" class="contents" onsubmit={onSubmit}>
		<input
			bind:this={inputEl}
			enterkeyhint="search"
			aria-label="Search"
			bind:value={query}
			oninput={onInput}
			onclick={() => {
				if (searchState.isOpen && query.trim().length === 0) {
					closeSearch();
				} else {
					openSearch();
				}
			}}
			onfocus={openSearch}
			placeholder="Search movies, anime, games..."
			class="relative z-20 w-full min-w-0 bg-[#121422]/90 hover:bg-[#16192b] border border-white/[0.08] rounded-full pl-8 sm:pl-9 pr-8 sm:pr-9 py-2 text-xs sm:text-sm text-white placeholder:text-slate-500 placeholder:truncate focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-inner"
		/>
	</form>

	<!-- Close / Clear (X) button -->
	{#if searchState.isOpen || query.length > 0}
		<button
			type="button"
			onclick={(e) => {
				e.stopPropagation();
				query = '';
				closeSearch();
			}}
			class="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-white transition-colors z-50 p-1 cursor-pointer"
			aria-label="Clear and close search"
			title="Close search"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.5"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<line x1="18" y1="6" x2="6" y2="18"></line>
				<line x1="6" y1="6" x2="18" y2="18"></line>
			</svg>
		</button>
	{/if}

	{#if searchState.isOpen && (isFocused || query.length > 0)}
		<!-- Fallback click backdrop -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="fixed inset-0 z-40" onclick={closeSearch}></div>

		<div
			class="absolute top-12 left-0 w-full bg-[#121422]/95 backdrop-blur-2xl border border-white/[0.1] rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden max-h-[80vh]"
		>
			<!-- Type Filters -->
			<div
				class="flex overflow-x-auto gap-1.5 p-3 border-b border-white/[0.06] scrollbar-hide shrink-0 bg-[#0d0e18]/50"
			>
				{#each SEARCH_TYPES as type (type)}
					<button
						onclick={() => onTypeSelect(type)}
						class="px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer {searchState.selectedType ===
						type
							? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
							: 'bg-[#181b2e] text-slate-400 hover:text-white hover:bg-[#20243d]'}"
					>
						{getSearchTypeLabel(type)}
					</button>
				{/each}
			</div>

			<!-- Results Area -->
			<div class="overflow-y-auto flex-1 p-2 space-y-1">
				{#if isLoading}
					<div
						class="p-8 text-center text-slate-400 text-sm flex items-center justify-center gap-2"
					>
						<span
							class="w-4 h-4 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin"
						></span>
						Searching...
					</div>
				{:else if query.trim().length === 0}
					{#if searchState.recentSearches.length > 0}
						<div class="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
							Recent searches
						</div>
						{#each searchState.recentSearches as recent (recent)}
							<button
								class="w-full text-left px-3.5 py-2 text-sm text-slate-300 hover:bg-white/[0.06] rounded-xl flex items-center gap-3 transition-colors cursor-pointer"
								onclick={() => {
									query = recent;
									performSearch(recent);
								}}
							>
								<span class="text-slate-500">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="14"
										height="14"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
										><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"
										></polyline></svg
									>
								</span>
								{recent}
							</button>
						{/each}
					{:else}
						<div class="p-8 text-center text-slate-500 text-sm">Type a title to search</div>
					{/if}
				{:else if visibleResults.length === 0}
					<div class="p-8 text-center text-slate-500 text-sm">Nothing found</div>
				{:else}
					{#each visibleResults as item (`${item.source}:${item.externalId}`)}
						<div class="relative">
							<button
								class="w-full flex gap-3 p-2.5 pr-12 hover:bg-white/[0.06] rounded-xl text-left items-start transition-all cursor-pointer group"
								onclick={() => onResultClick(item)}
							>
								{#if item.posterUrl}
									<SensitiveContent
										isAdult={item.isAdult}
										badge={false}
										class="w-12 h-16 rounded-lg shrink-0"
									>
										<img
											src={item.posterUrl}
											alt={item.title}
											class="w-12 h-16 object-cover rounded-lg shadow bg-slate-800 shrink-0 group-hover:scale-105 transition-transform"
										/>
									</SensitiveContent>
								{:else}
									<div
										class="w-12 h-16 bg-[#181b2e] rounded-lg border border-white/[0.06] flex items-center justify-center shrink-0"
									>
										<span class="text-slate-500 text-xs font-bold text-center leading-tight"
											>{item.title.substring(0, 2)}</span
										>
									</div>
								{/if}

								<div class="flex-1 min-w-0 py-0.5">
									<h4
										class="text-white text-sm font-semibold truncate group-hover:text-indigo-400 transition-colors"
									>
										{item.title}
									</h4>
									<div class="flex items-center gap-2 mt-1 flex-wrap">
										<span
											class="text-[11px] font-semibold px-2 py-0.5 rounded {getTypeColor(
												item.type,
											)}">{MEDIA_TYPE_LABELS[item.type] ?? item.type}</span
										>
										{#if item.year}
											<span class="text-xs text-slate-400 font-medium">{item.year}</span>
										{/if}
									</div>
									{#if item.type === 'game' && item.platforms && item.platforms.length > 0}
										<div class="flex flex-wrap gap-1 mt-1.5">
											{#each item.platforms.slice(0, 3) as platform (platform)}
												<span
													class="text-[10px] font-medium px-1.5 py-0.5 bg-[#181b2e] text-slate-300 rounded border border-white/[0.06]"
													>{platform}</span
												>
											{/each}
											{#if item.platforms.length > 3}
												<span class="text-[10px] text-slate-500">+{item.platforms.length - 3}</span>
											{/if}
										</div>
									{/if}
								</div>
							</button>
							<QuickEditButton
								label="Quick edit {item.title}"
								onclick={() => onResultEdit(item)}
								class="absolute right-2.5 top-1/2 -translate-y-1/2"
							/>
						</div>
					{/each}
				{/if}
			</div>
		</div>
	{/if}
</div>
