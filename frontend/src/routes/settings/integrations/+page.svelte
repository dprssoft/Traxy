<script lang="ts">
	import { untrack } from 'svelte';
	import type { PageData } from './$types';
	import { SectionHeader, Toggle } from '$lib/components/ui';
	import { setWikiEnrichmentEnabled } from '$lib/db/services/settings.service';

	let { data }: { data: PageData } = $props();
	let wikiEnabled = $state(untrack(() => data.wikiEnabled));

	async function toggleWiki(value: boolean) {
		wikiEnabled = value;
		await setWikiEnrichmentEnabled(value);
	}
</script>

<div class="space-y-5">
	<SectionHeader
		title="Integrations"
		subtitle="Optional data sources that add to what your main providers return."
	/>

	<div
		class="p-5 rounded-2xl bg-[#16192b]/60 border border-white/[0.06] flex items-center justify-between gap-4"
	>
		<div>
			<label for="wiki-enrichment" class="font-bold text-white text-sm cursor-pointer">
				Wikipedia enrichment
			</label>
			<p class="text-xs text-slate-400 mt-0.5">
				Fill in missing author, country, genres, episode and page counts from Wikidata, and link
				each title to its Wikipedia article. Existing data is never overwritten. No API key
				required.
			</p>
		</div>
		<Toggle
			id="wiki-enrichment"
			checked={wikiEnabled}
			onchange={toggleWiki}
			label="Wikipedia enrichment"
		/>
	</div>
</div>
