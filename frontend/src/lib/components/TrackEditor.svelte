<script lang="ts">
	import type { LocalMedia } from '$lib/types/mediaTypes';
	import type { LocalTrackingStatus, TrackingStatusType } from '$lib/types/trackingTypes';
	import { REWATCH_LABELS, getStatusOptions } from '$lib/constants';
	import { upsertTracking, updateProgress, updateScore } from '$lib/db/services/tracking.service';
	import { startRewatch } from '$lib/db/services/cycle.service';
	import StarRating from './StarRating.svelte';

	/** Status, progress and score controls shared by TrackModal and the quick-edit sheet. */
	interface Props {
		media: LocalMedia;
		tracking: LocalTrackingStatus | null;
		onTrackingChanged: (t: LocalTrackingStatus | null) => void;
	}

	let { media, tracking, onTrackingChanged }: Props = $props();

	let isUpdating = $state(false);

	const options = $derived(getStatusOptions(media.type));

	async function selectStatus(status: TrackingStatusType): Promise<LocalTrackingStatus | null> {
		if (isUpdating) return null;
		isUpdating = true;
		try {
			const updated = await upsertTracking({
				mediaId: media.id,
				status,
			});
			onTrackingChanged(updated);
			return updated;
		} catch (err) {
			console.error('Failed to update status', err);
			return null;
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

	async function handleScoreChange(score: number) {
		const target = tracking?.score === score ? null : score;
		const updated = await updateScore(media.id, target);
		onTrackingChanged(updated);
	}

	async function adjustProgress(field: keyof LocalTrackingStatus, delta: number, max?: number) {
		// Initialize tracking first; the prop only catches up after the parent re-renders.
		const current = tracking ?? (await selectStatus('in_progress'));
		if (!current) return;
		const currentVal = (current[field] as number) || 0;
		let nextVal = Math.max(0, currentVal + delta);
		if (max !== undefined) nextVal = Math.min(nextVal, max);
		await updateProgress(media.id, field, nextVal);
		onTrackingChanged({ ...current, [field]: nextVal });
	}
</script>

<div class="space-y-5">
	<!-- 1. Status Selection -->
	<div>
		<div class="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Status</div>
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
				<span>🔄</span>
				{REWATCH_LABELS[media.type] ?? 'Rewatch'}
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
						>-</button
					>
					<span class="text-sm font-bold text-white min-w-[3rem] text-center">
						{tracking?.currentEpisode ?? 0}{media.totalEpisodes ? ` / ${media.totalEpisodes}` : ''}
					</span>
					<button
						type="button"
						onclick={() => adjustProgress('currentEpisode', 1, media.totalEpisodes)}
						class="w-7 h-7 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center text-sm font-bold cursor-pointer"
						>+</button
					>
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
						>-</button
					>
					<span class="text-sm font-bold text-white min-w-[3rem] text-center">
						{tracking?.currentChapter ?? 0}{media.totalChapters ? ` / ${media.totalChapters}` : ''}
					</span>
					<button
						type="button"
						onclick={() => adjustProgress('currentChapter', 1, media.totalChapters)}
						class="w-7 h-7 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center text-sm font-bold cursor-pointer"
						>+</button
					>
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
							>-</button
						>
						<span class="text-sm font-bold text-white min-w-[3rem] text-center">
							{tracking?.currentVolume ?? 0}{media.totalVolumes ? ` / ${media.totalVolumes}` : ''}
						</span>
						<button
							type="button"
							onclick={() => adjustProgress('currentVolume', 1, media.totalVolumes)}
							class="w-7 h-7 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center text-sm font-bold cursor-pointer"
							>+</button
						>
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
						>-10</button
					>
					<span class="text-sm font-bold text-white min-w-[3rem] text-center">
						{tracking?.currentPage ?? 0}{media.totalPages ? ` / ${media.totalPages}` : ''}
					</span>
					<button
						type="button"
						onclick={() => adjustProgress('currentPage', 10, media.totalPages)}
						class="w-7 h-7 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center text-xs font-bold cursor-pointer"
						>+10</button
					>
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
						>-</button
					>
					<span class="text-sm font-bold text-white min-w-[3rem] text-center">
						{tracking?.hoursPlayed ?? 0} hrs
					</span>
					<button
						type="button"
						onclick={() => adjustProgress('hoursPlayed', 1)}
						class="w-7 h-7 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center text-sm font-bold cursor-pointer"
						>+</button
					>
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
