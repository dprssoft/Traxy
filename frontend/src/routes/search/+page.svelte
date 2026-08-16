<script lang="ts">
	import Searchbar from '$lib/components/Searchbar.svelte';
</script>

<div class="flex flex-col items-center justify-start min-h-[60vh] pt-8 sm:pt-14 px-4 space-y-8 max-w-2xl mx-auto text-center">
	<div>
		<div class="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center text-3xl shadow-xl shadow-indigo-500/25 mb-4">
			🔍
		</div>
		<h1 class="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">Explore & Search</h1>
		<p class="text-xs sm:text-sm text-slate-400 mt-2 max-w-md">
			Find movies, TV series, anime, video games, manga, books, and comics across all connected public databases.
		</p>
	</div>
	
	<div class="w-full">
		<Searchbar />
	</div>

	<div class="flex flex-wrap items-center justify-center gap-2 pt-4">
		<span class="text-xs text-slate-500 font-medium">Supported sources:</span>
		<span class="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">TMDB</span>
		<span class="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">IGDB / RAWG</span>
		<span class="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-pink-500/10 text-pink-400 border border-pink-500/20">AniList</span>
		<span class="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">ComicVine</span>
		<span class="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">OpenLibrary</span>
	</div>
</div>

