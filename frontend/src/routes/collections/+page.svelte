<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';
	import type { MediaType } from '$lib/db/schema';
	import type { CollectionInput } from '$lib/types/collectionTypes';
	import { MEDIA_TYPE_PLURAL_LABELS } from '$lib/constants';
	import { createCollection } from '$lib/db/services/collection.service';
	import CollectionCard from '$lib/components/CollectionCard.svelte';
	import CollectionForm from '$lib/components/CollectionForm.svelte';
	import { Button, EmptyState, Modal, Tabs } from '$lib/components/ui';

	let { data }: { data: PageData } = $props();

	// Empty system collections exist as soon as a picker opens — only show them once used.
	const collections = $derived(data.collections.filter((c) => !c.systemKey || c.itemCount > 0));

	let activeTab = $state('all');
	let showCreate = $state(false);

	const tabs = $derived.by(() => {
		const types = new Set(collections.map((c) => c.mediaType).filter((t): t is MediaType => !!t));
		return [
			{ id: 'all', label: 'All' },
			...(collections.some((c) => !c.mediaType) ? [{ id: 'shared', label: 'Shared' }] : []),
			...(Object.keys(MEDIA_TYPE_PLURAL_LABELS) as MediaType[])
				.filter((t) => types.has(t))
				.map((t) => ({ id: t, label: MEDIA_TYPE_PLURAL_LABELS[t] })),
		];
	});

	const visible = $derived(
		activeTab === 'all'
			? collections
			: activeTab === 'shared'
				? collections.filter((c) => !c.mediaType)
				: collections.filter((c) => c.mediaType === activeTab),
	);

	async function handleCreate(input: CollectionInput) {
		const created = await createCollection(input);
		showCreate = false;
		await goto(resolve(`/collections/${created.id}`));
	}
</script>

<svelte:head><title>Traxy · Collections</title></svelte:head>

<div class="max-w-5xl mx-auto space-y-6">
	<div class="flex items-center justify-between gap-3">
		<h1 class="text-2xl font-black text-white/95">Collections</h1>
		<Button size="sm" onclick={() => (showCreate = true)}>+ New collection</Button>
	</div>

	{#if collections.length === 0}
		<EmptyState
			dashed
			icon="🗂️"
			title="No collections yet"
			description="Group media into your own lists, or tap the heart on any title to start your favorites."
		>
			{#snippet action()}
				<Button size="sm" onclick={() => (showCreate = true)}>Create a collection</Button>
			{/snippet}
		</EmptyState>
	{:else}
		{#if tabs.length > 2}
			<Tabs {tabs} active={activeTab} onchange={(id) => (activeTab = id)} />
		{/if}

		<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
			{#each visible as collection (collection.id)}
				<CollectionCard {collection} />
			{/each}
		</div>
	{/if}
</div>

<Modal bind:open={showCreate} title="New collection" size="md">
	{#if showCreate}
		<CollectionForm
			submitLabel="Create"
			onsubmit={handleCreate}
			oncancel={() => (showCreate = false)}
		/>
	{/if}
</Modal>
