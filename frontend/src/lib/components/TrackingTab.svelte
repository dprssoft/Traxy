<script lang="ts">
	import type { TrackingListItem } from '$lib/types/trackingTypes';
	import { MEDIA_TYPE_LABELS } from '$lib/constants';
	import { Badge, Card } from '$lib/components/ui';
	import StatusButton from './StatusButton.svelte';

	interface Props {
		item: TrackingListItem;
	}

	let { item }: Props = $props();
</script>

<Card padding="none" class="overflow-hidden flex h-32 sm:h-36 group hover:border-indigo-500/30 transition-all duration-200">
	<!-- Poster -->
	<a href={`/media/${item.media.id}`} class="w-24 h-full shrink-0 overflow-hidden bg-slate-900">
		{#if item.media.posterUrl}
			<img src={item.media.posterUrl} alt={item.media.title} class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
		{:else}
			<div class="w-full h-full bg-[#181b2e] flex items-center justify-center">
				<span class="text-slate-500 font-bold text-lg">{item.media.title.substring(0, 2)}</span>
			</div>
		{/if}
	</a>

	<!-- Info -->
	<div class="p-3 sm:p-4 flex-1 flex flex-col min-w-0">
		<div class="flex items-baseline gap-2 min-w-0">
			<a href={`/media/${item.media.id}`} class="text-white font-bold text-base leading-tight truncate group-hover:text-indigo-400 transition-colors">
				{item.media.title}
			</a>
			{#if item.media.originalTitle && item.media.originalTitle !== item.media.title}
				<span class="hidden sm:block text-[11px] text-slate-500 truncate">{item.media.originalTitle}</span>
			{/if}
			{#if item.media.year}
				<span class="ml-auto text-xs text-slate-400 shrink-0">{item.media.year}</span>
			{/if}
		</div>

		<div class="mt-1.5 pb-1.5 border-b border-white/[0.06]">
			<Badge variant="indigo" size="xs" class="uppercase tracking-wider">
				{MEDIA_TYPE_LABELS[item.media.type] ?? item.media.type}
			</Badge>
		</div>

		<div class="mt-auto scale-90 origin-left">
			<StatusButton media={item.media} tracking={item.tracking} onTrackingChanged={() => {}} />
		</div>
	</div>
</Card>
