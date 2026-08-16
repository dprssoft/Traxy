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
			if (tracking.hoursPlayed) return `${tracking.hoursPlayed} hrs`;
			return '';
		}

		if (media.type === 'book') {
			if (tracking.currentPage) return `p. ${tracking.currentPage} / ${media.totalPages ?? '?'}`;
			return '';
		}

		// comics, manga, manhwa
		if (tracking.currentChapter) return `Ch. ${tracking.currentChapter}`;
		if (tracking.currentIssue) return `Issue #${tracking.currentIssue}`;
		
		return '';
	}

	const progressText = $derived(getProgressText(item.media, item.tracking));
</script>

<div class="bg-[#121422]/70 hover:bg-[#16192b] border border-white/[0.06] hover:border-indigo-500/30 rounded-2xl overflow-hidden transition-all duration-200 flex flex-col sm:flex-row h-auto sm:h-36 group shadow-md hover:shadow-indigo-500/5">
	<!-- Poster -->
	<a href={`/media/${item.media.id}`} class="w-full sm:w-24 h-44 sm:h-full shrink-0 overflow-hidden bg-slate-900">
		{#if item.media.posterUrl}
			<img src={item.media.posterUrl} alt={item.media.title} class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
		{:else}
			<div class="w-full h-full bg-[#181b2e] flex items-center justify-center">
				<span class="text-slate-500 font-bold text-lg">{item.media.title.substring(0,2)}</span>
			</div>
		{/if}
	</a>

	<!-- Info -->
	<div class="p-4 flex-1 flex flex-col min-w-0">
		<div class="flex items-start justify-between gap-4 mb-1">
			<a href={`/media/${item.media.id}`} class="text-white font-bold text-base leading-tight truncate group-hover:text-indigo-400 transition-colors">
				{item.media.title}
			</a>
			{#if item.tracking.score}
				<span class="text-amber-400 font-bold text-xs bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 whitespace-nowrap shrink-0">
					★ {item.tracking.score}/10
				</span>
			{/if}
		</div>
		
		<div class="flex items-center gap-2 mb-2 flex-wrap">
			<span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
				{MEDIA_TYPE_LABELS[item.media.type] ?? item.media.type}
			</span>
			{#if progressText}
				<span class="text-[11px] font-medium text-slate-300 bg-[#181b2e] border border-white/[0.08] rounded-md px-2 py-0.5">
					{progressText}
				</span>
			{/if}
			{#if item.tracking.completionTier}
				<span class="text-[11px] font-medium text-slate-400 bg-[#181b2e] border border-white/[0.06] rounded-md px-1.5 py-0.5">
					{item.tracking.completionTier === 'main_story' ? 'Story' : item.tracking.completionTier === 'completionist' ? '100%' : 'Story+Sides'}
				</span>
			{/if}
		</div>

		<!-- Optional note -->
		{#if item.tracking.note}
			<p class="text-xs text-slate-400 italic line-clamp-1 mb-2 font-serif">«{item.tracking.note}»</p>
		{/if}

		<div class="mt-auto pt-2 flex items-center justify-between border-t border-white/[0.04]">
			<!-- Mini status button -->
			<div class="scale-90 origin-left">
				<StatusButton media={item.media} tracking={item.tracking} onTrackingChanged={() => {}} />
			</div>
		</div>
	</div>
</div>