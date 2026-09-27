<script lang="ts">
	interface Props {
		/** May be async (e.g. importing a catalogue item first); a spinner shows meanwhile. */
		onclick: () => void | Promise<void>;
		label?: string;
		class?: string;
	}

	let { onclick, label = 'Quick edit', class: extraClass = '' }: Props = $props();

	let busy = $state(false);

	async function handleClick(e: MouseEvent) {
		// Usually sits on top of a link or card button — don't trigger that too.
		e.preventDefault();
		e.stopPropagation();
		if (busy) return;
		busy = true;
		try {
			await onclick();
		} catch (err) {
			console.error('Quick edit failed to open', err);
		} finally {
			busy = false;
		}
	}
</script>

<button
	type="button"
	onclick={handleClick}
	aria-label={label}
	title={label}
	class="w-7 h-7 shrink-0 rounded-full flex items-center justify-center bg-black/60 hover:bg-indigo-600 backdrop-blur-md border border-white/15 text-white shadow-md transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/60 {extraClass}"
>
	{#if busy}
		<span class="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin"
		></span>
	{:else}
		<svg
			class="w-3.5 h-3.5"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			stroke-width="2.2"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M15.232 5.232l3.536 3.536M9 11l6.232-6.232a2.5 2.5 0 113.536 3.536L12.536 14.5 8 16l1.5-4.5z"
			/>
		</svg>
	{/if}
</button>
