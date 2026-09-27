<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';
	import type { CollectionInput } from '$lib/types/collectionTypes';
	import { deleteCollection, updateCollection } from '$lib/db/services/collection.service';
	import CollectionForm from '$lib/components/CollectionForm.svelte';
	import { Button, Card, Modal, SectionHeader } from '$lib/components/ui';

	let { data }: { data: PageData } = $props();

	const collection = $derived(data.collection);
	let showDelete = $state(false);
	let deleting = $state(false);

	async function handleSave(input: CollectionInput) {
		await updateCollection(
			collection.id,
			collection.systemKey
				? { description: input.description, isRanked: input.isRanked }
				: input,
		);
		await goto(resolve(`/collections/${collection.id}`));
	}

	async function handleDelete() {
		deleting = true;
		try {
			await deleteCollection(collection.id);
			showDelete = false;
			await goto(resolve('/collections'));
		} finally {
			deleting = false;
		}
	}
</script>

<svelte:head><title>Traxy · {collection.name} settings</title></svelte:head>

<div class="max-w-xl mx-auto space-y-6">
	<SectionHeader title="Collection settings" />

	<Card>
		{#if collection.systemKey}
			<p class="text-xs text-slate-400 mb-4">
				This is a built-in collection — its name and media type can't be changed.
			</p>
		{/if}
		<CollectionForm
			initial={collection}
			locked={!!collection.systemKey}
			onsubmit={handleSave}
			oncancel={() => goto(resolve(`/collections/${collection.id}`))}
		/>
	</Card>

	{#if !collection.systemKey}
		<Card class="border-rose-500/20">
			<div class="flex items-center justify-between gap-4">
				<div>
					<h3 class="text-sm font-bold text-white">Delete collection</h3>
					<p class="text-xs text-slate-400">The media stays in your library.</p>
				</div>
				<Button variant="danger" size="sm" onclick={() => (showDelete = true)}>Delete</Button>
			</div>
		</Card>
	{/if}
</div>

<Modal bind:open={showDelete} title="Delete collection?" size="sm">
	<p class="text-sm text-slate-300">
		“{collection.name}” will be deleted. The media in it stays in your library.
	</p>
	{#snippet footer()}
		<div class="flex justify-end gap-2">
			<Button variant="ghost" size="sm" onclick={() => (showDelete = false)}>Cancel</Button>
			<Button variant="danger" size="sm" loading={deleting} onclick={handleDelete}>Delete</Button>
		</div>
	{/snippet}
</Modal>
