<script lang="ts">
	import MalImport from '$lib/components/MalImport.svelte';
	import AnilistImport from '$lib/components/AnilistImport.svelte';
	import TmdbImport from '$lib/components/TmdbImport.svelte';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';

	const importers = [
		{
			title: 'MyAnimeList XML Import',
			desc: 'Import your anime & manga tracking list exported from MyAnimeList.',
		},
		{
			title: 'AniList Import',
			desc: 'Import directly using your AniList username (public profiles only).',
		},
		{
			title: 'TMDB Import',
			desc: 'Import your watchlist and rated media from TMDB.',
		},
	];
</script>

<div class="space-y-5">
	<SectionHeader
		title="Import"
		subtitle="Import your existing tracking lists from external services."
	/>

	<div class="space-y-4">
		<!-- MAL -->
		<div class="p-5 rounded-2xl bg-[#16192b]/60 border border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
			<div>
				<h4 class="font-bold text-white text-sm">{importers[0].title}</h4>
				<p class="text-xs text-slate-400 mt-0.5">{importers[0].desc}</p>
			</div>
			<MalImport />
		</div>

		<!-- AniList -->
		<div class="p-5 rounded-2xl bg-[#16192b]/60 border border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
			<div>
				<h4 class="font-bold text-white text-sm">{importers[1].title}</h4>
				<p class="text-xs text-slate-400 mt-0.5">{importers[1].desc}</p>
			</div>
			<AnilistImport />
		</div>

		<!-- TMDB -->
		<div class="p-5 rounded-2xl bg-[#16192b]/60 border border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
			<div>
				<h4 class="font-bold text-white text-sm">{importers[2].title}</h4>
				<p class="text-xs text-slate-400 mt-0.5">{importers[2].desc}</p>
			</div>
			<TmdbImport />
		</div>
	</div>
</div>
