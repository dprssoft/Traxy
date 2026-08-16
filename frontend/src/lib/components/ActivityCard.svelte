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
				if (p.volume && p.chapter) return `Прочитав розд. ${p.chapter} т. ${p.volume}`;
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
		if (diffMins < 60) return `${diffMins} хв. тому`;
		
		const diffHours = Math.floor(diffMins / 60);
		if (diffHours < 24) return `${diffHours} год. тому`;
		
		const diffDays = Math.floor(diffHours / 24);
		if (diffDays === 1) return 'Yesterday';
		if (diffDays < 30) return `${diffDays} дн. тому`;
		
		return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
	}

	const description = $derived(getEventDescription(activity));
	const icon = $derived(getEventIcon(activity.eventType));
	const time = $derived(timeAgo(activity.occurredAt));
</script>

<a 
	href={`/media/${activity.mediaId}`}
	class="block bg-gray-800/50 hover:bg-gray-800/80 border border-gray-700 rounded-xl p-4 transition-colors group"
>
	<div class="flex gap-4">
		{#if activity.mediaPosterUrl}
			<img src={activity.mediaPosterUrl} alt={activity.mediaTitle} class="w-12 h-16 sm:w-16 sm:h-24 object-cover rounded shadow-md shrink-0" />
		{:else}
			<div class="w-12 h-16 sm:w-16 sm:h-24 bg-gray-700 rounded border border-gray-600 flex items-center justify-center shrink-0">
				<span class="text-gray-500 font-bold text-xs">{activity.mediaTitle.substring(0, 2)}</span>
			</div>
		{/if}

		<div class="flex-1 min-w-0 flex flex-col justify-center">
			<div class="flex items-center gap-2 mb-1">
				<span class="text-sm bg-gray-700 w-6 h-6 flex items-center justify-center rounded-full shrink-0">{icon}</span>
				<span class="text-gray-400 text-xs">{time}</span>
			</div>
			<p class="text-white font-medium text-sm sm:text-base leading-snug group-hover:text-brand-accent transition-colors">
				{description} <span class="text-gray-400">· {activity.mediaTitle}</span>
			</p>
		</div>
	</div>
</a>
