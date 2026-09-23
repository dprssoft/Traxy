<script lang="ts">
	import { SectionHeader, Toggle, Select } from '$lib/components/ui';
	import { contentFilterStore } from '$lib/stores/contentFilter.svelte';
	import {
		setContentFilterEnabled,
		setContentFilterMode,
		type AdultFilterMode,
	} from '$lib/db/services/settings.service';

	const modeOptions = [
		{ value: 'hide', label: 'Hide adult titles' },
		{ value: 'blur', label: 'Show with blurred artwork' },
	];

	const coverage = [
		{ source: 'TMDB (films & TV)', how: 'Provider adult flag' },
		{ source: 'AniList (anime & manga)', how: 'Provider adult flag' },
		{ source: 'IGDB (games)', how: '"Erotic" theme' },
		{ source: 'Flashpoint (games)', how: 'Adult content tags' },
		{ source: 'ComicVine (comics)', how: 'Keywords in title & description — best effort' },
		{ source: 'Open Library (books)', how: 'Keywords in subject tags — best effort' },
	];

	async function toggleEnabled(value: boolean) {
		contentFilterStore.setEnabled(value);
		await setContentFilterEnabled(value);
	}

	async function changeMode(value: string) {
		const mode = value as AdultFilterMode;
		contentFilterStore.setMode(mode);
		await setContentFilterMode(mode);
	}
</script>

<div class="space-y-5">
	<SectionHeader
		title="Content Filter"
		subtitle="Control how adult (18+) titles appear in search, the catalogue and your library."
	/>

	<div
		class="p-5 rounded-2xl bg-[#16192b]/60 border border-white/[0.06] flex items-center justify-between gap-4"
	>
		<div>
			<label for="adult-filter" class="font-bold text-white text-sm cursor-pointer">
				Filter adult content
			</label>
			<p class="text-xs text-slate-400 mt-0.5">When off, everything is shown unfiltered.</p>
		</div>
		<Toggle
			id="adult-filter"
			checked={contentFilterStore.enabled}
			onchange={toggleEnabled}
			label="Filter adult content"
		/>
	</div>

	{#if contentFilterStore.enabled}
		<div class="p-5 rounded-2xl bg-[#16192b]/60 border border-white/[0.06] space-y-3">
			<div>
				<label for="adult-filter-mode" class="font-bold text-white text-sm">
					Adult titles in search & catalogue
				</label>
				<p class="text-xs text-slate-400 mt-0.5">
					Titles you already track are never hidden — their artwork is blurred instead.
				</p>
			</div>
			<Select
				id="adult-filter-mode"
				options={modeOptions}
				value={contentFilterStore.mode}
				onchange={changeMode}
			/>
		</div>
	{/if}

	<div class="p-5 rounded-2xl bg-[#16192b]/60 border border-white/[0.06] space-y-3">
		<h3 class="font-bold text-white text-sm">How adult content is detected</h3>
		<ul class="space-y-2">
			{#each coverage as c (c.source)}
				<li class="flex items-baseline justify-between gap-4 text-xs">
					<span class="text-slate-200 font-semibold">{c.source}</span>
					<span class="text-slate-400 text-right">{c.how}</span>
				</li>
			{/each}
		</ul>
	</div>
</div>
