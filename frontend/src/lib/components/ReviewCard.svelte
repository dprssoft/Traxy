<script lang="ts">
	import { resolve } from '$app/paths';
	import { renderMarkdown } from '$lib/utils/markdown';
	import SafeHtml from './SafeHtml.svelte';
	import StarRating from './StarRating.svelte';
	import { formatDate } from '$lib/utils/format';

	interface Props {
		mediaId: string;
		review: any;
		onDelete?: (id: string) => void;
		onUpdate?: (updated: any) => void;
	}

	let { mediaId, review, onDelete, onUpdate }: Props = $props();

	let showEditForm = $state(false);
	let confirmingDelete = $state(false);

	const compact = $derived(!review.content || review.content.trim() === '');
</script>

<article class="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm transition-shadow">
	<div class="flex items-center justify-between gap-3 {compact ? '' : 'mb-4'}">
		<div class="flex items-center gap-2">
			<div class="flex flex-col">
				{#if review.mediaTitle}
					<h3 class="font-bold text-gray-900 leading-tight">{review.mediaTitle}</h3>
				{/if}
				<div class="flex items-center gap-2 mt-1">
					<StarRating value={review.rating} size="sm" />
					<span class="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">{review.rating}/10</span>
				</div>
			</div>
		</div>

		<div class="flex items-center gap-2 shrink-0">
			<span class="text-xs text-gray-400 font-medium">{formatDate(review.createdAt)}</span>
			
			<button onclick={() => (showEditForm = true)} class="text-xs text-blue-500 hover:bg-blue-50 transition-colors px-2 py-1 rounded-md font-medium">Edit</button>
			
			{#if confirmingDelete}
				<div class="flex items-center gap-1 bg-red-50 px-2 py-1 rounded-md">
					<button onclick={() => { if(onDelete) onDelete(review.id); }} class="text-xs text-red-600 font-bold hover:text-red-700">Confirm</button>
					<span class="text-red-200">|</span>
					<button onclick={() => (confirmingDelete = false)} class="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
				</div>
			{:else}
				<button onclick={() => (confirmingDelete = true)} class="text-xs text-gray-400 hover:text-red-500 transition-colors px-2 py-1 rounded-md font-medium">Delete</button>
			{/if}
		</div>
	</div>

	{#if !compact && review.content}
		<SafeHtml
			content={renderMarkdown(review.content)}
			class="text-gray-700 text-sm leading-relaxed prose prose-sm max-w-none bg-gray-50/50 p-4 rounded-xl border border-gray-100"
		/>
	{/if}
</article>
