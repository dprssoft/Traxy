<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import CatalogueRow from '$lib/components/CatalogueRow.svelte';
	import { searchState } from '$lib/stores/search.svelte';
	import { getMediaByExternalId, upsertMedia } from '$lib/db/services/media.service';
	import { getTmdbDetails } from '$lib/db/sources/tmdb';
	import { getRawgDetails } from '$lib/db/sources/rawg';
	import { getAnilistDetails } from '$lib/db/sources/anilist';
	import { getComicVineDetails } from '$lib/db/sources/comicvine';
	import { getOpenLibraryDetails } from '$lib/db/sources/openlibrary';
	import {
		discoverMedia,
		CATEGORIES,
		recordVisitedMedia,
		getCatalogueCacheBatch,
		type DiscoverCategory,
	} from '$lib/db/services/catalogue.service';
	import type { SearchResult } from '$lib/types/mediaTypes';
	import type { MediaType } from '$lib/db/schema';

	// ── Media type dropdown options ──────────────────────────────────────────
	const specificTypeOptions: {
		value: MediaType;
		label: string;
		icon: string;
	}[] = [
		{ value: 'film', label: 'Films', icon: '🎬' },
		{ value: 'tv', label: 'TV Shows', icon: '📺' },
		{ value: 'anime', label: 'Anime', icon: '🌸' },
		{ value: 'game', label: 'Games', icon: '🎮' },
		{ value: 'manga', label: 'Manga', icon: '📖' },
		{ value: 'book', label: 'Books', icon: '📚' },
		{ value: 'comic', label: 'Comics', icon: '🦸' },
	];

	let selectedType = $state<MediaType | 'all'>('all');
	let dropdownLastSelected = $state<MediaType>('film');
	let dropdownOpen = $state(false);
	let dropdownEl = $state<HTMLElement | null>(null);

	const activeTypeOption = $derived.by(() => {
		if (selectedType !== 'all') {
			return specificTypeOptions.find((opt) => opt.value === selectedType) ?? specificTypeOptions[0];
		}
		return specificTypeOptions.find((opt) => opt.value === dropdownLastSelected) ?? specificTypeOptions[0];
	});

	// ── Category row data ────────────────────────────────────────────────────
	let categoryData = $state<Record<DiscoverCategory, SearchResult[]>>({
		trending: [],
		new: [],
		top_rated: [],
		random: [],
		visited: [],
	});

	let categoryLoading = $state<Record<DiscoverCategory, boolean>>({
		trending: true,
		new: true,
		top_rated: true,
		random: true,
		visited: true,
	});

	let categoryError = $state<Record<DiscoverCategory, boolean>>({
		trending: false,
		new: false,
		top_rated: false,
		random: false,
		visited: false,
	});

	// ── Pull to Refresh ────────────────────────────────────────────────────────
	let touchStartY = 0;
	let touchCurrentY = 0;
	let isPulling = $state(false);
	const PULL_THRESHOLD = 80;

	function handleTouchStart(e: TouchEvent) {
		if (window.scrollY === 0) {
			touchStartY = e.touches[0].clientY;
		} else {
			touchStartY = 0;
		}
	}

	function handleTouchMove(e: TouchEvent) {
		if (touchStartY === 0) return;
		touchCurrentY = e.touches[0].clientY;
		const pullDist = touchCurrentY - touchStartY;
		
		if (pullDist > 0) {
			isPulling = pullDist > PULL_THRESHOLD;
		}
	}

	async function handleTouchEnd() {
		if (touchStartY === 0) return;
		const pullDist = touchCurrentY - touchStartY;
		
		if (pullDist > PULL_THRESHOLD) {
			isPulling = true;
			await loadAllCategories(true);
			isPulling = false;
		} else {
			isPulling = false;
		}
		
		touchStartY = 0;
		touchCurrentY = 0;
	}

	// ── Lifecycle ─────────────────────────────────────────────────────────────
	let refreshInterval: ReturnType<typeof setInterval>;

	onMount(() => {
		const storedFilter = sessionStorage.getItem('traxy:catalogue_filter');
		if (storedFilter) {
			selectedType = storedFilter as MediaType | 'all';
			if (storedFilter !== 'all') {
				dropdownLastSelected = storedFilter as MediaType;
			}
		}

		loadAllCategories();

		function handlePointerDown(e: MouseEvent) {
			if (dropdownOpen && dropdownEl && !dropdownEl.contains(e.target as Node)) {
				dropdownOpen = false;
			}
		}

		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === 'Escape' && dropdownOpen) {
				dropdownOpen = false;
			}
		}

		window.addEventListener('pointerdown', handlePointerDown);
		window.addEventListener('keydown', handleKeyDown);

		refreshInterval = setInterval(() => {
			if (document.visibilityState === 'visible') {
				loadAllCategories(false, true); // silent refresh
			}
		}, 15 * 60 * 1000);

		return () => {
			window.removeEventListener('pointerdown', handlePointerDown);
			window.removeEventListener('keydown', handleKeyDown);
			clearInterval(refreshInterval);
		};
	});

	async function loadAllCategories(forceRefresh = false, silent = false) {
		for (const cat of CATEGORIES) {
			categoryError[cat.id] = false;
		}

		// ── Warm cache in one batch SQLite query ──────────────────────────────────
		if (!forceRefresh && !silent) {
			const catIds = CATEGORIES.map((c) => c.id);
			const cached = await getCatalogueCacheBatch(selectedType, catIds);
			for (const cat of CATEGORIES) {
				const hit = cached[cat.id];
				if (hit && hit.length > 0) {
					categoryData[cat.id] = hit;
					categoryLoading[cat.id] = false;
				} else {
					categoryLoading[cat.id] = true;
				}
			}
		} else if (!silent) {
			for (const cat of CATEGORIES) {
				categoryLoading[cat.id] = true;
			}
		}

		// ── Wave 1: Trending first so the user sees content ASAP ─────────────────
		try {
			const data = await discoverMedia(selectedType, 'trending', forceRefresh);
			categoryData['trending'] = data;
		} catch {
			categoryData['trending'] = [];
			categoryError['trending'] = true;
		} finally {
			if (!silent || forceRefresh) categoryLoading['trending'] = false;
		}

		// ── Wave 2: Remaining categories in parallel ──────────────────────────────
		const remainingCats = CATEGORIES.filter((c) => c.id !== 'trending');
		await Promise.allSettled(
			remainingCats.map(async (cat) => {
				try {
					const data = await discoverMedia(selectedType, cat.id, forceRefresh);
					categoryData[cat.id] = data;
				} catch {
					categoryData[cat.id] = [];
					categoryError[cat.id] = true;
				} finally {
					if (!silent || forceRefresh) categoryLoading[cat.id] = false;
				}
			}),
		);
	}

	function onTypeSelect(type: MediaType | 'all') {
		selectedType = type;
		sessionStorage.setItem('traxy:catalogue_filter', type);
		searchState.selectedType = type === 'all' ? 'all' : type;
		loadAllCategories();
	}

	function toggleDropdown(e: MouseEvent) {
		e.stopPropagation();
		dropdownOpen = !dropdownOpen;
	}

	function selectDropdownType(type: MediaType) {
		dropdownLastSelected = type;
		dropdownOpen = false;
		onTypeSelect(type);
	}

	// ── Navigation on click (same flow as Searchbar) ─────────────────────────
	async function onItemClick(item: SearchResult) {
		recordVisitedMedia(item);

		// 1. Check if already in local DB
		const existing = await getMediaByExternalId(item.source, item.externalId);
		if (existing) {
			goto(resolve(`/media/${existing.id}`));
			return;
		}

		// 2. Fetch full details from source
		let fullDetails: SearchResult | null = item;

		if (item.source === 'tmdb')
			fullDetails = await getTmdbDetails(item.externalId, item.type as 'film' | 'tv');
		else if (item.source === 'rawg' || item.source === 'igdb')
			fullDetails = await getRawgDetails(item.externalId);
		else if (item.source === 'anilist')
			fullDetails = await getAnilistDetails(parseInt(item.externalId));
		else if (item.source === 'comicvine')
			fullDetails = await getComicVineDetails(item.externalId);
		else if (item.source === 'openlibrary')
			fullDetails = await getOpenLibraryDetails(item.externalId);

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

		recordVisitedMedia(inserted);

		// 4. Navigate
		goto(resolve(`/media/${inserted.id}`));
	}
</script>

<svelte:head>
	<title>Catalogue · Traxy</title>
</svelte:head>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div 
	class="space-y-6 max-w-6xl mx-auto pb-10 min-h-screen"
	ontouchstart={handleTouchStart}
	ontouchmove={handleTouchMove}
	ontouchend={handleTouchEnd}
>
	<!-- Pull to refresh indicator -->
	<div 
		class="flex justify-center transition-all duration-300 overflow-hidden" 
		style="height: {isPulling ? '40px' : '0px'}; opacity: {isPulling ? '1' : '0'}; margin-top: {isPulling ? '16px' : '0'};"
	>
		<div class="bg-[#181c32] rounded-full h-10 shadow-lg shadow-black/50 border border-white/[0.08] flex items-center gap-2 px-4 text-xs font-medium text-slate-300">
			<svg class="w-4 h-4 animate-spin text-indigo-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
				<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" class="opacity-25"></circle>
				<path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor" class="opacity-75"></path>
			</svg>
			Refreshing...
		</div>
	</div>

	<!-- ═══════ Filter Header matching Wireframe: [All] [Films ▼] ═══════ -->
	<div class="flex items-center gap-2.5 pt-1 px-1">
		<!-- "All" Button -->
		<button
			type="button"
			onclick={() => onTypeSelect('all')}
			class="h-10 px-5 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer shrink-0 border
				{selectedType === 'all'
				? 'bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-500/25 ring-1 ring-indigo-400/40'
				: 'bg-[#131627] text-slate-400 hover:text-white hover:bg-[#1a1e35] border-white/[0.08] hover:border-indigo-500/30'}"
		>
			All
		</button>

		<!-- Dropdown selector: [Films ▼] -->
		<div class="relative flex-1 sm:flex-initial sm:min-w-[180px]" bind:this={dropdownEl}>
			<button
				type="button"
				onclick={toggleDropdown}
				aria-haspopup="listbox"
				aria-expanded={dropdownOpen}
				class="w-full h-10 px-4 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer flex items-center justify-between gap-3 border
					{selectedType !== 'all'
					? 'bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-500/25 ring-1 ring-indigo-400/40'
					: 'bg-[#131627] text-slate-200 hover:text-white hover:bg-[#1a1e35] border-white/[0.08] hover:border-indigo-500/30'}"
			>
				<span class="truncate flex items-center gap-2">
					<span>{activeTypeOption.icon}</span>
					<span>{activeTypeOption.label}</span>
				</span>
				<svg
					class="w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 {dropdownOpen ? 'rotate-180 text-white' : ''}"
					fill="currentColor"
					viewBox="0 0 20 20"
				>
					<path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
				</svg>
			</button>

			<!-- Dropdown Menu -->
			{#if dropdownOpen}
				<div
					class="absolute left-0 top-full mt-1.5 w-full sm:w-56 bg-[#101322]/95 backdrop-blur-xl border border-white/[0.12] rounded-2xl shadow-2xl p-1.5 z-50 space-y-0.5"
					role="listbox"
				>
					{#each specificTypeOptions as opt (opt.value)}
						<button
							type="button"
							role="option"
							aria-selected={selectedType === opt.value}
							onclick={() => selectDropdownType(opt.value)}
							class="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors cursor-pointer
								{selectedType === opt.value
								? 'bg-indigo-600/30 text-indigo-300 font-bold border border-indigo-500/30'
								: 'text-slate-300 hover:bg-white/[0.06] hover:text-white border border-transparent'}"
						>
							<span class="flex items-center gap-2.5">
								<span class="text-base">{opt.icon}</span>
								<span>{opt.label}</span>
							</span>
							{#if selectedType === opt.value}
								<svg class="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
									<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
								</svg>
							{/if}
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<div class="flex-1"></div>

		<!-- Refresh Button -->
		<button
			type="button"
			onclick={() => loadAllCategories(true)}
			class="h-10 px-4 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer shrink-0 border bg-[#131627] text-slate-400 hover:text-white hover:bg-[#1a1e35] border-white/[0.08] hover:border-indigo-500/30 flex items-center gap-2"
			title="Refresh"
		>
			<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
			</svg>
			<span class="hidden sm:inline">Refresh</span>
		</button>
	</div>

	<!-- ═══════ Category Rows (Trending, New Releases, Top Rated, Random, Visited Earlier) ═══════ -->
	<div class="space-y-7 sm:space-y-8">
		{#each CATEGORIES as cat (cat.id)}
			<CatalogueRow
				title={cat.id === 'top_rated' && selectedType === 'book' ? 'Popular This Year' : cat.label}
				items={categoryData[cat.id]}
				loading={categoryLoading[cat.id]}
				error={categoryError[cat.id]}
				{onItemClick}
				emptyMessage={cat.id === 'visited'
					? 'No recently visited media yet'
					: selectedType === 'all'
					? 'No results available for this category'
					: `No ${cat.label.toLowerCase()} available for this type`}
			/>
		{/each}
	</div>

	<!-- ═══════ Quick links to Search ═══════ -->
	<div class="flex items-center justify-center pt-2">
		<a
			href={resolve('/search')}
			class="inline-flex items-center gap-2 px-5 py-2 text-xs sm:text-sm font-medium text-slate-400 hover:text-white bg-[#121422]/60 hover:bg-[#181c32] border border-white/[0.08] hover:border-indigo-500/30 rounded-xl transition-all"
		>
			<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<circle cx="11" cy="11" r="8"></circle>
				<line x1="21" y1="21" x2="16.65" y2="16.65"></line>
			</svg>
			Search by title instead
		</a>
	</div>
</div>
