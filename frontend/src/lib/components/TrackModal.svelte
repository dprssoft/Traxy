<script lang="ts">
	import type { LocalMedia } from '$lib/types/mediaTypes';
	import type { LocalTrackingStatus } from '$lib/types/trackingTypes';
	import { STATUS_LABELS_BY_GROUP, REWATCH_LABELS, getMediaTypeGroup } from '$lib/constants';
	import { upsertTracking, deleteTracking, updateProgress, updateScore } from '$lib/db/services/tracking.service';
	import { startRewatch } from '$lib/db/services/cycle.service';
	import StarRating from './StarRating.svelte';

	interface Props {
		media: LocalMedia;
		tracking: LocalTrackingStatus | null;
		onTrackingChanged: (t: LocalTrackingStatus | null) => void;
		onClose: () => void;
	}

	let { media, tracking, onTrackingChanged, onClose }: Props = $props();

	let isUpdating = $state(false);

	const group = $derived(getMediaTypeGroup(media.type));
	const statusLabels = $derived(STATUS_LABELS_BY_GROUP[group]);

	type StatusOption = 'planned' | 'in_progress' | 'completed' | 'paused' | 'dropped' | 'watched_letsplay';

	const options = $derived<{ value: StatusOption; label: string }[]>([
		{ value: 'planned', label: statusLabels['planned'] },
		{ value: 'in_progress', label: statusLabels['in_progress'] },
		{ value: 'completed', label: statusLabels['completed'] },
		...(group === 'game' ? [{ value: 'watched_letsplay' as StatusOption, label: statusLabels['watched_letsplay'] }] : []),
		{ value: 'paused', label: statusLabels['paused'] },
		{ value: 'dropped', label: statusLabels['dropped'] },
	]);

	async function selectStatus(status: StatusOption) {
		if (isUpdating) return;
		isUpdating = true;
		try {
			const updated = await upsertTracking({
				mediaId: media.id,
				status,
			});
			onTrackingChanged(updated);
		} catch (err) {
			console.error('Failed to update status', err);
		} finally {
			isUpdating = false;
		}
	}

	async function handleRewatch() {
		if (isUpdating) return;
		isUpdating = true;
		try {
			await startRewatch(media.id, media.type);
			if (tracking) {
				const updated = { ...tracking, status: 'in_progress' as const };
				onTrackingChanged(updated);
			}
		} catch (err) {
			console.error('Failed to start rewatch', err);
		} finally {
			isUpdating = false;
		}
	}

	async function handleRemove() {
		if (isUpdating) return;
		isUpdating = true;
		try {
			await deleteTracking(media.id);
			onTrackingChanged(null);
			onClose();
		} catch (err) {
			console.error('Failed to delete tracking', err);
		} finally {
			isUpdating = false;
		}
	}

	async function handleScoreChange(score: number) {
		const target = tracking?.score === score ? null : score;
		const updated = await updateScore(media.id, target);
		onTrackingChanged(updated);
	}

	async function adjustProgress(field: keyof LocalTrackingStatus, delta: number, max?: number) {
		if (!tracking) {
			// Initialize tracking first
			await selectStatus('in_progress');
		}
		const currentVal = (tracking?.[field] as number) || 0;
		let nextVal = Math.max(0, currentVal + delta);
		if (max !== undefined) nextVal = Math.min(nextVal, max);
		await updateProgress(media.id, field, nextVal);
		if (tracking) {
			onTrackingChanged({ ...tracking, [field]: nextVal });
		}
	}
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
	<!-- Click backdrop to close -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0" onclick={onClose}></div>

	<div class="relative w-full max-w-md bg-[#121422] border border-white/[0.1] rounded-2xl shadow-2xl p-5 overflow-hidden z-10 max-h-[90vh] flex flex-col">
		<!-- Modal Header -->
		<div class="flex items-center justify-between pb-3 border-b border-white/[0.08]">
			<div class="min-w-0 pr-2">
				<h2 class="text-base font-bold text-white truncate">Track Media</h2>
				<p class="text-xs text-slate-400 truncate">{media.title}</p>
			</div>
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

		<div class="overflow-y-auto py-4 space-y-5 flex-1 pr-0.5">
			<!-- 1. Status Selection -->
			<div>
				<div class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
					Status
				</div>
				<div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
					{#each options as opt (opt.value)}
						{@const isSelected = tracking?.status === opt.value}
						<button
							type="button"
							disabled={isUpdating}
							onclick={() => selectStatus(opt.value)}
							class="px-3 py-2 rounded-xl text-xs font-bold transition-all text-left truncate cursor-pointer
								{isSelected
									? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400'
									: 'bg-[#181b2e] hover:bg-[#20243d] text-slate-300 border border-white/[0.06]'}"
						>
							{opt.label}
						</button>
					{/each}
				</div>

				{#if tracking?.status === 'completed'}
					<button
						type="button"
						onclick={handleRewatch}
						class="w-full mt-2.5 py-2 px-3 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
					>
						<span>🔄</span> {REWATCH_LABELS[media.type] ?? 'Rewatch'}
					</button>
				{/if}
			</div>

			<!-- 2. Progress Controls (Episodes / Chapters / Pages / Hours) -->
			{#if media.type === 'tv' || media.type === 'anime'}
				<div class="space-y-3 bg-[#16192b]/70 p-3.5 rounded-xl border border-white/[0.06]">
					<div class="flex items-center justify-between">
						<span class="text-xs font-semibold text-slate-300">Episodes</span>
						<div class="flex items-center gap-2">
							<button
								type="button"
								onclick={() => adjustProgress('currentEpisode', -1, media.totalEpisodes)}
								class="w-7 h-7 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-white flex items-center justify-center text-sm font-bold cursor-pointer"
							>-</button>
							<span class="text-sm font-bold text-white min-w-[3rem] text-center">
								{tracking?.currentEpisode ?? 0}{media.totalEpisodes ? ` / ${media.totalEpisodes}` : ''}
							</span>
							<button
								type="button"
								onclick={() => adjustProgress('currentEpisode', 1, media.totalEpisodes)}
								class="w-7 h-7 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center text-sm font-bold cursor-pointer"
							>+</button>
						</div>
					</div>
				</div>
			{:else if media.type === 'manga' || media.type === 'manhwa' || media.type === 'manhua' || media.type === 'comic'}
				<div class="space-y-3 bg-[#16192b]/70 p-3.5 rounded-xl border border-white/[0.06]">
					<div class="flex items-center justify-between">
						<span class="text-xs font-semibold text-slate-300">Chapters</span>
						<div class="flex items-center gap-2">
							<button
								type="button"
								onclick={() => adjustProgress('currentChapter', -1, media.totalChapters)}
								class="w-7 h-7 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-white flex items-center justify-center text-sm font-bold cursor-pointer"
							>-</button>
							<span class="text-sm font-bold text-white min-w-[3rem] text-center">
								{tracking?.currentChapter ?? 0}{media.totalChapters ? ` / ${media.totalChapters}` : ''}
							</span>
							<button
								type="button"
								onclick={() => adjustProgress('currentChapter', 1, media.totalChapters)}
								class="w-7 h-7 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center text-sm font-bold cursor-pointer"
							>+</button>
						</div>
					</div>
					{#if media.totalVolumes || tracking?.currentVolume}
						<div class="flex items-center justify-between pt-2 border-t border-white/[0.06]">
							<span class="text-xs font-semibold text-slate-300">Volumes</span>
							<div class="flex items-center gap-2">
								<button
									type="button"
									onclick={() => adjustProgress('currentVolume', -1, media.totalVolumes)}
									class="w-7 h-7 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-white flex items-center justify-center text-sm font-bold cursor-pointer"
								>-</button>
								<span class="text-sm font-bold text-white min-w-[3rem] text-center">
									{tracking?.currentVolume ?? 0}{media.totalVolumes ? ` / ${media.totalVolumes}` : ''}
								</span>
								<button
									type="button"
									onclick={() => adjustProgress('currentVolume', 1, media.totalVolumes)}
									class="w-7 h-7 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center text-sm font-bold cursor-pointer"
								>+</button>
							</div>
						</div>
					{/if}
				</div>
			{:else if media.type === 'book'}
				<div class="space-y-3 bg-[#16192b]/70 p-3.5 rounded-xl border border-white/[0.06]">
					<div class="flex items-center justify-between">
						<span class="text-xs font-semibold text-slate-300">Pages Read</span>
						<div class="flex items-center gap-2">
							<button
								type="button"
								onclick={() => adjustProgress('currentPage', -10, media.totalPages)}
								class="w-7 h-7 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-white flex items-center justify-center text-xs font-bold cursor-pointer"
							>-10</button>
							<span class="text-sm font-bold text-white min-w-[3rem] text-center">
								{tracking?.currentPage ?? 0}{media.totalPages ? ` / ${media.totalPages}` : ''}
							</span>
							<button
								type="button"
								onclick={() => adjustProgress('currentPage', 10, media.totalPages)}
								class="w-7 h-7 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center text-xs font-bold cursor-pointer"
							>+10</button>
						</div>
					</div>
				</div>
			{:else if media.type === 'game'}
				<div class="space-y-3 bg-[#16192b]/70 p-3.5 rounded-xl border border-white/[0.06]">
					<div class="flex items-center justify-between">
						<span class="text-xs font-semibold text-slate-300">Hours Played</span>
						<div class="flex items-center gap-2">
							<button
								type="button"
								onclick={() => adjustProgress('hoursPlayed', -1)}
								class="w-7 h-7 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-white flex items-center justify-center text-sm font-bold cursor-pointer"
							>-</button>
							<span class="text-sm font-bold text-white min-w-[3rem] text-center">
								{tracking?.hoursPlayed ?? 0} hrs
							</span>
							<button
								type="button"
								onclick={() => adjustProgress('hoursPlayed', 1)}
								class="w-7 h-7 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center text-sm font-bold cursor-pointer"
							>+</button>
						</div>
					</div>
				</div>
			{/if}

			<!-- 3. Rating -->
			<div class="bg-[#16192b]/70 p-3.5 rounded-xl border border-white/[0.06]">
				<div class="flex items-center justify-between mb-2">
					<span class="text-xs font-bold uppercase tracking-wider text-slate-400">Score</span>
					{#if tracking?.score}
						<span class="text-xs font-bold text-amber-400">{tracking.score}/10</span>
					{/if}
				</div>
				<StarRating
					value={tracking?.score ?? 0}
					interactive={true}
					size="lg"
					onchange={handleScoreChange}
				/>
			</div>
		</div>

		<!-- Footer actions -->
		<div class="pt-3 border-t border-white/[0.08] flex items-center justify-between gap-3">
			{#if tracking}
				<button
					type="button"
					onclick={handleRemove}
					class="px-3 py-2 text-xs font-bold text-rose-400 hover:bg-rose-500/15 rounded-xl transition-colors cursor-pointer"
				>
					Remove from list
				</button>
			{:else}
				<div></div>
			{/if}

			<button
				type="button"
				onclick={onClose}
				class="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
			>
				Done
			</button>
		</div>
	</div>
</div>
