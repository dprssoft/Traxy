<script lang="ts">
	import { resolve } from '$app/paths';
	import type { CollectionSummary } from '$lib/types/collectionTypes';
	import { MEDIA_TYPE_PLURAL_LABELS } from '$lib/constants';
	import { Badge, Card } from '$lib/components/ui';

	interface Props {
		collection: CollectionSummary;
	}

	let { collection }: Props = $props();

	const SYSTEM_ICONS = { favorites: '❤️', wishlist: '🎁' } as const;

	// Always four tiles so the mosaic keeps its shape with fewer posters.
	const tiles = $derived(Array.from({ length: 4 }, (_, i) => collection.coverUrls[i] ?? null));
</script>

<a href={resolve(`/collections/${collection.id}`)} class="group block focus:outline-none">
	<Card
		padding="none"
		class="overflow-hidden h-full group-hover:border-indigo-500/30 group-focus-visible:ring-2 group-focus-visible:ring-indigo-500/40 transition-all"
	>
		<!-- Cover mosaic -->
		<div class="grid grid-cols-2 grid-rows-2 aspect-square gap-px bg-white/[0.04]">
			{#each tiles as url, i (i)}
				<div class="overflow-hidden bg-[#181b2e]">
					{#if url}
						<img
							src={url}
							alt=""
							loading="lazy"
							class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
						/>
					{:else if i === 0 && collection.coverUrls.length === 0}
						<div class="w-full h-full flex items-center justify-center text-2xl opacity-40">
							{collection.systemKey ? SYSTEM_ICONS[collection.systemKey] : '🗂️'}
						</div>
					{/if}
				</div>
			{/each}
		</div>

		<div class="p-3 space-y-1.5">
			<div class="flex items-center gap-1.5 min-w-0">
				{#if collection.systemKey}
					<span class="text-xs shrink-0">{SYSTEM_ICONS[collection.systemKey]}</span>
				{/if}
				<h3
					class="text-sm font-bold text-white truncate group-hover:text-indigo-300 transition-colors"
				>
					{collection.name}
				</h3>
			</div>
			<div class="flex items-center gap-1.5 flex-wrap">
				<span class="text-[11px] text-slate-400">
					{collection.itemCount}
					{collection.itemCount === 1 ? 'item' : 'items'}
				</span>
				<Badge variant={collection.mediaType ? 'indigo' : 'slate'} size="xs">
					{collection.mediaType ? MEDIA_TYPE_PLURAL_LABELS[collection.mediaType] : 'Shared'}
				</Badge>
				{#if collection.isRanked}
					<Badge variant="amber" size="xs">Top {collection.itemCount}</Badge>
				{/if}
			</div>
		</div>
	</Card>
</a>
