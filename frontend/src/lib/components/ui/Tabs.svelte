<script lang="ts">
	interface Tab {
		id: string;
		label: string;
		icon?: string;
		desc?: string;
	}

	interface Props {
		tabs: Tab[];
		active: string;
		onchange: (id: string) => void;
		orientation?: 'horizontal' | 'vertical';
		class?: string;
	}

	let {
		tabs,
		active,
		onchange,
		orientation = 'horizontal',
		class: extraClass = '',
	}: Props = $props();

	const isVertical = $derived(orientation === 'vertical');
</script>

<div
	class="{isVertical
		? 'flex flex-col gap-1'
		: 'flex gap-1 overflow-x-auto scrollbar-hide'} {extraClass}"
	role="tablist"
>
	{#each tabs as tab}
		{@const isActive = active === tab.id}
		<button
			role="tab"
			aria-selected={isActive}
			type="button"
			onclick={() => onchange(tab.id)}
			class="flex items-center gap-3 rounded-xl text-left transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/40
				{isVertical
				? 'p-3 w-full whitespace-normal'
				: 'px-4 py-2.5 whitespace-nowrap shrink-0'}
				{isActive
				? 'bg-[#181b2e] border border-indigo-500/40 text-white shadow-md shadow-indigo-500/10'
				: 'bg-[#121422]/60 hover:bg-[#181b2e]/60 border border-white/[0.04] text-slate-400 hover:text-slate-200'}"
		>
			{#if tab.icon}
				<span class="text-lg p-1.5 rounded-lg bg-white/[0.04] shrink-0">{tab.icon}</span>
			{/if}
			<div class="min-w-0">
				<span class="text-sm font-bold block {isActive ? 'text-indigo-400' : 'text-slate-200'}">
					{tab.label}
				</span>
				{#if tab.desc && isVertical}
					<span class="text-xs text-slate-500 block mt-0.5 truncate">{tab.desc}</span>
				{/if}
			</div>
		</button>
	{/each}
</div>
