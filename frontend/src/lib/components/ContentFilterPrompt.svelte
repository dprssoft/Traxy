<script lang="ts">
	import { Modal, Button } from '$lib/components/ui';
	import { contentFilterStore } from '$lib/stores/contentFilter.svelte';
	import { setContentFilterEnabled } from '$lib/db/services/settings.service';

	// First-launch question: shown until the adult filter flag has been written once.
	let open = $derived(!contentFilterStore.asked);

	async function choose(filter: boolean) {
		open = false;
		contentFilterStore.setEnabled(filter);
		await setContentFilterEnabled(filter);
	}
</script>

<!-- Dismissing without an answer keeps the safe default (hide). -->
<Modal bind:open title="Adult content" size="sm" onclose={() => choose(true)}>
	<div class="space-y-3 text-sm text-slate-300">
		<p>
			Some search and catalogue results can include adult (18+) titles. Do you want to hide them?
		</p>
		<p class="text-xs text-slate-400">
			You can change this anytime in <span class="text-slate-200 font-semibold"
				>Settings → Content Filter</span
			>, including showing adult titles with blurred artwork instead.
		</p>
	</div>
	{#snippet footer()}
		<div class="flex flex-wrap justify-end gap-3">
			<Button variant="secondary" onclick={() => choose(false)}>Show everything</Button>
			<Button onclick={() => choose(true)}>Hide adult content</Button>
		</div>
	{/snippet}
</Modal>
