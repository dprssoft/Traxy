<script lang="ts">
	import type { LocalMedia } from '$lib/types/mediaTypes';
	import CollectionPicker from './CollectionPicker.svelte';
	import { Modal } from '$lib/components/ui';

	interface Props {
		media: Pick<LocalMedia, 'id' | 'type'>;
		onClose: () => void;
		onchange?: () => void;
	}

	let { media, onClose, onchange }: Props = $props();

	let open = $state(true);
</script>

<Modal bind:open title="Add to Collection" size="sm" onclose={onClose}>
	<CollectionPicker {media} {onchange} />
</Modal>
