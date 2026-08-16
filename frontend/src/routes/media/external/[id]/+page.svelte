<script lang="ts">
	import type { PageData } from './$types';
	// Stub — external media detail page. Will be unified with /media/[id] in 4E.
	let { data }: { data: PageData } = $props();
</script>
<div class="max-w-4xl mx-auto">
	<p class="text-text-muted text-sm">External media: {data.id}</p>
</div>