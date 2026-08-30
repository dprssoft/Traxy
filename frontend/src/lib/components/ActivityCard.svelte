<script lang="ts">
	import type { ActivityItem } from '$lib/types/activityTypes';
	import { getMediaTypeGroup, STATUS_LABELS_BY_GROUP } from '$lib/constants';

	interface Props {
		activity: ActivityItem;
	}
	let { activity }: Props = $props();

	function getEventDescription(item: ActivityItem): string {
		if (item.actionText) return item.actionText;

		const p = item.payload ?? {};
		switch (item.eventType) {
			case 'status_changed':
				if (p.to) {
					const group = getMediaTypeGroup(item.mediaType ?? 'film');
					const label = STATUS_LABELS_BY_GROUP[group][p.to] ?? p.to;
					return `Marked as "${label}"`;
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
				return item.eventType ?? 'Activity';
		}
	}

	function getEventIcon(item: ActivityItem): string {
		if (item.icon) return item.icon;
		if (item.category === 'system') return '⚙️';
		if (item.category === 'media_update') return '📢';
		switch (item.eventType) {
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
			default: return '⏱️';
		}
	}

	function timeAgo(dateString: string): string {
		const date = new Date(dateString);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		
		if (isNaN(diffMins) || diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		
		const diffHours = Math.floor(diffMins / 60);
		if (diffHours < 24) return `${diffHours}h ago`;
		
		const diffDays = Math.floor(diffHours / 24);
		if (diffDays === 1) return 'Yesterday';
		if (diffDays < 30) return `${diffDays}d ago`;
		
		return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
	}

	const actionTitle = $derived(getEventDescription(activity));
	const subtitleText = $derived(activity.subtitle ?? activity.mediaTitle);
	const icon = $derived(getEventIcon(activity));
	const time = $derived(timeAgo(activity.occurredAt));
	const href = $derived(activity.href ?? (activity.mediaId ? `/media/${activity.mediaId}` : null));
</script>

<svelte:element
	this={href ? 'a' : 'div'}
	{href}
	class="block bg-[#131627]/85 hover:bg-[#191d33] border border-white/[0.08] hover:border-indigo-500/30 rounded-2xl p-3.5 sm:p-4 transition-all duration-200 group shadow-sm hover:shadow-indigo-500/5 select-none"
>
	<div class="flex gap-3.5 sm:gap-4 items-center">
		<!-- Left: Square thumbnail/poster/icon from wireframe -->
		{#if activity.mediaPosterUrl}
			<img 
				src={activity.mediaPosterUrl} 
				alt={subtitleText} 
				class="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-xl shadow-md bg-slate-900 border border-white/[0.08] shrink-0 group-hover:scale-105 transition-transform" 
			/>
		{:else}
			<div class="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-[#1a1d30] border border-white/[0.08] flex items-center justify-center shrink-0 shadow-inner group-hover:bg-[#20253d] transition-colors">
				<span class="text-xl">{icon}</span>
			</div>
		{/if}

		<!-- Right: Action details from wireframe -->
		<div class="flex-1 min-w-0 flex flex-col justify-center">
			<!-- Top line: [icon] Time ago -->
			<div class="flex items-center gap-1.5 mb-0.5">
				<span class="text-[11px] text-slate-400 font-medium flex items-center gap-1">
					<span class="text-[10px] opacity-75">{icon}</span>
					<span>{time}</span>
				</span>
			</div>

			<!-- Middle line: Action (Bold) -->
			<h3 class="text-white font-bold text-sm sm:text-base leading-snug group-hover:text-indigo-300 transition-colors truncate">
				{actionTitle}
			</h3>

			<!-- Bottom line: Subtitle / Title / Additional information -->
			<p class="text-slate-400 text-xs sm:text-sm font-normal mt-0.5 truncate">
				{subtitleText}
			</p>
		</div>
	</div>
</svelte:element>
