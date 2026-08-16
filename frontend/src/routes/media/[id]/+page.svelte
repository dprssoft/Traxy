<script lang="ts">
	import type { PageData } from './$types';
	import MediaPageView from '$lib/components/MediaPageView.svelte';

	let { data }: { data: PageData } = $props();
</script>

<div class="max-w-6xl mx-auto py-8 px-4">
	<MediaPageView media={data.media} tracking={data.tracking} cycles={data.cycles} />
</div>