<script lang="ts">
	import type { Snippet } from 'svelte';
	import Badge from './Badge.svelte';
	import { contentFilterStore } from '$lib/stores/contentFilter.svelte';
	import { shouldBlurAdult } from '$lib/utils/contentFilter';

	interface Props {
		/** Adult flag of the media the wrapped artwork belongs to. */
		isAdult?: boolean;
		/** Show a "tap to reveal" overlay that un-blurs the artwork (for non-clickable spots). */
		revealable?: boolean;
		/** Show the centered 18+ badge over blurred artwork (off for tiny thumbnails). */
		badge?: boolean;
		class?: string;
		children: Snippet;
	}

	let {
		isAdult,
		revealable = false,
		badge = true,
		class: extraClass = '',
		children,
	}: Props = $props();

	let revealed = $state(false);
	const blurred = $derived(
		!revealed && shouldBlurAdult({ isAdult }, contentFilterStore.effectiveMode),
	);
</script>

<div class="relative overflow-hidden {extraClass}">
	<div
		class="w-full h-full transition-[filter] duration-300 {blurred ? 'blur-xl scale-110' : ''}"
	>
		{@render children()}
	</div>
	{#if blurred}
		{#if revealable}
			<button
				type="button"
				onclick={() => (revealed = true)}
				aria-label="Reveal adult content"
				class="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/30 text-white cursor-pointer"
			>
				<Badge variant="rose" size="xs">18+</Badge>
				<span class="text-[11px] font-semibold">Tap to reveal</span>
			</button>
		{:else if badge}
			<div class="absolute inset-0 flex items-center justify-center pointer-events-none">
				<Badge variant="rose" size="xs">18+</Badge>
			</div>
		{/if}
	{/if}
</div>
