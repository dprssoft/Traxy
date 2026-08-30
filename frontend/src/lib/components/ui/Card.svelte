<script lang="ts">
	interface Props {
		class?: string;
		padding?: 'sm' | 'md' | 'lg' | 'none';
		children: import('svelte').Snippet;
	}

	let { class: extraClass = '', padding = 'md', children }: Props = $props();

	const paddings: Record<string, string> = {
		none: '',
		sm: 'p-4',
		md: 'p-5 sm:p-6',
		lg: 'p-6 sm:p-8',
	};
</script>

<div
	class="bg-[#121422]/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-xl {paddings[padding]} {extraClass}"
>
	{@render children()}
</div>
