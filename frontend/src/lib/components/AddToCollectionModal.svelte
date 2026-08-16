<script lang="ts">
	// Stub — to be implemented in Phase 4H.
	interface Props {
		mediaId: string;
		onClose: () => void;
	}
	let { mediaId, onClose }: Props = $props();
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
	<div class="w-full max-w-sm bg-bkg-header border border-gray-700 rounded-2xl p-6">
		<h2 class="text-lg font-bold text-white mb-4">Add to collection</h2>
		<p class="text-text-muted text-sm mb-4">Stub - Collections coming later.</p>
		<button class="w-full py-2 bg-gray-700 text-white rounded-lg" onclick={onClose}>Cancel</button>
	</div>
</div>
