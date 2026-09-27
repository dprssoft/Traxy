<!--
@component
Row of toggle chips. `multiple` lets any number be on; otherwise picking a chip replaces the
selection, and picking the selected chip again clears it (when `allowEmpty`).
-->
<script lang="ts" generics="T extends string">
	interface Option {
		value: T;
		label: string;
	}

	interface Props {
		options: Option[];
		selected: T[];
		onchange: (selected: T[]) => void;
		multiple?: boolean;
		allowEmpty?: boolean;
		/** Wrap onto several lines instead of scrolling sideways. */
		wrap?: boolean;
		label: string;
		class?: string;
	}

	let {
		options,
		selected,
		onchange,
		multiple = false,
		allowEmpty = true,
		wrap = false,
		label,
		class: extraClass = '',
	}: Props = $props();

	function toggle(value: T) {
		const on = selected.includes(value);
		if (multiple) {
			onchange(on ? selected.filter((v) => v !== value) : [...selected, value]);
		} else if (on) {
			if (allowEmpty) onchange([]);
		} else {
			onchange([value]);
		}
	}
</script>

<div
	role="group"
	aria-label={label}
	class="flex gap-1.5 {wrap ? 'flex-wrap' : 'overflow-x-auto scrollbar-hide'} {extraClass}"
>
	{#each options as option (option.value)}
		{@const on = selected.includes(option.value)}
		<button
			type="button"
			aria-pressed={on}
			onclick={() => toggle(option.value)}
			class="px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/40 {on
				? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
				: 'bg-[#181b2e] text-slate-400 hover:text-white hover:bg-[#20243d] border border-white/[0.06]'}"
		>
			{option.label}
		</button>
	{/each}
</div>
