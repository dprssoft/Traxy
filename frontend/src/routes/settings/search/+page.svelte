<script lang="ts">
	import { onMount } from 'svelte';
	import { searchPrefsStore } from '$lib/stores/searchPrefs.svelte';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import Toggle from '$lib/components/ui/Toggle.svelte';

	onMount(() => {
		searchPrefsStore.load();
	});

	interface ToggleSetting {
		id: string;
		label: string;
		hint: string;
		get: () => boolean;
		set: (v: boolean) => void;
	}

	const settings: ToggleSetting[] = [
		{
			id: 'pref-anime',
			label: 'AniList wins for Anime vs TV',
			hint: 'If AniList has a title as anime (e.g. Jujutsu Kaisen), the same title from TMDB TV Series is hidden — even when filtering by TV.',
			get: () => searchPrefsStore.current.anilistWinsAnime,
			set: (v) => searchPrefsStore.save({ ...searchPrefsStore.current, anilistWinsAnime: v }),
		},
		{
			id: 'pref-manga',
			label: 'AniList wins for Manga vs Books',
			hint: 'If AniList has a title as manga/manhwa/manhua, the exact same title from OpenLibrary or ComicVine is hidden.',
			get: () => searchPrefsStore.current.anilistWinsManga,
			set: (v) => searchPrefsStore.save({ ...searchPrefsStore.current, anilistWinsManga: v }),
		},
		{
			id: 'pref-volumes',
			label: 'Suppress manga volume entries from OpenLibrary',
			hint: 'Hides "Gantz Volume 1", "Berserk Vol 38" etc. from OpenLibrary when AniList has the series. Disable if you track a non-manga book series that shares a name.',
			get: () => searchPrefsStore.current.suppressMangaVolumes,
			set: (v) =>
				searchPrefsStore.save({ ...searchPrefsStore.current, suppressMangaVolumes: v }),
		},
	];
</script>

<div class="space-y-5">
	<SectionHeader
		title="Search & Deduplication"
		subtitle="Configure cross-source priority rules and duplicate entry suppression."
	/>

	<div class="space-y-3">
		{#each settings as s}
			<div
				class="flex items-start justify-between gap-4 p-4 rounded-xl bg-[#16192b]/60 border border-white/[0.06]"
			>
				<div class="min-w-0">
					<label for={s.id} class="text-sm font-semibold text-white cursor-pointer">{s.label}</label>
					<p class="text-xs text-slate-400 mt-0.5 leading-relaxed">{s.hint}</p>
				</div>
				<Toggle id={s.id} checked={s.get()} onchange={s.set} label={s.label} />
			</div>
		{/each}
	</div>
</div>
