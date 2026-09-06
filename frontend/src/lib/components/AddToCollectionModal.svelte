<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import type { CollectionResponseDto } from '$lib/types/collectionTypes';
	import {
		getUserCollections,
		getCollectionItemIds,
		addItemToCollection,
		removeItemFromCollection,
		createCollection,
	} from '$lib/db/services/collection.service';

	interface Props {
		mediaId: string;
		onClose: () => void;
	}

	let { mediaId, onClose }: Props = $props();

	let collections = $state<CollectionResponseDto[]>([]);
	const selectedIds = new SvelteSet<string>();
	let isLoading = $state(true);
	let newName = $state('');
	let isCreating = $state(false);

	onMount(async () => {
		try {
			const list = await getUserCollections('local');
			collections = list;
			for (const c of list) {
				const itemIds = await getCollectionItemIds(c.id);
				if (itemIds.includes(mediaId)) {
					selectedIds.add(c.id);
				}
			}
		} catch (err) {
			console.error('Failed to load collections', err);
		} finally {
			isLoading = false;
		}
	});

	async function toggleCollection(colId: string) {
		if (selectedIds.has(colId)) {
			selectedIds.delete(colId);
			await removeItemFromCollection(colId, mediaId);
		} else {
			selectedIds.add(colId);
			await addItemToCollection(colId, mediaId);
		}
	}

	async function handleCreateCollection() {
		const name = newName.trim();
		if (!name || isCreating) return;
		isCreating = true;
		try {
			const created = await createCollection('local', name);
			await addItemToCollection(created.id, mediaId);
			collections = [...collections, created];
			selectedIds.add(created.id);
			newName = '';
		} catch (err) {
			console.error('Failed to create collection', err);
		} finally {
			isCreating = false;
		}
	}
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0" onclick={onClose}></div>

	<div class="relative w-full max-w-sm bg-[#121422] border border-white/[0.1] rounded-2xl shadow-2xl p-5 overflow-hidden z-10 flex flex-col max-h-[85vh]">
		<div class="flex items-center justify-between pb-3 border-b border-white/[0.08]">
			<h2 class="text-base font-bold text-white">Add to Collection</h2>
			<button
				type="button"
				onclick={onClose}
				class="w-8 h-8 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
				aria-label="Close"
			>
				<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		<div class="overflow-y-auto py-3 space-y-2 flex-1">
			{#if isLoading}
				<div class="flex items-center justify-center py-8">
					<span class="w-5 h-5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin"></span>
				</div>
			{:else if collections.length === 0}
				<p class="text-xs text-slate-400 text-center py-4">No custom collections yet.</p>
			{:else}
				{#each collections as col (col.id)}
					{@const isChecked = selectedIds.has(col.id)}
					<button
						type="button"
						onclick={() => toggleCollection(col.id)}
						class="w-full flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer text-left
							{isChecked
								? 'bg-indigo-600/20 border border-indigo-500/40 text-white'
								: 'bg-[#181b2e] hover:bg-[#20243d] border border-white/[0.06] text-slate-300'}"
					>
						<div class="min-w-0 pr-2">
							<span class="text-xs font-bold block truncate">{col.name}</span>
							{#if col.description}
								<span class="text-[10px] text-slate-400 block truncate">{col.description}</span>
							{/if}
						</div>
						<div class="w-5 h-5 rounded-md flex items-center justify-center border transition-colors shrink-0
							{isChecked
								? 'bg-indigo-600 border-indigo-500 text-white'
								: 'border-white/20 bg-black/20'}">
							{#if isChecked}
								<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
									<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
								</svg>
							{/if}
						</div>
					</button>
				{/each}
			{/if}
		</div>

		<!-- Create new collection inline -->
		<form
			onsubmit={(e) => { e.preventDefault(); handleCreateCollection(); }}
			class="pt-3 border-t border-white/[0.08] flex items-center gap-2"
		>
			<input
				type="text"
				bind:value={newName}
				placeholder="New collection name..."
				class="flex-1 min-w-0 px-3 py-2 bg-[#181b2e] border border-white/[0.08] focus:border-indigo-500 rounded-xl text-xs text-white placeholder-slate-500 outline-none"
			/>
			<button
				type="submit"
				disabled={!newName.trim() || isCreating}
				class="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-colors shrink-0 cursor-pointer"
			>
				Create
			</button>
		</form>
	</div>
</div>
