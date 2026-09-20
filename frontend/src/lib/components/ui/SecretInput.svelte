<script lang="ts">
	interface Props {
		value: string;
		id?: string;
		placeholder?: string;
		class?: string;
	}

	let { value = $bindable(), id, placeholder, class: extraClass = '' }: Props = $props();

	let visible = $state(false);
</script>

<div class="relative">
	<input
		type={visible ? 'text' : 'password'}
		{id}
		bind:value
		{placeholder}
		autocomplete="off"
		class="{extraClass} pr-11"
	/>
	<button
		type="button"
		onclick={() => (visible = !visible)}
		aria-label={visible ? 'Hide value' : 'Show value'}
		aria-pressed={visible}
		class="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			{#if visible}
				<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"></path>
				<path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"></path>
				<line x1="1" y1="1" x2="23" y2="23"></line>
			{:else}
				<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
				<circle cx="12" cy="12" r="3"></circle>
			{/if}
		</svg>
	</button>
</div>
