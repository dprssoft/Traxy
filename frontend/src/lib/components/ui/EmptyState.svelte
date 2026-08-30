<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		icon?: string;
		title?: string;
		description?: string;
		dashed?: boolean;
		class?: string;
		action?: Snippet;
	}

	let {
		icon = '🗂️',
		title = 'Nothing here yet',
		description,
		dashed = false,
		class: extraClass = '',
		action,
	}: Props = $props();
</script>

<div
	class="py-14 px-6 text-center flex flex-col items-center gap-4
		{dashed ? 'border border-dashed border-white/[0.10] rounded-2xl' : ''}
		{extraClass}"
>
	<div
		class="w-16 h-16 rounded-3xl bg-gradient-to-tr from-indigo-600/20 to-purple-600/20 border border-indigo-500/20 flex items-center justify-center text-3xl shadow-lg shadow-indigo-500/10"
	>
		{icon}
	</div>
	<div class="space-y-1">
		<p class="text-base font-bold text-white">{title}</p>
		{#if description}
			<p class="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">{description}</p>
		{/if}
	</div>
	{#if action}
		{@render action()}
	{/if}
</div>
