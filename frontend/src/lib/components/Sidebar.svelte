<script lang="ts">
	import { page } from '$app/stores';
	import { drawerNavItems, layoutStore } from '$lib/stores/layout';
	import { userStore } from '$lib/stores/user.svelte';

	const username = $derived(userStore.value?.username ?? 'Traxy Explorer');
	const profileInitial = $derived(username.charAt(0).toUpperCase());
	const isMirrored = $derived(layoutStore.topbarMirrored);

	const navItems = drawerNavItems.filter((i) => i.href !== '/settings/about');
	const aboutItem = drawerNavItems.find((i) => i.href === '/settings/about');
</script>

<!-- Desktop Wireframe Side Panel (Moves together with top left/right button) -->
<aside 
	class="hidden md:flex flex-col w-64 h-screen sticky top-0 bg-[#0d0e18]/90 backdrop-blur-2xl transition-all duration-300 p-5 shrink-0 z-40 select-none
		{isMirrored ? 'border-l border-white/[0.08]' : 'border-r border-white/[0.08]'}"
>
	<!-- Top Section from Wireframe: [Square Icon] Username with Divider -->
	<a 
		href="/profile" 
		class="flex items-center gap-3.5 pb-4 mb-3 border-b border-white/[0.08] group transition-all"
		title="Open user profile"
	>
		<!-- Avatar square matching wireframe's top-left square -->
		<div class="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-indigo-500/25 shrink-0 border border-white/[0.1] group-hover:scale-105 transition-transform">
			{profileInitial}
		</div>
		<div class="min-w-0">
			<div class="flex items-center gap-1.5">
				<h2 class="font-bold text-white text-base truncate tracking-tight group-hover:text-indigo-300 transition-colors">
					{username}
				</h2>
			</div>
			<p class="text-[11px] text-indigo-400 font-medium flex items-center gap-1">
				<span class="w-1.5 h-1.5 rounded-full bg-indigo-400"></span> Profile & Stats
			</p>
		</div>
	</a>

	<!-- Main Navigation Items from Wireframe Board 2 -->
	<nav class="space-y-1.5 flex-1 overflow-y-auto py-2">
		{#each navItems as item}
			{@const isActive = item.match($page.url.pathname)}
			<a 
				href={item.href}
				class="flex items-center justify-between px-3 py-2.5 rounded-2xl font-semibold text-sm transition-all relative group
					{isActive 
						? 'text-white bg-indigo-600/20 border border-indigo-500/35 shadow-sm shadow-indigo-500/10' 
						: 'text-slate-400 hover:text-white hover:bg-white/[0.04] border border-transparent'}"
			>
				<div class="flex items-center gap-3">
					<!-- Rounded square icon wrapper from wireframe -->
					<div class="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 shrink-0
						{isActive 
							? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30' 
							: 'bg-white/[0.04] text-slate-400 group-hover:text-indigo-300 group-hover:bg-white/[0.08]'}"
					>
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d={item.icon} />
						</svg>
					</div>
					<span class="tracking-tight">{item.label}</span>
				</div>

				{#if item.badge}
					<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
						{item.badge}
					</span>
				{/if}
			</a>
		{/each}
	</nav>

	<!-- Bottom Section: Wireframe [Square Icon] About -->
	<div class="mt-auto pt-4 border-t border-white/[0.08] space-y-2">
		{#if aboutItem}
			{@const isAboutActive = aboutItem.match($page.url.pathname)}
			<a
				href={aboutItem.href}
				class="flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-semibold transition-all group
					{isAboutActive 
						? 'text-white bg-indigo-600/20 border border-indigo-500/35' 
						: 'text-slate-400 hover:text-white hover:bg-white/[0.04]'}"
			>
				<div class="w-9 h-9 rounded-xl bg-white/[0.04] group-hover:bg-white/[0.08] flex items-center justify-center text-slate-400 group-hover:text-indigo-300 shrink-0 transition-colors">
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d={aboutItem.icon} />
					</svg>
				</div>
				<span>About Traxy</span>
			</a>
		{/if}

		<!-- Mirror toggle indicator -->
		<div class="flex items-center justify-between px-3 py-2 text-[11px] text-slate-500 rounded-xl bg-white/[0.02]">
			<span>Panel Position</span>
			<span class="font-bold text-slate-400 uppercase tracking-wider">{isMirrored ? 'Right' : 'Left'}</span>
		</div>
	</div>
</aside>
