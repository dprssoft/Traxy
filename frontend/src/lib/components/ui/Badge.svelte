<script lang="ts">
	interface Props {
		variant?:
			| 'default'
			| 'indigo'
			| 'emerald'
			| 'amber'
			| 'rose'
			| 'purple'
			| 'sky'
			| 'slate';
		size?: 'xs' | 'sm' | 'md';
		dot?: boolean;
		class?: string;
		children: import('svelte').Snippet;
	}

	let {
		variant = 'default',
		size = 'sm',
		dot = false,
		class: extraClass = '',
		children,
	}: Props = $props();

	const variants: Record<string, string> = {
		default: 'bg-white/[0.06] text-slate-300 border-white/[0.08]',
		indigo: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
		emerald: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
		amber: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
		rose: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
		purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
		sky: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
		slate: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
	};

	const sizes: Record<string, string> = {
		xs: 'px-1.5 py-0.5 text-[10px]',
		sm: 'px-2 py-0.5 text-[11px]',
		md: 'px-2.5 py-1 text-xs',
	};

	const dotColors: Record<string, string> = {
		default: 'bg-slate-400',
		indigo: 'bg-indigo-400',
		emerald: 'bg-emerald-400',
		amber: 'bg-amber-400',
		rose: 'bg-rose-400',
		purple: 'bg-purple-400',
		sky: 'bg-sky-400',
		slate: 'bg-slate-400',
	};
</script>

<span
	class="inline-flex items-center gap-1 rounded font-bold border {variants[variant]} {sizes[size]} {extraClass}"
>
	{#if dot}
		<span class="w-1.5 h-1.5 rounded-full shrink-0 {dotColors[variant]}"></span>
	{/if}
	{@render children()}
</span>
