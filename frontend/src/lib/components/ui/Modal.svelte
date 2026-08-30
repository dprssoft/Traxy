<script lang="ts">
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		open: boolean;
		onclose?: () => void;
		title?: string;
		size?: 'sm' | 'md' | 'lg' | 'xl';
		children: Snippet;
		footer?: Snippet;
	}

	let { open = $bindable(), onclose, title, size = 'md', children, footer }: Props = $props();

	const sizes: Record<string, string> = {
		sm: 'max-w-sm',
		md: 'max-w-md',
		lg: 'max-w-lg',
		xl: 'max-w-2xl',
	};

	function close() {
		open = false;
		onclose?.();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
	}

	onMount(() => {
		document.addEventListener('keydown', handleKeydown);
		return () => document.removeEventListener('keydown', handleKeydown);
	});

	$effect(() => {
		if (open) {
			document.body.style.overflow = 'hidden';
		} else {
			document.body.style.overflow = '';
		}
		return () => {
			document.body.style.overflow = '';
		};
	});
</script>

{#if open}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
		role="dialog"
		aria-modal="true"
		aria-label={title}
	>
		<!-- Overlay -->
		<button
			class="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-default"
			onclick={close}
			aria-label="Close modal"
			tabindex="-1"
		></button>

		<!-- Panel -->
		<div
			class="relative w-full {sizes[size]} bg-[#0d0e1a] border border-white/[0.10] rounded-3xl shadow-2xl shadow-black/60 animate-in"
		>
			{#if title}
				<div
					class="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/[0.06]"
				>
					<h2 class="text-base font-bold text-white">{title}</h2>
					<button
						onclick={close}
						class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
						aria-label="Close"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<line x1="18" y1="6" x2="6" y2="18"></line>
							<line x1="6" y1="6" x2="18" y2="18"></line>
						</svg>
					</button>
				</div>
			{/if}

			<div class="p-6">
				{@render children()}
			</div>

			{#if footer}
				<div class="px-6 pb-6 pt-0">
					{@render footer()}
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.animate-in {
		animation: slide-up 0.2s ease-out;
	}
	@keyframes slide-up {
		from {
			opacity: 0;
			transform: translateY(12px) scale(0.98);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}
</style>
