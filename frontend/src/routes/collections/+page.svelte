<script lang="ts">
	// Stub — will be implemented during collections phase (post-4B).
	// Collections are loaded from local SQLite via collection.service.ts.
	let showCreateModal = $state(false);
</script>

<svelte:head><title>Traxy · My Collections</title></svelte:head>

<div class="max-w-4xl mx-auto">
	<div class="flex items-center justify-between mb-8">
		<h1 class="text-2xl font-black text-white/95">My Collections</h1>
		<button
			onclick={() => (showCreateModal = true)}
			class="bg-brand-accent hover:bg-brand-hover text-white px-5 py-2 rounded-full font-bold text-sm transition-all"
		>+ New collection</button>
	</div>
	<div class="py-16 text-center text-text-muted border border-dashed border-gray-700 rounded-lg">
		<p class="text-sm">Loading collections...</p>
	</div>
</div>