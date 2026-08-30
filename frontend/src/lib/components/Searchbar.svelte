<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { searchState, addRecentSearch, loadRecentSearches, getTypeColor } from '$lib/stores/search.svelte';
	import { searchTmdb, getTmdbDetails } from '$lib/db/sources/tmdb';
	import { searchRawg, getRawgDetails } from '$lib/db/sources/rawg';
	import { searchAnilist, getAnilistDetails } from '$lib/db/sources/anilist';
	import { searchComicVine, getComicVineDetails } from '$lib/db/sources/comicvine';
	import { searchOpenLibrary, getOpenLibraryDetails } from '$lib/db/sources/openlibrary';
	import { getMediaByExternalId, upsertMedia } from '$lib/db/services/media.service';
	import { deduplicateResults } from '$lib/utils/search-dedup';
	import { searchPrefsStore } from '$lib/stores/searchPrefs.svelte';
	import type { SearchResult } from '$lib/types/mediaTypes';
	import type { MediaType } from '$lib/db/schema';
	import { MEDIA_TYPE_LABELS } from '$lib/constants';

	let query = $state('');
	let isFocused = $state(false);
	let isLoading = $state(false);
	let results = $state<SearchResult[]>([]);
	let searchTimeout: ReturnType<typeof setTimeout>;
	let currentSearchId = 0;

	let containerEl: HTMLElement | null = null;
	let inputEl: HTMLInputElement | null = null;

	const filterTypes: (MediaType | 'all')[] = ['all', 'film', 'tv', 'game', 'anime', 'book', 'comic'];

	function openSearch() {
		isFocused = true;
		searchState.isOpen = true;
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
		const t = searchState.selectedType;
		const searchId = ++currentSearchId;

		try {
			const promises: Promise<SearchResult[]>[] = [];

			// Always include AniList when the filter could include anime or manga,
			// so the deduplicator has enough context to suppress TMDB/OL duplicates.
			if (t === 'all' || t === 'film' || t === 'tv') promises.push(searchTmdb(q));
			if (t === 'all' || t === 'game') promises.push(searchRawg(q));
			if (t === 'all' || t === 'anime' || t === 'tv') promises.push(searchAnilist(q, 'ANIME'));
			if (t === 'all' || t === 'comic' || t === 'book') {
				promises.push(searchAnilist(q, 'MANGA'));
			}
			if (t === 'all' || t === 'comic') promises.push(searchComicVine(q));
			if (t === 'all' || t === 'book') promises.push(searchOpenLibrary(q));

			// Collect all raw results first, then deduplicate once everything has settled.
			const raw: SearchResult[] = [];
			await Promise.all(
				promises.map(p => p.then(res => {
					if (searchId !== currentSearchId) return;
					raw.push(...res);
				}).catch(e => console.error(e)))
			);

			if (searchId !== currentSearchId) return;

			// Deduplicate first on the full raw set so AniList anime/manga entries are
			// present to suppress TMDB/OL/CV duplicates — even when the active filter
			// would later hide the AniList result itself (e.g. user filters by 'tv').
			const deduped = deduplicateResults(raw, searchPrefsStore.current);

			// Now apply the type filter on the already-clean set.
			results = t === 'all' ? deduped
				: t === 'comic' ? deduped.filter(r => ['manga', 'manhwa', 'manhua', 'comic'].includes(r.type))
				: deduped.filter(r => r.type === t);
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

	function onTypeSelect(type: MediaType | 'all') {
		searchState.selectedType = type;
		performSearch(query);
	}

	async function onResultClick(item: SearchResult) {
		addRecentSearch(item.title);
		closeSearch();
		query = '';
		
		// 1. Check if already in local DB
		const existing = await getMediaByExternalId(item.source, item.externalId);
		if (existing) {
			goto(`/media/${existing.id}`);
			return;
		}

		// 2. Fetch full details from source if needed, or just insert
		let fullDetails: SearchResult | null = item;
		
		if (item.source === 'tmdb') fullDetails = await getTmdbDetails(item.externalId, item.type as 'film' | 'tv');
		else if (item.source === 'rawg' || item.source === 'igdb') fullDetails = await getRawgDetails(item.externalId);
		else if (item.source === 'anilist') fullDetails = await getAnilistDetails(parseInt(item.externalId));
		else if (item.source === 'comicvine') fullDetails = await getComicVineDetails(item.externalId);
		else if (item.source === 'openlibrary') fullDetails = await getOpenLibraryDetails(item.externalId);

		if (!fullDetails) fullDetails = item;

		// 3. Upsert into local DB
		const inserted = await upsertMedia({
			id: crypto.randomUUID(),
			source: fullDetails.source,
			externalId: fullDetails.externalId,
			type: fullDetails.type,
			title: fullDetails.title,
			year: fullDetails.year,
			posterUrl: fullDetails.posterUrl,
			description: fullDetails.description,
			totalEpisodes: fullDetails.totalEpisodes,
			totalSeasons: fullDetails.totalSeasons,
			totalPages: fullDetails.totalPages,
		});

		// 4. Navigate
		goto(`/media/${inserted.id}`);
	}
</script>

<div class="relative w-full max-w-xl" bind:this={containerEl}>
	<!-- Search icon (clickable to toggle search) -->
	<button
		type="button"
		onclick={toggleSearch}
		class="absolute inset-y-0 left-3 flex items-center text-slate-400 hover:text-white transition-colors z-50 p-1 cursor-pointer"
		aria-label="Toggle search"
		title="Toggle search"
	>
		<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<circle cx="11" cy="11" r="8"></circle>
			<line x1="21" y1="21" x2="16.65" y2="16.65"></line>
		</svg>
	</button>
	
	<input
		bind:this={inputEl}
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
		placeholder="Search movies, anime, games, comics..."
		class="relative z-50 w-full bg-[#121422]/90 hover:bg-[#16192b] border border-white/[0.08] rounded-full pl-10 pr-9 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-inner"
	/>

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
			<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
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
		
		<div class="absolute top-12 left-0 w-full bg-[#121422]/95 backdrop-blur-2xl border border-white/[0.1] rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden max-h-[80vh]">
			
			<!-- Type Filters -->
			<div class="flex overflow-x-auto gap-1.5 p-3 border-b border-white/[0.06] scrollbar-hide shrink-0 bg-[#0d0e18]/50">
				{#each filterTypes as type}
					<button
						onclick={() => onTypeSelect(type)}
						class="px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer {searchState.selectedType === type ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'bg-[#181b2e] text-slate-400 hover:text-white hover:bg-[#20243d]'}"
					>
						{type === 'all' ? 'All' : type === 'comic' ? 'Comics / Manga' : MEDIA_TYPE_LABELS[type] ?? type}
					</button>
				{/each}
			</div>

			<!-- Results Area -->
			<div class="overflow-y-auto flex-1 p-2 space-y-1">
				{#if isLoading}
					<div class="p-8 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
						<span class="w-4 h-4 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin"></span>
						Searching...
					</div>
				{:else if query.trim().length === 0}
					{#if searchState.recentSearches.length > 0}
						<div class="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Recent searches</div>
						{#each searchState.recentSearches as recent}
							<button 
								class="w-full text-left px-3.5 py-2 text-sm text-slate-300 hover:bg-white/[0.06] rounded-xl flex items-center gap-3 transition-colors cursor-pointer"
								onclick={() => { query = recent; performSearch(recent); }}
							>
								<span class="text-slate-500">
									<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
								</span> {recent}
							</button>
						{/each}
					{:else}
						<div class="p-8 text-center text-slate-500 text-sm">Type a title to search</div>
					{/if}
				{:else if results.length === 0}
					<div class="p-8 text-center text-slate-500 text-sm">Nothing found</div>
				{:else}
					{#each results as item}
						<button 
							class="w-full flex gap-3 p-2.5 hover:bg-white/[0.06] rounded-xl text-left items-start transition-all cursor-pointer group"
							onclick={() => onResultClick(item)}
						>
							{#if item.posterUrl}
								<img src={item.posterUrl} alt={item.title} class="w-12 h-16 object-cover rounded-lg shadow bg-slate-800 shrink-0 group-hover:scale-105 transition-transform" />
							{:else}
								<div class="w-12 h-16 bg-[#181b2e] rounded-lg border border-white/[0.06] flex items-center justify-center shrink-0">
									<span class="text-slate-500 text-xs font-bold text-center leading-tight">{item.title.substring(0, 2)}</span>
								</div>
							{/if}
							
							<div class="flex-1 min-w-0 py-0.5">
								<h4 class="text-white text-sm font-semibold truncate group-hover:text-indigo-400 transition-colors">{item.title}</h4>
								<div class="flex items-center gap-2 mt-1 flex-wrap">
									<span class="text-[11px] font-semibold px-2 py-0.5 rounded {getTypeColor(item.type)}">{MEDIA_TYPE_LABELS[item.type] ?? item.type}</span>
									{#if item.year}
										<span class="text-xs text-slate-400 font-medium">{item.year}</span>
									{/if}
								</div>
								{#if item.type === 'game' && item.platforms && item.platforms.length > 0}
									<div class="flex flex-wrap gap-1 mt-1.5">
										{#each item.platforms.slice(0, 3) as platform}
											<span class="text-[10px] font-medium px-1.5 py-0.5 bg-[#181b2e] text-slate-300 rounded border border-white/[0.06]">{platform}</span>
										{/each}
										{#if item.platforms.length > 3}
											<span class="text-[10px] text-slate-500">+{item.platforms.length - 3}</span>
										{/if}
									</div>
								{/if}
							</div>
						</button>
					{/each}
				{/if}
			</div>
		</div>
	{/if}
</div>
