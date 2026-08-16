<script lang="ts">
	// Stub — will be implemented during collections phase.
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>
<div class="max-w-4xl mx-auto">
	<p class="text-text-muted">Collection: {data.collectionId}</p>
</div>