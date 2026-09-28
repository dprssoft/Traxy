<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';
	import type { CollectionEntry } from '$lib/types/collectionTypes';
	import { MEDIA_TYPE_PLURAL_LABELS } from '$lib/constants';
	import {
		removeFromCollection,
		reorderCollection,
		updateEntryNote,
	} from '$lib/db/services/collection.service';
	import { setCrumbLabel, clearCrumbLabel } from '$lib/stores/breadcrumb';
	import { quickEdit } from '$lib/stores/quickEdit.svelte';
	import { downloadFile } from '$lib/utils/download';
	import {
		collectionExportFilename,
		formatCollectionJson,
		formatCollectionText,
	} from '$lib/utils/collectionExport';
	import CataloguePosterCard from '$lib/components/CataloguePosterCard.svelte';
	import { Badge, Button, EmptyState, Modal, Select } from '$lib/components/ui';

	let { data }: { data: PageData } = $props();

	const collection = $derived(data.collection);
	// Local copy: removals and reorders apply immediately.
	let entries = $derived<CollectionEntry[]>(data.entries);

	type SortOption = 'manual' | 'added' | 'title';
	let sort = $state<SortOption>('manual');
	let editing = $state(false);

	const sortOptions = [
		{ value: 'manual', label: 'My order' },
		{ value: 'added', label: 'Recently added' },
		{ value: 'title', label: 'Title' },
	];

	const sorted = $derived.by(() => {
		// Ranked lists always show the user's order — that order is the ranking.
		if (collection.isRanked) return entries;
		if (sort === 'added') return [...entries].sort((a, b) => b.addedAt.localeCompare(a.addedAt));
		if (sort === 'title')
			return [...entries].sort((a, b) => a.media.title.localeCompare(b.media.title));
		return entries;
	});
	const canReorder = $derived(editing && (collection.isRanked || sort === 'manual'));

	$effect(() => {
		const href = `/collections/${collection.id}`;
		setCrumbLabel(href, collection.name);
		return () => clearCrumbLabel(href);
	});

	async function remove(entry: CollectionEntry) {
		entries = entries.filter((e) => e.itemId !== entry.itemId);
		await removeFromCollection(collection.id, entry.media.id);
	}

	async function move(index: number, delta: -1 | 1) {
		const target = index + delta;
		if (target < 0 || target >= entries.length) return;
		const next = [...entries];
		[next[index], next[target]] = [next[target], next[index]];
		entries = next;
		await reorderCollection(
			collection.id,
			next.map((e) => e.media.id),
		);
	}

	// ── Export (in the order currently shown) ──────────────────────────────
	let copied = $state(false);

	async function copyAsText() {
		try {
			await navigator.clipboard.writeText(formatCollectionText(collection, sorted));
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch (err) {
			console.error('Failed to copy collection', err);
		}
	}

	async function exportJson() {
		try {
			await downloadFile(
				collectionExportFilename(collection, 'json'),
				formatCollectionJson(collection, sorted),
				'application/json',
			);
		} catch (err) {
			console.error('Failed to export collection', err);
		}
	}

	// ── Per-item note ────────────────────────────────────────────────────────
	let noteEntry = $state<CollectionEntry | null>(null);
	let noteDraft = $state('');
	let noteOpen = $state(false);

	function openNote(entry: CollectionEntry) {
		noteEntry = entry;
		noteDraft = entry.note ?? '';
		noteOpen = true;
	}

	async function saveNote() {
		if (!noteEntry) return;
		const note = noteDraft.trim();
		const itemId = noteEntry.itemId;
		await updateEntryNote(collection.id, noteEntry.media.id, note);
		entries = entries.map((e) => (e.itemId === itemId ? { ...e, note: note || undefined } : e));
		noteOpen = false;
	}
</script>

<svelte:head><title>Traxy · {collection.name}</title></svelte:head>

<div class="max-w-5xl mx-auto space-y-6">
	<!-- Header -->
	<div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
		<div class="min-w-0 space-y-2">
			<h1 class="text-2xl font-black text-white/95 break-words">{collection.name}</h1>
			{#if collection.description}
				<p class="text-sm text-slate-400">{collection.description}</p>
			{/if}
			<div class="flex items-center gap-1.5 flex-wrap">
				<span class="text-xs text-slate-400">
					{entries.length}
					{entries.length === 1 ? 'item' : 'items'}
				</span>
				<Badge variant={collection.mediaType ? 'indigo' : 'slate'} size="xs">
					{collection.mediaType ? MEDIA_TYPE_PLURAL_LABELS[collection.mediaType] : 'Shared'}
				</Badge>
				{#if collection.isRanked}
					<Badge variant="amber" size="xs">Ranked</Badge>
				{/if}
			</div>
		</div>

		<div class="flex items-center gap-2 shrink-0 flex-wrap">
			{#if entries.length > 0}
				<Button variant="secondary" size="sm" onclick={copyAsText}>
					{copied ? 'Copied ✓' : 'Copy list'}
				</Button>
				<Button variant="secondary" size="sm" onclick={exportJson}>Export JSON</Button>
				<Button
					variant={editing ? 'primary' : 'secondary'}
					size="sm"
					onclick={() => (editing = !editing)}
				>
					{editing ? 'Done' : 'Edit'}
				</Button>
			{/if}
			<Button
				variant="secondary"
				size="sm"
				onclick={() => goto(resolve(`/collections/${collection.id}/settings`))}
			>
				Settings
			</Button>
		</div>
	</div>

	{#if entries.length === 0}
		<EmptyState
			dashed
			icon="🗂️"
			title="This collection is empty"
			description="Open any title and use “Add To Collection” to put it here."
		/>
	{:else}
		{#if !collection.isRanked}
			<div class="flex items-center justify-end gap-2">
				<span class="text-xs text-slate-400">Sort</span>
				<Select options={sortOptions} bind:value={sort} class="w-44" />
			</div>
		{/if}

		<div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-4">
			{#each sorted as entry, i (entry.itemId)}
				<div class="min-w-0 space-y-1.5">
					<CataloguePosterCard
						item={entry.media}
						fluid
						rank={collection.isRanked ? i + 1 : undefined}
						onclick={() => goto(resolve(`/media/${entry.media.id}`))}
						onEdit={() => quickEdit.open(entry.media, { onClosed: invalidateAll })}
					/>
					{#if entry.note}
						<p class="text-[11px] text-slate-400 italic line-clamp-2 px-0.5" title={entry.note}>
							{entry.note}
						</p>
					{/if}
					{#if editing}
						<div class="flex items-center justify-center gap-1">
							{#if canReorder}
								<Button variant="icon" size="sm" disabled={i === 0} onclick={() => move(i, -1)}>
									<span class="sr-only">Move earlier</span>
									<span aria-hidden="true" class="text-xs leading-none">◀</span>
								</Button>
								<Button
									variant="icon"
									size="sm"
									disabled={i === sorted.length - 1}
									onclick={() => move(i, 1)}
								>
									<span class="sr-only">Move later</span>
									<span aria-hidden="true" class="text-xs leading-none">▶</span>
								</Button>
							{/if}
							<Button variant="icon" size="sm" onclick={() => openNote(entry)}>
								<span class="sr-only">Edit note</span>
								<span aria-hidden="true" class="text-xs leading-none">📝</span>
							</Button>
							<Button variant="icon" size="sm" onclick={() => remove(entry)}>
								<span class="sr-only">Remove from collection</span>
								<span aria-hidden="true" class="text-xs leading-none text-rose-400">✕</span>
							</Button>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<Modal bind:open={noteOpen} title="Item note" size="sm">
	<div class="space-y-3">
		<p class="text-xs text-slate-400 truncate">{noteEntry?.media.title}</p>
		<textarea
			bind:value={noteDraft}
			maxlength={255}
			rows="3"
			placeholder={collection.systemKey === 'wishlist'
				? 'e.g. €20 on GOG, wait for a sale'
				: 'Why is it here?'}
			class="w-full px-3 py-2 bg-[#181b2e] border border-white/[0.08] focus:border-indigo-500 rounded-xl text-sm text-white placeholder-slate-500 outline-none resize-none"
		></textarea>
		<div class="flex justify-end gap-2">
			<Button variant="ghost" size="sm" onclick={() => (noteOpen = false)}>Cancel</Button>
			<Button size="sm" onclick={saveNote}>Save</Button>
		</div>
	</div>
</Modal>
