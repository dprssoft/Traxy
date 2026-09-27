<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import type { LocalMedia } from '$lib/types/mediaTypes';
	import type { CollectionSummary } from '$lib/types/collectionTypes';
	import {
		listCollectionsForPicker,
		getCollectionIdsForMedia,
		addToCollection,
		removeFromCollection,
		createCollection,
	} from '$lib/db/services/collection.service';
	import { MEDIA_TYPE_PLURAL_LABELS } from '$lib/constants';
	import { Badge, Button, Toggle } from '$lib/components/ui';

	interface Props {
		media: Pick<LocalMedia, 'id' | 'type'>;
		/** Called after any membership change. */
		onchange?: () => void;
	}

	let { media, onchange }: Props = $props();

	let collections = $state<CollectionSummary[]>([]);
	const selectedIds = new SvelteSet<string>();
	let isLoading = $state(true);
	let newName = $state('');
	let typeOnly = $state(true);
	let isCreating = $state(false);

	const SYSTEM_ICONS = { favorites: '❤️', wishlist: '🎁' } as const;

	$effect(() => {
		const { id, type } = media;
		isLoading = true;
		Promise.all([listCollectionsForPicker(type), getCollectionIdsForMedia(id)])
			.then(([list, ids]) => {
				collections = list;
				selectedIds.clear();
				for (const colId of ids) selectedIds.add(colId);
			})
			.catch((err) => console.error('Failed to load collections', err))
			.finally(() => (isLoading = false));
	});

	async function toggleCollection(colId: string) {
		try {
			if (selectedIds.has(colId)) {
				selectedIds.delete(colId);
				await removeFromCollection(colId, media.id);
			} else {
				selectedIds.add(colId);
				await addToCollection(colId, media.id);
			}
			onchange?.();
		} catch (err) {
			console.error('Failed to update collection', err);
		}
	}

	async function handleCreate(e: SubmitEvent) {
		e.preventDefault();
		const name = newName.trim();
		if (!name || isCreating) return;
		isCreating = true;
		try {
			const created = await createCollection({ name, mediaType: typeOnly ? media.type : null });
			await addToCollection(created.id, media.id);
			collections = [...collections, { ...created, itemCount: 1 }];
			selectedIds.add(created.id);
			newName = '';
			onchange?.();
		} catch (err) {
			console.error('Failed to create collection', err);
		} finally {
			isCreating = false;
		}
	}
</script>

<div class="flex flex-col gap-3 min-h-0">
	<div class="space-y-2">
		{#if isLoading}
			<div class="flex items-center justify-center py-8">
				<span
					class="w-5 h-5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin"
				></span>
			</div>
		{:else}
			{#each collections as col, i (col.id)}
				{@const isChecked = selectedIds.has(col.id)}
				{#if i > 0 && !col.systemKey && collections[i - 1].systemKey}
					<div class="border-t border-white/[0.06] my-1"></div>
				{/if}
				<button
					type="button"
					onclick={() => toggleCollection(col.id)}
					aria-pressed={isChecked}
					class="w-full flex items-center justify-between gap-2 p-3 rounded-xl transition-all cursor-pointer text-left
						{isChecked
						? 'bg-indigo-600/20 border border-indigo-500/40 text-white'
						: 'bg-[#181b2e] hover:bg-[#20243d] border border-white/[0.06] text-slate-300'}"
				>
					<div class="min-w-0 flex items-center gap-2">
						{#if col.systemKey}
							<span class="text-sm shrink-0">{SYSTEM_ICONS[col.systemKey]}</span>
						{/if}
						<div class="min-w-0">
							<span class="text-xs font-bold block truncate">{col.name}</span>
							{#if col.description}
								<span class="text-[10px] text-slate-400 block truncate">{col.description}</span>
							{/if}
						</div>
					</div>
					<div class="flex items-center gap-2 shrink-0">
						{#if !col.systemKey}
							<Badge variant={col.mediaType ? 'indigo' : 'slate'} size="xs">
								{col.mediaType ? MEDIA_TYPE_PLURAL_LABELS[col.mediaType] : 'Shared'}
							</Badge>
						{/if}
						<div
							class="w-5 h-5 rounded-md flex items-center justify-center border transition-colors
								{isChecked ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-white/20 bg-black/20'}"
						>
							{#if isChecked}
								<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
									<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
								</svg>
							{/if}
						</div>
					</div>
				</button>
			{/each}
		{/if}
	</div>

	<!-- Create a new collection inline -->
	<form onsubmit={handleCreate} class="pt-3 border-t border-white/[0.08] space-y-2.5">
		<div class="flex items-center gap-2">
			<input
				type="text"
				bind:value={newName}
				maxlength={80}
				placeholder="New collection name..."
				aria-label="New collection name"
				class="flex-1 min-w-0 px-3 py-2 bg-[#181b2e] border border-white/[0.08] focus:border-indigo-500 rounded-xl text-xs text-white placeholder-slate-500 outline-none"
			/>
			<Button type="submit" size="sm" disabled={!newName.trim()} loading={isCreating}>Create</Button>
		</div>
		<div class="flex items-center justify-between gap-2 text-xs text-slate-400">
			<span>
				{typeOnly ? `Only ${MEDIA_TYPE_PLURAL_LABELS[media.type]}` : 'Shared — any media type'}
			</span>
			<Toggle bind:checked={typeOnly} label="Restrict to this media type" />
		</div>
	</form>
</div>
