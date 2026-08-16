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
	import type { SearchResult } from '$lib/types/mediaTypes';
	import type { MediaType } from '$lib/db/schema';
	import { MEDIA_TYPE_LABELS } from '$lib/constants';

	let query = $state('');
	let isFocused = $state(false);
	let isLoading = $state(false);
	let results = $state<SearchResult[]>([]);
	let searchTimeout: ReturnType<typeof setTimeout>;
	let currentSearchId = 0;

	const filterTypes: (MediaType | 'all')[] = ['all', 'film', 'tv', 'game', 'anime', 'book', 'comic'];

	onMount(() => {
		loadRecentSearches();
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

			if (t === 'all' || t === 'film' || t === 'tv') promises.push(searchTmdb(q));
			if (t === 'all' || t === 'game') promises.push(searchRawg(q));
			if (t === 'all' || t === 'anime') promises.push(searchAnilist(q, 'ANIME'));
			if (t === 'all' || t === 'comic') {
				promises.push(searchAnilist(q, 'MANGA'));
				promises.push(searchComicVine(q));
			}
			if (t === 'all' || t === 'book') promises.push(searchOpenLibrary(q));

			await Promise.all(
				promises.map(p => p.then(res => {
					if (searchId !== currentSearchId) return;
					const filtered = t === 'all' ? res : 
						(t === 'comic' ? res.filter(r => ['manga', 'manhwa', 'manhua', 'comic'].includes(r.type)) : res.filter(r => r.type === t));
					results = [...results, ...filtered];
				}).catch(e => console.error(e)))
			);
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
		searchState.isOpen = false;
		isFocused = false;
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

<div class="relative w-full max-w-xl">
	<div class="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-400">
		<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
	</div>
	
	<input
		bind:value={query}
		oninput={onInput}
		onfocus={() => { isFocused = true; searchState.isOpen = true; }}
		placeholder="Search..."
		class="w-full bg-gray-800/80 border border-gray-700/80 rounded-full pl-10 pr-4 py-2 text-white/90 placeholder:text-gray-500 focus:outline-none focus:border-brand-accent transition-colors"
	/>

	{#if searchState.isOpen && (isFocused || query.length > 0)}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="fixed inset-0 z-40" onclick={() => { searchState.isOpen = false; isFocused = false; }}></div>
		
		<div class="absolute top-12 left-0 w-full bg-bkg-header border border-gray-700 rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden max-h-[80vh]">
			
			<!-- Type Filters -->
			<div class="flex overflow-x-auto gap-2 p-3 border-b border-gray-800 scrollbar-hide shrink-0">
				{#each filterTypes as type}
					<button
						onclick={() => onTypeSelect(type)}
						class="px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors {searchState.selectedType === type ? 'bg-brand-accent text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}"
					>
						{type === 'all' ? 'All' : type === 'comic' ? 'Comics / Manga' : MEDIA_TYPE_LABELS[type] ?? type}
					</button>
				{/each}
			</div>

			<!-- Results Area -->
			<div class="overflow-y-auto flex-1 p-2">
				{#if isLoading}
					<div class="p-8 text-center text-gray-500 text-sm">Шукаємо...</div>
				{:else if query.trim().length === 0}
					{#if searchState.recentSearches.length > 0}
						<div class="px-3 py-2 text-xs font-medium text-gray-500 uppercase">Recent searches</div>
						{#each searchState.recentSearches as recent}
							<button 
								class="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 rounded-lg flex items-center gap-3"
								onclick={() => { query = recent; performSearch(recent); }}
							>
								<span class="text-gray-500">
									<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
								</span> {recent}
							</button>
						{/each}
					{:else}
						<div class="p-8 text-center text-gray-500 text-sm">Type a title to search</div>
					{/if}
				{:else if results.length === 0}
					<div class="p-8 text-center text-gray-500 text-sm">Nothing found</div>
				{:else}
					{#each results as item}
						<button 
							class="w-full flex gap-3 p-2 hover:bg-gray-800 rounded-lg text-left items-start transition-colors"
							onclick={() => onResultClick(item)}
						>
							{#if item.posterUrl}
								<img src={item.posterUrl} alt={item.title} class="w-12 h-16 object-cover rounded shadow bg-gray-800 shrink-0" />
							{:else}
								<div class="w-12 h-16 bg-gray-800 rounded border border-gray-700 flex items-center justify-center shrink-0">
									<span class="text-gray-600 text-xs text-center leading-tight">{item.title.substring(0, 2)}</span>
								</div>
							{/if}
							
							<div class="flex-1 min-w-0 py-1">
								<h4 class="text-white text-sm font-medium truncate">{item.title}</h4>
								<div class="flex items-center gap-2 mt-1 flex-wrap">
									<span class="text-xs px-1.5 py-0.5 rounded-sm {getTypeColor(item.type)}">{MEDIA_TYPE_LABELS[item.type] ?? item.type}</span>
									{#if item.year}
										<span class="text-xs text-gray-500">{item.year}</span>
									{/if}
								</div>
								{#if item.type === 'game' && item.platforms && item.platforms.length > 0}
									<div class="flex flex-wrap gap-1 mt-1">
										{#each item.platforms.slice(0, 3) as platform}
											<span class="text-xs px-1.5 py-0.5 bg-gray-800 text-gray-400 rounded">{platform}</span>
										{/each}
										{#if item.platforms.length > 3}
											<span class="text-xs text-gray-600">+{item.platforms.length - 3}</span>
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
