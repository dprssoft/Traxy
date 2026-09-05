<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
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
		type DiscoverCategory,
	} from '$lib/db/services/catalogue.service';
	import type { SearchResult } from '$lib/types/mediaTypes';
	import type { MediaType } from '$lib/db/schema';

	// ── Media type picker options ────────────────────────────────────────────
	const typeOptions: {
		value: MediaType | 'all';
		label: string;
		icon: string;
	}[] = [
		{ value: 'all', label: 'All', icon: '🌐' },
		{ value: 'film', label: 'Movies', icon: '🎬' },
		{ value: 'tv', label: 'TV Shows', icon: '📺' },
		{ value: 'anime', label: 'Anime', icon: '🌸' },
		{ value: 'game', label: 'Games', icon: '🎮' },
		{ value: 'manga', label: 'Manga', icon: '📖' },
		{ value: 'book', label: 'Books', icon: '📚' },
		{ value: 'comic', label: 'Comics', icon: '🦸' },
	];

	let selectedType = $state<MediaType | 'all'>('all');

	// ── Category row data ────────────────────────────────────────────────────
	let categoryData = $state<Record<DiscoverCategory, SearchResult[]>>({
		trending: [],
		new: [],
		top_rated: [],
		random: [],
	});

	let categoryLoading = $state<Record<DiscoverCategory, boolean>>({
		trending: true,
		new: true,
		top_rated: true,
		random: true,
	});

	// ── Lifecycle ─────────────────────────────────────────────────────────────
	onMount(() => {
		loadAllCategories();
	});

	async function loadAllCategories() {
		for (const cat of CATEGORIES) {
			categoryLoading[cat.id] = true;
		}

		// Fire all category fetches in parallel
		await Promise.allSettled(
			CATEGORIES.map(async (cat) => {
				try {
					categoryData[cat.id] = await discoverMedia(selectedType, cat.id);
				} catch {
					categoryData[cat.id] = [];
				} finally {
					categoryLoading[cat.id] = false;
				}
			}),
		);
	}

	function onTypeSelect(type: MediaType | 'all') {
		selectedType = type;
		searchState.selectedType = type === 'all' ? 'all' : type;
		loadAllCategories();
	}

	// ── Navigation on click (same flow as Searchbar) ─────────────────────────
	async function onItemClick(item: SearchResult) {
		// 1. Check if already in local DB
		const existing = await getMediaByExternalId(item.source, item.externalId);
		if (existing) {
			goto(`/media/${existing.id}`);
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

		// 4. Navigate
		goto(`/media/${inserted.id}`);
	}
</script>

<svelte:head>
	<title>Catalogue · Traxy</title>
</svelte:head>

<div class="space-y-6 max-w-6xl mx-auto pb-8">
	<SectionHeader
		title="Catalogue & Discovery"
		subtitle="Browse and discover media across entertainment domains."
	/>

	<!-- ═══════ Media Type Picker ═══════ -->
	<div
		class="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1"
	>
		{#each typeOptions as opt}
			<button
				type="button"
				onclick={() => onTypeSelect(opt.value)}
				class="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold whitespace-nowrap transition-all duration-200 cursor-pointer shrink-0 border
					{selectedType === opt.value
					? 'bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-500/25'
					: 'bg-[#121422]/80 text-slate-400 hover:text-white hover:bg-[#181c32] border-white/[0.08] hover:border-indigo-500/30'}"
			>
				<span class="text-base">{opt.icon}</span>
				<span>{opt.label}</span>
			</button>
		{/each}
	</div>

	<!-- ═══════ Category Rows ═══════ -->
	<div class="space-y-8">
		{#each CATEGORIES as cat (cat.id)}
			<CatalogueRow
				title={cat.label}
				items={categoryData[cat.id]}
				loading={categoryLoading[cat.id]}
				{onItemClick}
				emptyMessage={selectedType === 'all'
					? 'No results available for this category'
					: `No ${cat.label.toLowerCase().replace(/[^\w\s]/g, '').trim()} available for this type`}
			/>
		{/each}
	</div>

	<!-- ═══════ Quick links to Search ═══════ -->
	<div
		class="flex items-center justify-center pt-4"
	>
		<a
			href="/search"
			class="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-slate-400 hover:text-white bg-[#121422]/60 hover:bg-[#181c32] border border-white/[0.08] hover:border-indigo-500/30 rounded-2xl transition-all"
		>
			<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<circle cx="11" cy="11" r="8"></circle>
				<line x1="21" y1="21" x2="16.65" y2="16.65"></line>
			</svg>
			Search by title instead
		</a>
	</div>
</div>
