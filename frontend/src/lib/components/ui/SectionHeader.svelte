<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		subtitle?: string;
		class?: string;
		actions?: Snippet;
	}

	let { title, subtitle, class: extraClass = '', actions }: Props = $props();
</script>

<div class="flex items-start justify-between gap-4 {extraClass}">
	<div>
		<h2 class="text-xl font-bold text-white">{title}</h2>
		{#if subtitle}
			<p class="text-xs text-slate-400 mt-0.5 leading-relaxed">{subtitle}</p>
		{/if}
	</div>
	{#if actions}
		<div class="shrink-0 flex items-center gap-2">
			{@render actions()}
		</div>
	{/if}
</div>
