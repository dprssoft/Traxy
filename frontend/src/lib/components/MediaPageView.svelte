<script lang="ts">
	import type { LocalMedia } from '$lib/types/mediaTypes';
	import type { LocalTrackingStatus, LocalWatchCycle } from '$lib/types/trackingTypes';
	import StatusButton from './StatusButton.svelte';
	import MyNote from './MyNote.svelte';
	import ProgressTracker from './ProgressTracker.svelte';
	import CycleHistory from './CycleHistory.svelte';
	import { MEDIA_TYPE_LABELS } from '$lib/constants';
	import { updateScore } from '$lib/db/services/tracking.service';

	interface Props {
		media: LocalMedia;
		tracking: LocalTrackingStatus | null;
		cycles: LocalWatchCycle[];
	}

	let { media, tracking, cycles }: Props = $props();

	function handleTrackingChanged(t: LocalTrackingStatus | null) {
		tracking = t;
	}

	async function handleScore(score: number) {
		if (!tracking) return;
		await updateScore(media.id, score);
		tracking = { ...tracking, score };
	}
</script>

<div class="grid grid-cols-1 md:grid-cols-4 gap-6">
	<!-- Left column: Poster and Status -->
	<div class="md:col-span-1 space-y-4">
		{#if media.posterUrl}
			<img src={media.posterUrl} alt={media.title} class="w-full rounded-xl shadow-lg border border-gray-800" />
		{:else}
			<div class="w-full aspect-[2/3] bg-gray-800 rounded-xl border border-gray-700 flex items-center justify-center">
				<span class="text-gray-500 font-medium text-lg">{media.title.substring(0,2)}</span>
			</div>
		{/if}

		<div class="flex flex-col gap-2">
			<StatusButton {media} {tracking} onTrackingChanged={handleTrackingChanged} />
		</div>

		{#if tracking}
			<!-- Score Section -->
			<div class="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
				<p class="text-sm text-gray-400 mb-2">Your score</p>
				<div class="flex items-center gap-1">
					{#each [1,2,3,4,5,6,7,8,9,10] as val}
						<button
							class="focus:outline-none transition-transform hover:scale-110"
							onclick={() => handleScore(val)}
						>
							<span 
								class="text-lg leading-none {tracking.score && val <= tracking.score ? 'text-yellow-500' : 'text-gray-600 hover:text-gray-400'}"
							>
								★
							</span>
						</button>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	<!-- Right column: Details and Progress -->
	<div class="md:col-span-3 space-y-6">
		<div>
			<div class="flex items-center gap-3 mb-2 flex-wrap">
				<span class="px-2 py-1 bg-gray-800 text-brand-accent text-xs font-semibold rounded uppercase tracking-wider">
					{MEDIA_TYPE_LABELS[media.type] ?? media.type}
				</span>
				{#if media.year}
					<span class="text-gray-400 font-medium">{media.year}</span>
				{/if}
			</div>

			{#if media.type === 'game' && media.platforms && media.platforms.length > 0}
				<div class="flex flex-wrap gap-1.5 mb-3">
					{#each media.platforms as platform}
						<span class="text-xs px-2 py-0.5 bg-gray-800 border border-gray-700 text-gray-300 rounded-full">{platform}</span>
					{/each}
				</div>
			{/if}
			
			<h1 class="text-3xl font-bold text-white mb-4">{media.title}</h1>
			
			{#if media.description}
				<p class="text-gray-300 leading-relaxed text-sm bg-gray-800/30 p-4 rounded-xl border border-gray-700/50">
					{media.description}
				</p>
			{/if}
		</div>

		{#if tracking}
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<ProgressTracker {media} {tracking} onUpdate={handleTrackingChanged} />
				<CycleHistory {media} {cycles} />
			</div>

			<div class="mt-6">
				<h3 class="text-lg font-bold text-white mb-3">Your note</h3>
				<MyNote note={tracking.note} onSave={async () => {}} />
			</div>
		{/if}
	</div>
</div>