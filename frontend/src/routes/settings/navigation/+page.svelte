<script lang="ts">
	import { dndzone } from 'svelte-dnd-action';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import Toggle from '$lib/components/ui/Toggle.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { layoutStore, bottomNavCatalogue, defaultBottomNavItems } from '$lib/stores/layout';
	import type { NavItem } from '$lib/stores/layout';
	import { BOTTOM_NAV_MIN, BOTTOM_NAV_MAX } from '$lib/utils/bottomNav';
	import { setBottomNavIds, setBottomNavEnabled } from '$lib/db/services/settings.service';

	const enabled = $derived(layoutStore.bottomNavEnabled);
	type DndItem = { id: string; item: NavItem };

	// dndzone needs an `id` on every item, and consider/finalize items must be stored as-is so the
	// library's shadow placeholder item survives mid-drag.
	let dndItems = $state<DndItem[]>(toDnd(layoutStore.bottomNavItems));
	const bar = $derived(dndItems.map((d) => d.item));

	const available = $derived(bottomNavCatalogue.filter((n) => !bar.some((b) => b.href === n.href)));
	const isFull = $derived(bar.length >= BOTTOM_NAV_MAX);
	const canRemove = $derived(bar.length > BOTTOM_NAV_MIN);
	const hasSettings = $derived(bar.some((b) => b.href === '/settings'));

	function toDnd(items: NavItem[]): DndItem[] {
		return items.map((item) => ({ id: item.href, item }));
	}

	function commit(next: NavItem[]) {
		dndItems = toDnd(next);
		layoutStore.setBottomNavItems(next);
		setBottomNavIds(next.map((n) => n.href));
	}

	function add(item: NavItem) {
		if (!isFull) commit([...bar, item]);
	}

	function remove(item: NavItem) {
		if (canRemove) commit(bar.filter((b) => b.href !== item.href));
	}

	function onConsider(e: CustomEvent<{ items: DndItem[] }>) {
		dndItems = e.detail.items;
	}

	function onFinalize(e: CustomEvent<{ items: DndItem[] }>) {
		commit(e.detail.items.map((d) => d.item));
	}

	async function reset() {
		dndItems = toDnd(defaultBottomNavItems);
		layoutStore.setBottomNavItems(defaultBottomNavItems);
		await setBottomNavIds(null);
	}

	async function toggleEnabled(value: boolean) {
		layoutStore.setBottomNavEnabled(value);
		await setBottomNavEnabled(value);
		layoutStore.setBottomNavItems(value ? bar : defaultBottomNavItems);
	}
</script>

<div class="space-y-5">
	<SectionHeader
		title="Navigation"
		subtitle="Choose which shortcuts appear in the bottom bar on mobile ({BOTTOM_NAV_MIN}–{BOTTOM_NAV_MAX} buttons)."
	/>

	<div
		class="p-5 rounded-2xl bg-[#16192b]/60 border border-white/[0.06] flex items-center justify-between gap-4"
	>
		<div>
			<h3 class="font-bold text-white text-sm">Custom bottom bar</h3>
			<p class="text-xs text-slate-400 mt-0.5">When off, the default shortcuts are used.</p>
		</div>
		<Toggle checked={enabled} onchange={toggleEnabled} label="Custom bottom bar" />
	</div>

	{#if enabled}
		<!-- Bar preview -->
		<div class="p-5 rounded-2xl bg-[#16192b]/60 border border-white/[0.06] space-y-3">
			<div class="flex items-center justify-between">
				<h3 class="font-bold text-white text-sm">Your bar ({bar.length}/{BOTTOM_NAV_MAX})</h3>
				<Button variant="ghost" size="sm" onclick={reset}>Reset to default</Button>
			</div>
			<div
				class="flex justify-around items-center gap-1 px-2 py-3 rounded-2xl bg-[#0a0b12] border border-white/[0.08]"
				use:dndzone={{ items: dndItems, flipDurationMs: 150, dropTargetStyle: {} }}
				onconsider={onConsider}
				onfinalize={onFinalize}
			>
				{#each dndItems as { id, item } (id)}
					<div
						class="relative flex flex-col items-center gap-1 flex-1 max-w-16 cursor-grab active:cursor-grabbing select-none touch-none"
					>
						<div
							class="w-10 h-9 rounded-xl flex items-center justify-center bg-white/[0.06] border border-white/[0.08] text-slate-200"
						>
							<svg
								class="w-4 h-4 stroke-[1.8]"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path stroke-linecap="round" stroke-linejoin="round" d={item.icon} />
							</svg>
						</div>
						<span class="text-[9.5px] font-bold tracking-tight truncate max-w-full text-slate-400"
							>{item.label}</span
						>
						{#if canRemove}
							<button
								type="button"
								aria-label="Remove {item.label}"
								onclick={() => remove(item)}
								class="absolute -top-1.5 right-0 w-5 h-5 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold leading-none flex items-center justify-center shadow cursor-pointer"
							>
								−
							</button>
						{/if}
					</div>
				{/each}
			</div>
			<p class="text-[11px] text-slate-500">Drag to reorder. Tap − to remove.</p>
			{#if !hasSettings}
				<p class="text-[11px] text-amber-400">
					Settings isn't in the bar — you can still reach it from the menu.
				</p>
			{/if}
		</div>

		<!-- Available shortcuts -->
		<div class="p-5 rounded-2xl bg-[#16192b]/60 border border-white/[0.06] space-y-3">
			<div class="flex items-center justify-between">
				<h3 class="font-bold text-white text-sm">Available shortcuts</h3>
				{#if isFull}
					<span class="text-[11px] text-slate-500">Bar is full</span>
				{/if}
			</div>
			{#if available.length === 0}
				<p class="text-xs text-slate-500">All shortcuts are in the bar.</p>
			{:else}
				<div class="grid grid-cols-3 sm:grid-cols-4 gap-2">
					{#each available as item (item.href)}
						<button
							type="button"
							disabled={isFull}
							onclick={() => add(item)}
							aria-label="Add {item.label}"
							class="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-[#121422] border border-white/[0.06] text-slate-300 hover:text-white hover:border-indigo-500/40 transition-colors cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
						>
							<svg
								class="w-5 h-5 stroke-[1.8]"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path stroke-linecap="round" stroke-linejoin="round" d={item.icon} />
							</svg>
							<span class="text-[11px] font-semibold">{item.label}</span>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
