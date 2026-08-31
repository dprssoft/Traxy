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
		...(group === 'game' ? [{ value: 'watched_letsplay', label: statusLabels['watched_letsplay'] }] : []),
		{ value: 'paused', label: statusLabels['paused'] },
		{ value: 'dropped', label: statusLabels['dropped'] },
	]);

	async function updateStatus(newStatus: 'planned' | 'in_progress' | 'completed' | 'paused' | 'dropped' | 'watched_letsplay') {
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
		class="flex items-center justify-between w-full sm:w-auto min-w-[160px] px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition-all cursor-pointer text-sm active:scale-95"
	>
		{#if isUpdating}
			<span class="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin mx-auto"></span>
		{:else}
			<span>{currentLabel}</span>
			<svg class="ml-2 w-4 h-4 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
			</svg>
		{/if}
	</button>

	{#if isOpen}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="fixed inset-0 z-40" onclick={() => isOpen = false}></div>
		<div class="absolute top-full left-0 mt-1.5 w-52 bg-[#141727]/95 backdrop-blur-xl border border-white/[0.1] rounded-2xl shadow-2xl z-50 overflow-hidden py-1.5 space-y-0.5">
			{#each options as opt}
				<button
					class="w-full text-left px-4 py-2.5 text-xs font-semibold transition-colors cursor-pointer {tracking?.status === opt.value ? 'bg-indigo-600/20 text-indigo-400 font-bold' : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'}"
					onclick={() => updateStatus(opt.value as any)}
				>
					{opt.label}
				</button>
			{/each}

			{#if tracking?.status === 'completed'}
				<div class="border-t border-white/[0.06] my-1"></div>
				<button
					class="w-full text-left px-4 py-2.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer flex items-center gap-2"
					onclick={doRewatch}
				>
					<span>🔄</span> {REWATCH_LABELS[media.type] ?? 'Play again'}
				</button>
			{/if}

			{#if tracking}
				<div class="border-t border-white/[0.06] my-1"></div>
				<button
					class="w-full text-left px-4 py-2.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer flex items-center gap-2"
					onclick={doRemove}
				>
					<span>🗑️</span> Remove from list
				</button>
			{/if}
		</div>
	{/if}
</div>