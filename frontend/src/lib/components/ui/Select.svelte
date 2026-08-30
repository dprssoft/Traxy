<script lang="ts">
	interface Option {
		value: string;
		label: string;
	}

	interface Props {
		options: Option[];
		value: string;
		onchange?: (value: string) => void;
		id?: string;
		placeholder?: string;
		class?: string;
		disabled?: boolean;
	}

	let {
		options,
		value = $bindable(),
		onchange,
		id,
		placeholder,
		class: extraClass = '',
		disabled = false,
	}: Props = $props();

	function handleChange(e: Event) {
		const v = (e.target as HTMLSelectElement).value;
		value = v;
		onchange?.(v);
	}
</script>

<div class="relative {extraClass}">
	<select
		{id}
		{disabled}
		{value}
		onchange={handleChange}
		class="w-full appearance-none bg-[#0a0b12] border border-white/[0.1] rounded-xl px-3 py-2.5 pr-9 text-white text-sm placeholder-slate-500
			focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-colors cursor-pointer
			disabled:opacity-50 disabled:pointer-events-none"
	>
		{#if placeholder}
			<option value="" disabled selected={!value}>{placeholder}</option>
		{/if}
		{#each options as opt}
			<option value={opt.value} selected={value === opt.value}>{opt.label}</option>
		{/each}
	</select>
	<!-- Chevron icon -->
	<div class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2.5"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<polyline points="6 9 12 15 18 9"></polyline>
		</svg>
	</div>
</div>
