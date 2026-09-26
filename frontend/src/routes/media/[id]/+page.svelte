<script lang="ts">
	import type { PageData } from './$types';
	import type { LocalMedia } from '$lib/types/mediaTypes';
	import MediaPageView from '$lib/components/MediaPageView.svelte';

	let { data }: { data: PageData } = $props();

	let enriched = $state<{ media: LocalMedia; wikipediaUrl: string | null } | null>(null);

	$effect(() => {
		const pending = data.enriched;
		enriched = null;
		pending.then((result) => {
			// Ignore a result that arrives after navigating to another media
			if (data.enriched === pending) enriched = result;
		});
	});
</script>

<MediaPageView
	media={enriched?.media ?? data.media}
	tracking={data.tracking}
	cycles={data.cycles}
	showCountryFlags={data.showCountryFlags}
	wikipediaUrl={enriched?.wikipediaUrl ?? null}
/>
