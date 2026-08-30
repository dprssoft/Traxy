<script lang="ts">
	interface Props {
		checked: boolean;
		onchange?: (value: boolean) => void;
		id?: string;
		label?: string;
		disabled?: boolean;
	}

	let { checked = $bindable(), onchange, id, label, disabled = false }: Props = $props();

	function toggle() {
		if (disabled) return;
		checked = !checked;
		onchange?.(checked);
	}
</script>

<button
	{id}
	role="switch"
	aria-checked={checked}
	aria-label={label}
	onclick={toggle}
	{disabled}
	type="button"
	class="relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50 disabled:pointer-events-none
		{checked ? 'bg-indigo-600' : 'bg-slate-700'}"
>
	<span
		class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200
			{checked ? 'translate-x-5' : 'translate-x-0'}"
	></span>
</button>
