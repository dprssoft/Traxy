<script lang="ts">
	import { resolve } from '$app/paths';
	import type { LocalMedia } from '$lib/types/mediaTypes';
	import type { LocalTrackingStatus } from '$lib/types/trackingTypes';
	import { MEDIA_TYPE_LABELS, WISHLIST_MEDIA_TYPES } from '$lib/constants';
	import { deleteTracking, getTracking, updateNote } from '$lib/db/services/tracking.service';
	import { quickEdit } from '$lib/stores/quickEdit.svelte';
	import TrackEditor from './TrackEditor.svelte';
	import MyNote from './MyNote.svelte';
	import CollectionPicker from './CollectionPicker.svelte';
	import SystemCollectionButton from './SystemCollectionButton.svelte';
	import { Button, Modal, SensitiveContent } from '$lib/components/ui';

	interface Props {
		media: LocalMedia;
	}

	let { media }: Props = $props();

	let open = $state(true);
	let view = $state<'main' | 'collections'>('main');
	let tracking = $state<LocalTrackingStatus | null>(null);
	let removing = $state(false);
	// Bumped when the picker changes membership so the heart/gift buttons reload.
	let collectionsVersion = $state(0);

	$effect(() => {
		getTracking(media.id)
			.then((t) => (tracking = t))
			.catch((err) => console.error('Failed to load tracking', err));
	});

	function handleTrackingChanged(t: LocalTrackingStatus | null) {
		tracking = t;
		quickEdit.callbacks.onTrackingChanged?.(t);
	}

	async function handleSaveNote(note: string) {
		handleTrackingChanged(await updateNote(media.id, note));
	}

	async function handleRemove() {
		if (removing) return;
		removing = true;
		try {
			await deleteTracking(media.id);
			handleTrackingChanged(null);
		} catch (err) {
			console.error('Failed to remove from library', err);
		} finally {
			removing = false;
		}
	}

	function close() {
		open = false;
		quickEdit.close();
	}
</script>

<Modal bind:open title="Quick edit" size="md" onclose={quickEdit.close}>
	<div class="space-y-5">
		<!-- Media header -->
		<div class="flex items-center gap-3">
			<div
				class="w-12 h-16 shrink-0 rounded-lg overflow-hidden bg-[#181b2e] border border-white/[0.08]"
			>
				{#if media.posterUrl}
					<SensitiveContent isAdult={media.isAdult} badge={false} class="w-full h-full">
						<img src={media.posterUrl} alt="" class="w-full h-full object-cover" />
					</SensitiveContent>
				{/if}
			</div>
			<div class="min-w-0 flex-1">
				<h3 class="text-sm font-bold text-white line-clamp-2">{media.title}</h3>
				<p class="text-xs text-slate-400">
					{MEDIA_TYPE_LABELS[media.type]}{media.year ? ` · ${media.year}` : ''}
				</p>
				<a
					href={resolve(`/media/${media.id}`)}
					onclick={close}
					class="text-xs font-semibold text-indigo-400 hover:text-indigo-300"
				>
					Open page →
				</a>
			</div>
			<div class="flex items-center gap-2 shrink-0">
				{#key collectionsVersion}
					<SystemCollectionButton {media} kind="favorites" />
					{#if WISHLIST_MEDIA_TYPES.includes(media.type)}
						<SystemCollectionButton {media} kind="wishlist" />
					{/if}
				{/key}
			</div>
		</div>

		{#if view === 'main'}
			<TrackEditor {media} {tracking} onTrackingChanged={handleTrackingChanged} />

			<MyNote note={tracking?.note} onSave={handleSaveNote} maxLength={255} />

			<Button
				variant="secondary"
				size="sm"
				class="w-full justify-between"
				onclick={() => (view = 'collections')}
			>
				<span>Add to collection</span>
				<span aria-hidden="true">›</span>
			</Button>
		{:else}
			<div class="space-y-3">
				<Button variant="ghost" size="sm" onclick={() => (view = 'main')}>‹ Back</Button>
				<CollectionPicker {media} onchange={() => collectionsVersion++} />
			</div>
		{/if}
	</div>

	{#snippet footer()}
		<div class="flex items-center justify-between gap-3">
			{#if tracking}
				<Button
					variant="ghost"
					size="sm"
					class="text-rose-400"
					loading={removing}
					onclick={handleRemove}
				>
					Remove from library
				</Button>
			{:else}
				<div></div>
			{/if}
			<Button size="sm" onclick={close}>Done</Button>
		</div>
	{/snippet}
</Modal>
