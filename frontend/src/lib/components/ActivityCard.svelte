<script lang="ts">
	import type { ActivityItem } from '$lib/types/activityTypes';
	import { getMediaTypeGroup, STATUS_LABELS_BY_GROUP } from '$lib/constants';

	interface Props {
		activity: ActivityItem;
	}
	let { activity }: Props = $props();

	function getEventDescription(item: ActivityItem): string {
		const p = item.payload;
		switch (item.eventType) {
			case 'status_changed':
				if (p.to) {
					const group = getMediaTypeGroup(item.mediaType);
					const label = STATUS_LABELS_BY_GROUP[group][p.to] ?? p.to;
					return `Marked as «${label}»`;
				}
				return 'Status changed';
			case 'score_set':
			case 'score_changed':
				return `Rated ${p.score}/10 ★`;
			case 'episode_watched':
				if (p.season && p.episode) return `Watched S${p.season.toString().padStart(2, '0')}E${p.episode.toString().padStart(2, '0')}`;
				if (p.episode) return `Watched episode ${p.episode}`;
				return 'Watched episode';
			case 'chapter_read':
				if (p.volume && p.chapter) return `Read ch. ${p.chapter} vol. ${p.volume}`;
				if (p.chapter) return `Read chapter ${p.chapter}`;
				return 'Read chapter';
			case 'pages_updated':
				return `Read to page ${p.page}`;
			case 'issue_read':
				return `Read issue #${p.issue}`;
			case 'hours_updated':
				return `Hours played: ${p.hours}`;
			case 'rewatch_started':
				return `Started replay/rewatch #${p.cycleNumber}`;
			case 'note_updated':
				return 'Updated note';
			case 'mal_import':
				return `Imported ${p.count} records from MyAnimeList`;
			default:
				return item.eventType;
		}
	}

	function getEventIcon(eventType: string): string {
		switch (eventType) {
			case 'status_changed': return '🏷️';
			case 'score_set':
			case 'score_changed': return '⭐';
			case 'episode_watched': return '📺';
			case 'chapter_read':
			case 'pages_updated':
			case 'issue_read': return '📖';
			case 'hours_updated': return '🎮';
			case 'rewatch_started': return '🔄';
			case 'note_updated': return '📝';
			case 'mal_import': return '📥';
			default: return '📌';
		}
	}

	function timeAgo(dateString: string): string {
		const date = new Date(dateString);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		
		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		
		const diffHours = Math.floor(diffMins / 60);
		if (diffHours < 24) return `${diffHours}h ago`;
		
		const diffDays = Math.floor(diffHours / 24);
		if (diffDays === 1) return 'Yesterday';
		if (diffDays < 30) return `${diffDays}d ago`;
		
		return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
	}

	const description = $derived(getEventDescription(activity));
	const icon = $derived(getEventIcon(activity.eventType));
	const time = $derived(timeAgo(activity.occurredAt));
</script>

<a 
	href={`/media/${activity.mediaId}`}
	class="block bg-[#121422]/70 hover:bg-[#171a2e] border border-white/[0.06] hover:border-indigo-500/30 rounded-2xl p-4 transition-all duration-200 group shadow-sm hover:shadow-indigo-500/5"
>
	<div class="flex gap-4 items-center">
		{#if activity.mediaPosterUrl}
			<img src={activity.mediaPosterUrl} alt={activity.mediaTitle} class="w-12 h-16 sm:w-16 sm:h-20 object-cover rounded-xl shadow-md bg-slate-900 border border-white/[0.06] shrink-0 group-hover:scale-105 transition-transform" />
		{:else}
			<div class="w-12 h-16 sm:w-16 sm:h-20 bg-[#181b2e] rounded-xl border border-white/[0.06] flex items-center justify-center shrink-0">
				<span class="text-slate-500 font-bold text-xs">{activity.mediaTitle.substring(0, 2)}</span>
			</div>
		{/if}

		<div class="flex-1 min-w-0 flex flex-col justify-center">
			<div class="flex items-center gap-2 mb-1.5">
				<span class="text-xs p-1 bg-white/[0.04] border border-white/[0.06] rounded-lg shrink-0">{icon}</span>
				<span class="text-slate-400 text-xs font-medium">{time}</span>
			</div>
			<p class="text-white font-semibold text-sm sm:text-base leading-snug group-hover:text-indigo-400 transition-colors">
				{description} <span class="text-slate-400 font-normal">· {activity.mediaTitle}</span>
			</p>
		</div>
	</div>
</a>
