<script lang="ts">
	import type { PageData } from './$types';
	import MediaPageView from '$lib/components/MediaPageView.svelte';

	let { data }: { data: PageData } = $props();
</script>

<MediaPageView media={data.media} tracking={data.tracking} cycles={data.cycles} showCountryFlags={data.showCountryFlags} />