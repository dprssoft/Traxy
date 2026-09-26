<script lang="ts">
	import { onMount } from 'svelte';
	import { searchPrefsStore } from '$lib/stores/searchPrefs.svelte';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import Toggle from '$lib/components/ui/Toggle.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { animeSeasonsStore } from '$lib/stores/animeSeasons.svelte';
	import { setMergeAnimeSeasonsEnabled } from '$lib/db/services/settings.service';
	import {
		hasAnimeMergeBackup,
		mergeAnimeSeasonsInLibrary,
		restoreAnimeMergeBackup,
	} from '$lib/db/services/animeSeries.service';

	let mergeChecked = $state(animeSeasonsStore.mergeEnabled);
	let merging = $state(false);
	let mergeProgress = $state('');
	let hasBackup = $state(false);

	onMount(() => {
		searchPrefsStore.load();
		hasAnimeMergeBackup().then((v) => (hasBackup = v));
	});

	async function toggleMergeSeasons(enabled: boolean) {
		if (
			enabled &&
			!confirm(
				'Merge anime seasons into one item per series?\n\nTracked seasons are combined: furthest episode, combined status, latest score and all notes. A backup is saved first so you can undo this.',
			)
		) {
			mergeChecked = false;
			return;
		}
		animeSeasonsStore.setMergeEnabled(enabled);
		await setMergeAnimeSeasonsEnabled(enabled);
		if (!enabled) return;

		merging = true;
		try {
			const { merged, pending } = await mergeAnimeSeasonsInLibrary((done, total) => {
				mergeProgress = `Merging… ${done}/${total}`;
			});
			mergeProgress =
				`Merged ${merged} series.` +
				(pending ? ` ${pending} couldn't be reached and will be retried on next launch.` : '');
			hasBackup = true;
		} catch (err) {
			console.error(err);
			mergeProgress = 'Merge failed — nothing after the failing series was changed.';
		} finally {
			merging = false;
		}
	}

	async function restoreBackup() {
		if (!confirm('Restore your library as it was before the last merge? Changes since then are lost.')) {
			return;
		}
		await restoreAnimeMergeBackup();
		animeSeasonsStore.setMergeEnabled(false);
		mergeChecked = false;
		hasBackup = false;
		mergeProgress = 'Library restored. Anime seasons are separate items again.';
	}

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
		{
			id: 'pref-flashpoint',
			label: 'Include Flashpoint Archive in game search',
			hint: 'Search the Flashpoint Archive (~200k Flash, HTML5, and Shockwave games) alongside IGDB. Disabled by default. No API key required.',
			get: () => searchPrefsStore.current.flashpointEnabled,
			set: (v) =>
				searchPrefsStore.save({ ...searchPrefsStore.current, flashpointEnabled: v }),
		},
	];
</script>

<div class="space-y-5">
	<SectionHeader
		title="Search & Deduplication"
		subtitle="Configure cross-source priority rules and duplicate entry suppression."
	/>

	<div class="space-y-3">
		{#each settings as s (s.id)}
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

		<div class="p-4 rounded-xl bg-[#16192b]/60 border border-white/[0.06] space-y-3">
			<div class="flex items-start justify-between gap-4">
				<div class="min-w-0">
					<label for="pref-merge-seasons" class="text-sm font-semibold text-white cursor-pointer">
						Merge anime seasons into one item
					</label>
					<p class="text-xs text-slate-400 mt-0.5 leading-relaxed">
						Show and track an anime series (e.g. Tokyo Revengers and its sequels) as one item with
						seasons, like TV shows. Movies and OVAs stay separate. Turning this off doesn't split
						merged series again.
					</p>
				</div>
				<Toggle
					id="pref-merge-seasons"
					bind:checked={mergeChecked}
					onchange={toggleMergeSeasons}
					disabled={merging}
					label="Merge anime seasons into one item"
				/>
			</div>
			{#if mergeProgress}
				<p class="text-xs text-slate-300">{mergeProgress}</p>
			{/if}
			{#if hasBackup && !merging}
				<Button variant="secondary" size="sm" onclick={restoreBackup}>
					Restore pre-merge backup
				</Button>
			{/if}
		</div>
	</div>
</div>
