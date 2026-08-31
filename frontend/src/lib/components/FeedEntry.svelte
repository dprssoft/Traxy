<script lang="ts">
	import type { FeedItem, ActivityItem, GroupedActivityItem } from '$lib/types/activityTypes';
	import { isGrouped } from '$lib/types/activityTypes';
	import { getMediaTypeGroup, STATUS_LABELS_BY_GROUP, MEDIA_TYPE_LABELS } from '$lib/constants';

	interface Props {
		activity: FeedItem;
	}
	let { activity }: Props = $props();

	// ---------------------------------------------------------------------------
	// 5. Timestamp formatting (seconds/minutes/hours/days/month/years ago)
	// ---------------------------------------------------------------------------
	function formatTimestamp(dateString: string): string {
		const date = new Date(dateString);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		if (isNaN(diffMs) || diffMs < 0) return 'Just now';

		const diffSecs = Math.floor(diffMs / 1000);
		if (diffSecs < 10) return 'Just now';
		if (diffSecs < 60) return `${diffSecs}s ago`;

		const diffMins = Math.floor(diffSecs / 60);
		if (diffMins < 60) return `${diffMins}m ago`;

		const diffHours = Math.floor(diffMins / 60);
		if (diffHours < 24) return `${diffHours}h ago`;

		const diffDays = Math.floor(diffHours / 24);
		if (diffDays === 1) return 'Yesterday';
		if (diffDays < 30) return `${diffDays}d ago`;

		const diffMonths = Math.floor(diffDays / 30.4375);
		if (diffMonths < 12) {
			return diffMonths <= 1 ? '1 month ago' : `${diffMonths} months ago`;
		}

		const diffYears = Math.floor(diffDays / 365.25);
		return diffYears <= 1 ? '1 year ago' : `${diffYears} years ago`;
	}

	// ---------------------------------------------------------------------------
	// Helpers & Derived State
	// ---------------------------------------------------------------------------
	const grouped = $derived(isGrouped(activity));
	const single = $derived(!grouped ? (activity as ActivityItem) : null);
	const groupedItem = $derived(grouped ? (activity as GroupedActivityItem) : null);

	const category = $derived(activity.category ?? 'user_action');
	const eventType = $derived(activity.eventType);
	const payload = $derived(single?.payload ?? {});
	const title = $derived(activity.mediaTitle || 'Media');

	// ---------------------------------------------------------------------------
	// 6. Icon (User action, System message, Media message)
	// ---------------------------------------------------------------------------
	const icon = $derived(() => {
		if (single?.icon) return single.icon;
		if (groupedItem?.icon) return groupedItem.icon;

		// System icons
		if (category === 'system') {
			switch (eventType) {
				case 'backup_created': return '💾';
				case 'backup_failed': return '⚠️';
				case 'mal_import':
				case 'anilist_import':
				case 'tmdb_import':
				case 'import_completed': return '📥';
				case 'import_failed': return '❌';
				case 'app_error': return '❌';
				case 'app_warning': return '⚠️';
				default: return '⚙️';
			}
		}

		// Media update icons
		if (category === 'media_update') {
			switch (eventType) {
				case 'media_new_episode':
				case 'media_new_season': return '📺';
				case 'media_new_chapter':
				case 'media_new_volume': return '📖';
				case 'media_dropped': return '🛑';
				case 'media_hiatus': return '⏸️';
				default: return '📢';
			}
		}

		// User action icons
		switch (eventType) {
			case 'status_changed': return '🏷️';
			case 'score_set':
			case 'score_changed': return '⭐';
			case 'episode_watched': return '📺';
			case 'chapter_read':
			case 'pages_updated':
			case 'issue_read': return '📖';
			case 'hours_updated': return '🎮';
			case 'rewatch_started':
			case 'rewatch_completed': return '🔄';
			case 'note_updated': return '📝';
			case 'collection_created':
			case 'added_to_collection':
			case 'removed_from_collection': return '📋';
			case 'profile_updated': return '👤';
			default: return '⏱️';
		}
	});

	// ---------------------------------------------------------------------------
	// 3. Entry Message (User action, System message, Media message)
	// ---------------------------------------------------------------------------
	const message = $derived(() => {
		if (single?.actionText) return single.actionText;

		// a. User actions
		if (category === 'user_action') {
			switch (eventType) {
				// a1. Marked
				case 'status_changed': {
					const to = payload.to as string | undefined;
					if (to) {
						const group = getMediaTypeGroup(activity.mediaType ?? 'film');
						const label = STATUS_LABELS_BY_GROUP[group][to] ?? to;
						if (to === 'in_progress') {
							if (group === 'game') return `Playing ${title}`;
							if (group === 'read') return `Reading ${title}`;
							return `Watching ${title}`;
						}
						if (to === 'completed') {
							if (group === 'read') return `Read ${title}`;
							return `Completed ${title}`;
						}
						if (to === 'planned') return `Added ${title} to Plan`;
						if (to === 'dropped') return `Dropped ${title}`;
						if (to === 'paused') return `Paused ${title}`;
						return `Marked "${label}" — ${title}`;
					}
					return `Updated status for ${title}`;
				}

				// a2. TV/Anime, Manga/Comic tracking
				case 'episode_watched': {
					if (grouped && groupedItem) {
						if (groupedItem.season) {
							return `Watched S${String(groupedItem.season).padStart(2, '0')}E${String(groupedItem.from).padStart(2, '0')}–E${String(groupedItem.to).padStart(2, '0')} of ${title}`;
						}
						return `Watched episodes ${groupedItem.from}–${groupedItem.to} of ${title}`;
					}
					if (payload.season && payload.episode) {
						return `Watched S${String(payload.season).padStart(2, '0')}E${String(payload.episode).padStart(2, '0')} of ${title}`;
					}
					if (payload.episodes && payload.episodes > 1) {
						return `Watched ${payload.episodes} episodes of ${title}`;
					}
					if (payload.episode) {
						return `Watched episode ${payload.episode} of ${title}`;
					}
					return `Watched episode of ${title}`;
				}

				case 'chapter_read': {
					if (grouped && groupedItem) {
						return `Read chapters ${groupedItem.from}–${groupedItem.to} of ${title}`;
					}
					if (payload.volume && payload.chapter) {
						return `Read vol. ${payload.volume} ch. ${payload.chapter} of ${title}`;
					}
					if (payload.chapters && payload.chapters > 1) {
						return `Read ${payload.chapters} chapters of ${title}`;
					}
					if (payload.chapter) {
						return `Read chapter ${payload.chapter} of ${title}`;
					}
					return `Read chapter of ${title}`;
				}

				case 'issue_read':
					return `Read issue #${payload.issue ?? ''} of ${title}`;

				case 'pages_updated':
					return `Read to page ${payload.page ?? ''} of ${title}`;

				case 'hours_updated':
					return `Played ${payload.hours ?? 0} hours of ${title}`;

				// a3. Rated
				case 'score_set':
				case 'score_changed':
					return `Rated ${title} ${payload.score ?? 0}/10 ★`;

				// a4. Added note
				case 'note_updated':
					return `Added note to ${title}`;

				// a5. Created list
				case 'collection_created': {
					const cType = payload.collectionType;
					const mType = payload.collectionMediaType;
					if (cType === 'mono' && mType) {
						const mediaLabel = MEDIA_TYPE_LABELS[mType] ?? mType;
						return `Created a ${mediaLabel} list`;
					}
					return 'Created a list';
				}

				case 'added_to_collection':
					return `Added ${title} to ${payload.collectionName ?? 'list'}`;

				case 'removed_from_collection':
					return `Removed ${title} from ${payload.collectionName ?? 'list'}`;

				// a6. User updated profile
				case 'profile_updated':
					return `${payload.username || 'User'} updated profile`;

				case 'rewatch_started':
					return `Started replay/rewatch #${payload.cycleNumber ?? 1} of ${title}`;

				case 'rewatch_completed':
					return `Finished replay/rewatch #${payload.cycleNumber ?? 1} of ${title}`;

				default:
					return `Activity on ${title}`;
			}
		}

		// b. System messages
		if (category === 'system') {
			switch (eventType) {
				case 'backup_created':
					return 'Backup created successfully';
				case 'backup_failed':
					return 'Backup failed';
				case 'mal_import':
					return `Imported ${payload.count ?? 0} records from MyAnimeList`;
				case 'anilist_import':
					return `Imported ${payload.count ?? 0} records from AniList`;
				case 'tmdb_import':
					return `Imported ${payload.count ?? 0} records from TMDB`;
				case 'import_completed':
					return `Import completed — ${payload.count ?? 0} records`;
				case 'import_failed':
					return 'Import failed';
				case 'app_error':
					return payload.message || 'System error occurred';
				case 'app_warning':
					return payload.message || 'System warning';
				default:
					return payload.message || 'System notification';
			}
		}

		// c. Media messages
		if (category === 'media_update') {
			switch (eventType) {
				case 'media_new_episode':
					return `${title} — new episode available`;
				case 'media_new_season':
					return `${title} — new season available`;
				case 'media_new_chapter':
					return `${title} — new chapter available`;
				case 'media_new_volume':
					return `${title} — new volume available`;
				case 'media_dropped':
					return `${title} last episode/chapter was dropped`;
				case 'media_hiatus':
					return `${title} was set on hiatus`;
				default:
					return `${title} updated`;
			}
		}

		return title;
	});

	// ---------------------------------------------------------------------------
	// 4. Entry Details (User action details, System details, Media message details)
	// ---------------------------------------------------------------------------
	const details = $derived(() => {
		if (single?.details) return single.details;
		if (single?.subtitle) return single.subtitle;
		if (groupedItem?.details) return groupedItem.details;

		// System details
		if (category === 'system') {
			if (payload.details) return payload.details;
			if (payload.error) return payload.error;
			if (eventType === 'backup_created' && payload.collectionName) return payload.collectionName;
			return undefined;
		}

		// Media update details
		if (category === 'media_update') {
			if (payload.details) return payload.details;
			const typeLabel = activity.mediaType ? (MEDIA_TYPE_LABELS[activity.mediaType] ?? activity.mediaType) : '';
			return typeLabel ? `${typeLabel} update` : undefined;
		}

		// User action details
		if (eventType === 'status_changed' && payload.from && payload.to) {
			const group = getMediaTypeGroup(activity.mediaType ?? 'film');
			const fromLabel = STATUS_LABELS_BY_GROUP[group][payload.from as string] ?? payload.from;
			const toLabel = STATUS_LABELS_BY_GROUP[group][payload.to as string] ?? payload.to;
			return `${fromLabel} → ${toLabel}`;
		}

		if (eventType === 'collection_created') {
			return payload.collectionName ? `“${payload.collectionName}”` : undefined;
		}

		if (activity.mediaType) {
			const typeLabel = MEDIA_TYPE_LABELS[activity.mediaType] ?? activity.mediaType;
			return typeLabel;
		}

		return undefined;
	});

	// ---------------------------------------------------------------------------
	// 1. Entry Body (Inline first 20 symbols with ellipsis)
	// ---------------------------------------------------------------------------
	const rawBody = $derived(
		single?.body ??
		payload.note ??
		payload.message ??
		null
	);

	const bodyPreview = $derived(() => {
		if (!rawBody) return null;
		const trimmed = rawBody.trim();
		if (!trimmed) return null;
		return trimmed.length > 20 ? trimmed.slice(0, 20) + '…' : trimmed;
	});

	// ---------------------------------------------------------------------------
	// 2. Entry Image (Media poster or System image)
	// ---------------------------------------------------------------------------
	const posterUrl = $derived(activity.mediaPosterUrl || single?.imageUrl);
	const imageKind = $derived< 'poster' | 'system' >(
		posterUrl ? (single?.imageKind ?? 'poster') : 'system'
	);

	const systemBgClass = $derived(() => {
		if (category === 'system') {
			if (eventType === 'app_error' || eventType === 'backup_failed' || eventType === 'import_failed') {
				return 'bg-red-500/15 text-red-400 border-red-500/30';
			}
			if (eventType === 'app_warning') {
				return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
			}
			return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
		}
		if (category === 'media_update') {
			if (eventType === 'media_dropped') return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
			if (eventType === 'media_hiatus') return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
			return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
		}
		return 'bg-[#1a1d30] text-slate-300 border-white/[0.08]';
	});

	const timeString = $derived(formatTimestamp(activity.occurredAt));
	const href = $derived(
		single?.href ?? (activity.mediaId ? `/media/${activity.mediaId}` : null)
	);
</script>

<svelte:element
	this={href ? 'a' : 'div'}
	{href}
	class="group relative flex items-center justify-between gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl bg-[#131627]/85 hover:bg-[#191d33] border border-white/[0.08] hover:border-indigo-500/30 transition-all duration-200 shadow-sm hover:shadow-indigo-500/5 select-none"
>
	<div class="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
		<!-- 2. Entry Image: Media poster or System image -->
		<div class="relative shrink-0">
			{#if imageKind === 'poster' && posterUrl}
				<img
					src={posterUrl}
					alt={title}
					class="w-13 h-13 sm:w-15 sm:h-15 object-cover rounded-xl shadow-md bg-slate-900 border border-white/[0.08] group-hover:scale-105 transition-transform"
				/>
			{:else}
				<div
					class="w-13 h-13 sm:w-15 sm:h-15 rounded-xl border flex items-center justify-center shadow-inner group-hover:brightness-110 transition-all {systemBgClass()}"
				>
					<span class="text-xl sm:text-2xl">{icon()}</span>
				</div>
			{/if}

			{#if grouped && groupedItem}
				<!-- Count badge for grouped entries -->
				<span
					class="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 bg-indigo-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none shadow-md shadow-indigo-900/50 border border-indigo-400/40"
				>
					×{groupedItem.count}
				</span>
			{/if}
		</div>

		<!-- Center: 6 (Icon), 5 (Timestamp), 3 (Message), 4 (Details) -->
		<div class="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
			<!-- Top line: 6 (Icon) + 5 (Timestamp) -->
			<div class="flex items-center gap-1.5">
				<span class="text-xs leading-none opacity-80">{icon()}</span>
				<span class="text-[11px] font-medium text-slate-400">
					{timeString}
				</span>
				{#if grouped && groupedItem}
					<span
						class="text-[10px] font-semibold text-indigo-400 bg-indigo-500/15 border border-indigo-500/25 rounded-full px-1.5 py-0.5 leading-none"
					>
						{groupedItem.count} in a row
					</span>
				{/if}
			</div>

			<!-- 3. Entry Message (Bold) -->
			<h3
				class="text-white font-bold text-sm sm:text-base leading-snug group-hover:text-indigo-300 transition-colors truncate"
			>
				{message()}
			</h3>

			<!-- 4. Entry Details (Small) -->
			{#if details()}
				<p class="text-slate-400 text-xs font-normal truncate">
					{details()}
				</p>
			{/if}
		</div>
	</div>

	<!-- 1. Entry Body (Inline first 20 symbols + ellipsis) -->
	{#if bodyPreview()}
		<div class="shrink-0 hidden xs:flex sm:flex items-center max-w-[130px] sm:max-w-[170px] pl-2">
			<span
				class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06] text-slate-300 text-xs italic truncate font-sans group-hover:border-indigo-500/20 group-hover:bg-indigo-950/20 transition-colors"
				title={rawBody ?? ''}
			>
				<span class="text-indigo-400 font-serif not-italic">“</span>
				<span class="truncate">{bodyPreview()}</span>
				<span class="text-indigo-400 font-serif not-italic">”</span>
			</span>
		</div>
	{/if}
</svelte:element>
