<script lang="ts">
	import { goto } from '$app/navigation';
	import Card from '$lib/components/ui/Card.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import { searchState } from '$lib/stores/search.svelte';
	import type { MediaType } from '$lib/db/schema';

	const categories: { type: MediaType; label: string; icon: string; desc: string; badge: string; color: string }[] = [
		{ type: 'film', label: 'Movies', icon: '🎬', desc: 'Blockbusters, indie cinema, and classics', badge: 'TMDB', color: 'from-amber-500/20 to-orange-500/20' },
		{ type: 'tv', label: 'TV Shows', icon: '📺', desc: 'Series, miniseries, and seasonal shows', badge: 'TMDB', color: 'from-blue-500/20 to-indigo-500/20' },
		{ type: 'anime', label: 'Anime', icon: '🌸', desc: 'Simulcasts, seasonal anime, and movies', badge: 'AniList', color: 'from-pink-500/20 to-rose-500/20' },
		{ type: 'game', label: 'Video Games', icon: '🎮', desc: 'PC, console, and handheld titles', badge: 'RAWG / IGDB', color: 'from-emerald-500/20 to-teal-500/20' },
		{ type: 'manga', label: 'Manga & Manhwa', icon: '📖', desc: 'Serialized manga, manhwa, and webtoons', badge: 'AniList', color: 'from-purple-500/20 to-violet-500/20' },
		{ type: 'book', label: 'Books', icon: '📚', desc: 'Novels, non-fiction, and literature', badge: 'OpenLibrary', color: 'from-yellow-500/20 to-amber-500/20' },
		{ type: 'comic', label: 'Comics', icon: '🦸', desc: 'American comic books and graphic novels', badge: 'ComicVine', color: 'from-cyan-500/20 to-sky-500/20' }
	];

	function exploreType(type: MediaType) {
		searchState.selectedType = type;
		goto(`/search?type=${type}`);
	}
</script>

<svelte:head>
	<title>Catalogue · Traxy</title>
</svelte:head>

<div class="space-y-6 max-w-5xl mx-auto">
	<SectionHeader
		title="Catalogue & Discovery"
		subtitle="Browse and discover media across entertainment domains."
	/>

	<!-- Category Grid -->
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
		{#each categories as cat}
			<button
				type="button"
				onclick={() => exploreType(cat.type)}
				class="text-left p-5 rounded-2xl bg-[#121422]/80 hover:bg-[#181c32]/80 border border-white/[0.08] hover:border-indigo-500/40 transition-all duration-200 cursor-pointer shadow-lg hover:shadow-indigo-500/10 group flex flex-col justify-between gap-4"
			>
				<div class="space-y-3">
					<div class="flex items-center justify-between">
						<div class="w-12 h-12 rounded-2xl bg-gradient-to-tr {cat.color} border border-white/[0.1] flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
							{cat.icon}
						</div>
						<Badge variant="indigo">{cat.badge}</Badge>
					</div>
					<div>
						<h3 class="font-bold text-white text-base group-hover:text-indigo-400 transition-colors">
							{cat.label}
						</h3>
						<p class="text-xs text-slate-400 mt-1 leading-relaxed">
							{cat.desc}
						</p>
					</div>
				</div>

				<div class="flex items-center text-xs font-semibold text-indigo-400 group-hover:translate-x-1 transition-transform">
					<span>Browse {cat.label} →</span>
				</div>
			</button>
		{/each}
	</div>
</div>
