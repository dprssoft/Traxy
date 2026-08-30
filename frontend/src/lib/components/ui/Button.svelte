<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon';
		size?: 'sm' | 'md' | 'lg';
		loading?: boolean;
		disabled?: boolean;
		type?: 'button' | 'submit' | 'reset';
		class?: string;
		onclick?: (e: MouseEvent) => void;
		children: Snippet;
	}

	let {
		variant = 'primary',
		size = 'md',
		loading = false,
		disabled = false,
		type = 'button',
		class: extraClass = '',
		onclick,
		children,
	}: Props = $props();

	const base =
		'inline-flex items-center justify-center gap-2 font-bold rounded-xl transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/40 active:scale-95 disabled:opacity-50 disabled:pointer-events-none';

	const variants: Record<string, string> = {
		primary:
			'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/20',
		secondary:
			'bg-[#1e2238] hover:bg-[#252a45] text-slate-200 hover:text-white border border-white/[0.08]',
		ghost: 'bg-transparent hover:bg-white/[0.06] text-slate-300 hover:text-white',
		danger:
			'bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 hover:text-rose-300 border border-rose-500/20',
		icon: 'bg-[#121422] hover:bg-[#181b2e] border border-white/[0.08] text-slate-300 hover:text-white rounded-xl shadow-sm',
	};

	const sizes: Record<string, string> = {
		sm: 'px-3 py-1.5 text-xs',
		md: 'px-5 py-2.5 text-sm',
		lg: 'px-7 py-3 text-base',
	};

	const iconSizes: Record<string, string> = {
		sm: 'p-1.5',
		md: 'p-2.5',
		lg: 'p-3',
	};

	const sizeClass = $derived(variant === 'icon' ? iconSizes[size] : sizes[size]);
	const cls = $derived(`${base} ${variants[variant]} ${sizeClass} ${extraClass}`);
</script>

<button {type} class={cls} disabled={disabled || loading} {onclick}>
	{#if loading}
		<svg
			class="animate-spin h-4 w-4 shrink-0"
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
		>
			<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
			></circle>
			<path
				class="opacity-75"
				fill="currentColor"
				d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
			></path>
		</svg>
	{/if}
	{@render children()}
</button>
