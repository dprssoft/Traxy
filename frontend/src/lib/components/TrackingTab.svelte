<script lang="ts">
	import type { LocalMedia } from '$lib/types/mediaTypes';
	import type { TrackingListItem } from '$lib/types/trackingTypes';
	import { getStatusLabel } from '$lib/constants';
	import { upsertTracking } from '$lib/db/services/tracking.service';
	import { getMediaTypeGroup, MEDIA_TYPE_LABELS, STATUS_LABELS_BY_GROUP } from '$lib/constants';
	import StatusButton from './StatusButton.svelte';

	interface Props {
		item: TrackingListItem;
	}

	let { item }: Props = $props();

	const group = $derived(getMediaTypeGroup(item.media.type));

	function getProgressText(media: LocalMedia, tracking: TrackingListItem['tracking']): string {
		if (media.type === 'film') return '';
		
		if (media.type === 'tv') {
			if (tracking.currentSeason && tracking.currentEpisode) {
				return `S${tracking.currentSeason.toString().padStart(2, '0')}E${tracking.currentEpisode.toString().padStart(2, '0')}`;
			}
			if (tracking.currentEpisode) return `E${tracking.currentEpisode}`;
			return '';
		}

		if (media.type === 'anime') {
			if (tracking.currentEpisode) return `${tracking.currentEpisode} / ${media.totalEpisodes ?? '?'}`;
			return '';
		}

		if (media.type === 'game') {
			if (tracking.hoursPlayed) return `${tracking.hoursPlayed} год.`;
			return '';
		}

		if (media.type === 'book') {
			if (tracking.currentPage) return `Стор. ${tracking.currentPage} / ${media.totalPages ?? '?'}`;
			return '';
		}

		// comics, manga, manhwa
		if (tracking.currentChapter) return `Розд. ${tracking.currentChapter}`;
		if (tracking.currentIssue) return `Вип. ${tracking.currentIssue}`;
		
		return '';
	}

	const progressText = $derived(getProgressText(item.media, item.tracking));
</script>

<div class="bg-gray-800/50 hover:bg-gray-800 border border-gray-700 rounded-xl overflow-hidden transition-colors flex flex-col sm:flex-row h-auto sm:h-36">
	<!-- Poster -->
	<a href={`/media/${item.media.id}`} class="w-full sm:w-24 h-48 sm:h-full shrink-0">
		{#if item.media.posterUrl}
			<img src={item.media.posterUrl} alt={item.media.title} class="w-full h-full object-cover" />
		{:else}
			<div class="w-full h-full bg-gray-700 flex items-center justify-center">
				<span class="text-gray-500 font-bold text-lg">{item.media.title.substring(0,2)}</span>
			</div>
		{/if}
	</a>

	<!-- Info -->
	<div class="p-4 flex-1 flex flex-col min-w-0">
		<div class="flex items-start justify-between gap-4 mb-1">
			<a href={`/media/${item.media.id}`} class="text-white font-bold text-lg leading-tight truncate hover:text-brand-accent transition-colors">
				{item.media.title}
			</a>
			{#if item.tracking.score}
				<span class="text-yellow-500 font-medium text-sm whitespace-nowrap shrink-0">
					{item.tracking.score}/10 ★
				</span>
			{/if}
		</div>
		
		<div class="flex items-center gap-2 mb-3">
			<span class="px-2 py-0.5 rounded text-xs font-medium bg-gray-700 text-brand-accent uppercase">
				{MEDIA_TYPE_LABELS[item.media.type] ?? item.media.type}
			</span>
			{#if progressText}
				<span class="text-xs text-gray-400 border border-gray-600 rounded px-1.5 py-0.5">
					{progressText}
				</span>
			{/if}
			{#if item.tracking.completionTier}
				<span class="text-xs text-gray-400 border border-gray-600 rounded px-1.5 py-0.5">
					{item.tracking.completionTier === 'main_story' ? 'Story' : item.tracking.completionTier === 'completionist' ? '100%' : 'Story+Доп'}
				</span>
			{/if}
		</div>

		<!-- Optional note -->
		{#if item.tracking.note}
			<p class="text-xs text-gray-400 italic line-clamp-1 mb-2">«{item.tracking.note}»</p>
		{/if}

		<div class="mt-auto pt-2 flex items-center justify-between border-t border-gray-700/50">
			<!-- Mini status button -->
			<div class="scale-90 origin-left">
				<StatusButton media={item.media} tracking={item.tracking} onTrackingChanged={() => {}} />
			</div>
		</div>
	</div>
</div>