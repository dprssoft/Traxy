<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>
<div class="max-w-4xl mx-auto p-4">
	<p class="text-white">Collection settings stub: {data.collectionId}</p>
</div>
