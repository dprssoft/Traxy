<script lang="ts">
	import type { LocalMedia } from '$lib/types/mediaTypes';
	import type { LocalTrackingStatus } from '$lib/types/trackingTypes';
	import { deleteTracking } from '$lib/db/services/tracking.service';
	import TrackEditor from './TrackEditor.svelte';
	import { Button, Modal } from '$lib/components/ui';

	interface Props {
		media: LocalMedia;
		tracking: LocalTrackingStatus | null;
		onTrackingChanged: (t: LocalTrackingStatus | null) => void;
		onClose: () => void;
	}

	let { media, tracking, onTrackingChanged, onClose }: Props = $props();

	let open = $state(true);
	let removing = $state(false);

	async function handleRemove() {
		if (removing) return;
		removing = true;
		try {
			await deleteTracking(media.id);
			onTrackingChanged(null);
			onClose();
		} catch (err) {
			console.error('Failed to delete tracking', err);
		} finally {
			removing = false;
		}
	}
</script>

<Modal bind:open title="Track · {media.title}" size="md" onclose={onClose}>
	<TrackEditor {media} {tracking} {onTrackingChanged} />

	{#snippet footer()}
		<div class="flex items-center justify-between gap-3">
			{#if tracking}
				<Button variant="ghost" size="sm" class="text-rose-400" loading={removing} onclick={handleRemove}>
					Remove from list
				</Button>
			{:else}
				<div></div>
			{/if}
			<Button size="sm" onclick={onClose}>Done</Button>
		</div>
	{/snippet}
</Modal>
