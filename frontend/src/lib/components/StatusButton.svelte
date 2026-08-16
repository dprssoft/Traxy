<script lang="ts">
	import type { LocalMedia } from '$lib/types/mediaTypes';
	import type { LocalTrackingStatus } from '$lib/types/trackingTypes';
	import { STATUS_LABELS_BY_GROUP, REWATCH_LABELS, getMediaTypeGroup } from '$lib/constants';
	import { upsertTracking, deleteTracking } from '$lib/db/services/tracking.service';
	import { startRewatch } from '$lib/db/services/cycle.service';

	interface Props {
		media: LocalMedia;
		tracking: LocalTrackingStatus | null;
		onTrackingChanged?: (t: LocalTrackingStatus | null) => void;
	}

	let { media, tracking, onTrackingChanged }: Props = $props();

	let isOpen = $state(false);
	let isUpdating = $state(false);

	const group = $derived(getMediaTypeGroup(media.type));
	const statusLabels = $derived(STATUS_LABELS_BY_GROUP[group]);

	const options = $derived([
		{ value: 'planned', label: statusLabels['planned'] },
		{ value: 'in_progress', label: statusLabels['in_progress'] },
		{ value: 'completed', label: statusLabels['completed'] },
		{ value: 'paused', label: statusLabels['paused'] },
		{ value: 'dropped', label: statusLabels['dropped'] },
	]);

	async function updateStatus(newStatus: 'planned' | 'in_progress' | 'completed' | 'paused' | 'dropped') {
		isOpen = false;
		if (tracking?.status === newStatus) return;

		isUpdating = true;
		try {
			const updated = await upsertTracking({
				mediaId: media.id,
				status: newStatus,
			});
			onTrackingChanged?.(updated);
		} catch (err) {
			console.error('Failed to update status', err);
		} finally {
			isUpdating = false;
		}
	}

	async function doRemove() {
		isOpen = false;
		isUpdating = true;
		try {
			await deleteTracking(media.id);
			onTrackingChanged?.(null);
		} catch (err) {
			console.error('Failed to delete tracking', err);
		} finally {
			isUpdating = false;
		}
	}

	async function doRewatch() {
		isOpen = false;
		isUpdating = true;
		try {
			await startRewatch(media.id, media.type);
			// The tracking status was updated to in_progress behind the scenes. We need to refetch it.
			// Or just optimistically update:
			if (tracking) {
				const updated = { ...tracking, status: 'in_progress' as const };
				onTrackingChanged?.(updated);
			}
		} catch (err) {
			console.error('Failed to start rewatch', err);
		} finally {
			isUpdating = false;
		}
	}

	const currentLabel = $derived(tracking ? statusLabels[tracking.status] : 'Add');
</script>

<div class="relative">
	<button
		onclick={() => isOpen = !isOpen}
		disabled={isUpdating}
		class="flex items-center justify-between w-full sm:w-auto min-w-[160px] px-4 py-2 bg-brand-accent hover:bg-brand-accent/90 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
	>
		{#if isUpdating}
			<span class="w-5 h-5 animate-pulse mx-auto opacity-50">...</span>
		{:else}
			<span>{currentLabel}</span>
			<span class="ml-2 text-xs opacity-80">▼</span>
		{/if}
	</button>

	{#if isOpen}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="fixed inset-0 z-40" onclick={() => isOpen = false}></div>
		<div class="absolute top-full left-0 mt-1 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden py-1">
			{#each options as opt}
				<button
					class="w-full text-left px-4 py-2 text-sm transition-colors {tracking?.status === opt.value ? 'bg-brand-accent/20 text-brand-accent' : 'text-gray-200 hover:bg-gray-700'}"
					onclick={() => updateStatus(opt.value as any)}
				>
					{opt.label}
				</button>
			{/each}

			{#if tracking?.status === 'completed'}
				<div class="border-t border-gray-700 my-1"></div>
				<button
					class="w-full text-left px-4 py-2 text-sm text-green-400 hover:bg-gray-700 transition-colors"
					onclick={doRewatch}
				>
					{REWATCH_LABELS[media.type] ?? 'Пройти знову'}
				</button>
			{/if}

			{#if tracking}
				<div class="border-t border-gray-700 my-1"></div>
				<button
					class="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700 transition-colors"
					onclick={doRemove}
				>
					Remove from list
				</button>
			{/if}
		</div>
	{/if}
</div>