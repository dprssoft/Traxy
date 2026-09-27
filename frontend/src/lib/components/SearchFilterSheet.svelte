<!--
@component
Bottom sheet with the search results page's secondary filters: year range, sort, library and
game platform. Every change is reported straight away through `onchange`, so the grid behind
the sheet updates live.
-->
<script lang="ts">
	import { Button, ChipGroup, Modal } from '$lib/components/ui';
	import {
		DEFAULT_SEARCH_FILTERS,
		LIBRARY_LABELS,
		SORT_LABELS,
		yearPresets,
		type LibraryFilter,
		type SearchFilters,
		type SearchSort,
	} from '$lib/utils/searchFilters';

	interface Props {
		open: boolean;
		filters: SearchFilters;
		/** Platforms found among the game results; the platform filter is hidden when empty. */
		platforms: string[];
		onchange: (patch: Partial<SearchFilters>) => void;
	}

	let { open = $bindable(), filters, platforms, onchange }: Props = $props();

	const presets = yearPresets();
	const activePreset = $derived(
		presets.find((p) => p.from === filters.yearFrom && p.to === filters.yearTo)?.id,
	);
	const sortOptions = Object.entries(SORT_LABELS).map(([value, label]) => ({
		value: value as SearchSort,
		label,
	}));
	const libraryOptions = Object.entries(LIBRARY_LABELS).map(([value, label]) => ({
		value: value as LibraryFilter,
		label,
	}));
	// Keep selected platforms listed even when the current results no longer include them.
	const platformChoices = $derived(
		[...new Set([...filters.platforms, ...platforms])].map((p) => ({ value: p, label: p })),
	);

	function selectPreset([id]: string[]) {
		const preset = presets.find((p) => p.id === id);
		onchange({ yearFrom: preset?.from, yearTo: preset?.to });
	}

	function setYear(key: 'yearFrom' | 'yearTo', value: string) {
		const year = Number(value);
		onchange({ [key]: value && Number.isInteger(year) && year > 0 ? year : undefined });
	}

	function clearAll() {
		const { sort, library, platforms: none } = DEFAULT_SEARCH_FILTERS;
		onchange({ yearFrom: undefined, yearTo: undefined, sort, library, platforms: none });
	}

	const inputClass =
		'w-24 bg-[#0a0b12] border border-white/[0.1] rounded-xl p-1.5 text-center text-white font-bold text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20';
</script>

<Modal bind:open title="Filters">
	<div class="space-y-6">
		<section class="space-y-2.5">
			<h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider">Year</h3>
			<ChipGroup
				label="Year range"
				wrap
				options={presets.map((p) => ({ value: p.id, label: p.label }))}
				selected={activePreset ? [activePreset] : []}
				onchange={selectPreset}
			/>
			<div class="flex items-center gap-2 text-sm text-slate-400">
				<input
					type="number"
					inputmode="numeric"
					aria-label="From year"
					placeholder="From"
					value={filters.yearFrom ?? ''}
					onchange={(e) => setYear('yearFrom', e.currentTarget.value)}
					class={inputClass}
				/>
				<span>–</span>
				<input
					type="number"
					inputmode="numeric"
					aria-label="To year"
					placeholder="To"
					value={filters.yearTo ?? ''}
					onchange={(e) => setYear('yearTo', e.currentTarget.value)}
					class={inputClass}
				/>
			</div>
			<p class="text-[11px] text-slate-500">Results without a known year are hidden.</p>
		</section>

		<section class="space-y-2.5">
			<h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider">Sort by</h3>
			<ChipGroup
				label="Sort by"
				wrap
				allowEmpty={false}
				options={sortOptions}
				selected={[filters.sort]}
				onchange={([sort]) => onchange({ sort })}
			/>
		</section>

		<section class="space-y-2.5">
			<h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider">Library</h3>
			<ChipGroup
				label="Library"
				wrap
				allowEmpty={false}
				options={libraryOptions}
				selected={[filters.library]}
				onchange={([library]) => onchange({ library })}
			/>
		</section>

		{#if platformChoices.length > 0}
			<section class="space-y-2.5">
				<h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider">Game platform</h3>
				<ChipGroup
					label="Game platform"
					wrap
					multiple
					options={platformChoices}
					selected={filters.platforms}
					onchange={(selected) => onchange({ platforms: selected })}
				/>
			</section>
		{/if}
	</div>

	{#snippet footer()}
		<div class="flex items-center justify-between gap-3">
			<Button variant="ghost" onclick={clearAll}>Clear all</Button>
			<Button onclick={() => (open = false)}>Show results</Button>
		</div>
	{/snippet}
</Modal>
