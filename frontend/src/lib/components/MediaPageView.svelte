<script lang="ts">
	import { untrack } from 'svelte';
	import type { LocalMedia } from '$lib/types/mediaTypes';
	import type { LocalTrackingStatus, LocalWatchCycle } from '$lib/types/trackingTypes';
	import StatusButton from './StatusButton.svelte';
	import MyNote from './MyNote.svelte';
	import ProgressTracker from './ProgressTracker.svelte';
	import CycleHistory from './CycleHistory.svelte';
	import { MEDIA_TYPE_LABELS } from '$lib/constants';
	import { updateScore, updateNote } from '$lib/db/services/tracking.service';
	import { getCycles } from '$lib/db/services/cycle.service';

	interface Props {
		media: LocalMedia;
		tracking: LocalTrackingStatus | null;
		cycles: LocalWatchCycle[];
	}

	let { media, tracking: initialTracking, cycles: initialCycles }: Props = $props();

	let tracking = $state<LocalTrackingStatus | null>(untrack(() => initialTracking));
	let cycles = $state<LocalWatchCycle[]>(untrack(() => initialCycles));
	let hoverScore = $state<number | null>(null);

	$effect(() => {
		tracking = initialTracking;
	});

	$effect(() => {
		cycles = initialCycles;
	});

	async function handleTrackingChanged(t: LocalTrackingStatus | null) {
		tracking = t;
		if (t) {
			const c = await getCycles(media.id);
			cycles = c;
		} else {
			cycles = [];
		}
	}

	async function handleScore(score: number) {
		const target = tracking?.score === score ? null : score;
		const updated = await updateScore(media.id, target);
		tracking = updated;
	}

	async function handleSaveNote(note: string) {
		if (!tracking) return;
		await updateNote(media.id, note);
		tracking = { ...tracking, note };
	}
</script>

<div class="grid grid-cols-1 md:grid-cols-4 gap-8 items-start">
	<!-- Left column: Poster, Status, and Score -->
	<div class="md:col-span-1 space-y-5">
		<div class="relative group">
			{#if media.posterUrl}
				<div class="absolute -inset-1 bg-gradient-to-tr from-indigo-600/30 to-purple-600/30 rounded-3xl blur-xl opacity-50 group-hover:opacity-80 transition-opacity"></div>
				<img src={media.posterUrl} alt={media.title} class="relative w-full rounded-2xl shadow-2xl border border-white/[0.1] object-cover" />
			{:else}
				<div class="w-full aspect-[2/3] bg-[#16192b] rounded-2xl border border-white/[0.08] flex items-center justify-center shadow-xl">
					<span class="text-slate-500 font-extrabold text-2xl">{media.title.substring(0,2)}</span>
				</div>
			{/if}
		</div>

		<div class="flex flex-col gap-2">
			<StatusButton {media} {tracking} onTrackingChanged={handleTrackingChanged} />
		</div>

		<!-- Score Section -->
		<div class="bg-[#121422]/80 backdrop-blur-xl p-5 rounded-2xl border border-white/[0.08] shadow-lg">
			<div class="flex items-center justify-between mb-3">
				<p class="text-xs font-semibold uppercase tracking-wider text-slate-400">Your score</p>
				{#if tracking?.score}
					<span class="text-sm font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">{tracking.score} / 10 ★</span>
				{/if}
			</div>
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="flex items-center justify-between gap-1" onmouseleave={() => hoverScore = null}>
				{#each [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as val}
					<button
						type="button"
						class="p-0.5 focus:outline-none transition-transform hover:scale-125 cursor-pointer"
						onmouseenter={() => hoverScore = val}
						onclick={() => handleScore(val)}
						title={`Rate ${val}/10`}
					>
						<span 
							class="text-xl leading-none transition-colors {(hoverScore !== null ? val <= hoverScore : (tracking?.score && val <= tracking.score)) ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]' : 'text-slate-700 hover:text-slate-500'}"
						>
							★
						</span>
					</button>
				{/each}
			</div>
		</div>
	</div>

	<!-- Right column: Details and Progress -->
	<div class="md:col-span-3 space-y-6">
		<div class="bg-[#121422]/60 backdrop-blur-xl p-6 sm:p-8 rounded-3xl border border-white/[0.08] shadow-xl">
			<div class="flex items-center gap-3 mb-3 flex-wrap">
				<span class="px-2.5 py-1 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-xs font-bold rounded-lg uppercase tracking-wider">
					{MEDIA_TYPE_LABELS[media.type] ?? media.type}
				</span>
				{#if media.year}
					<span class="text-slate-400 font-semibold text-sm">{media.year}</span>
				{/if}
			</div>

			{#if media.type === 'game' && media.platforms && media.platforms.length > 0}
				<div class="flex flex-wrap gap-1.5 mb-4">
					{#each media.platforms as platform}
						<span class="text-xs px-2.5 py-1 bg-[#181b2e] border border-white/[0.08] text-slate-300 rounded-full font-medium">{platform}</span>
					{/each}
				</div>
			{/if}
			
			<h1 class="text-3xl sm:text-4xl font-extrabold text-white mb-4 tracking-tight leading-tight">{media.title}</h1>
			
			{#if media.description}
				<p class="text-slate-300 leading-relaxed text-sm sm:text-base bg-[#0a0b12]/50 p-5 rounded-2xl border border-white/[0.06]">
					{media.description}
				</p>
			{/if}
		</div>

		{#if tracking}
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<ProgressTracker {media} {tracking} onUpdate={handleTrackingChanged} />
				<CycleHistory {media} {cycles} />
			</div>
		{/if}

		<div>
			<MyNote note={tracking?.note} onSave={handleSaveNote} />
		</div>
	</div>
</div>