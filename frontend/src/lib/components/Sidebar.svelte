<script lang="ts">
	import { page } from '$app/stores';

	interface NavItem {
		href: string;
		label: string;
		icon: string;
		match: (path: string) => boolean;
	}

	const navItems: NavItem[] = [
		{
			href: '/',
			label: 'Feed',
			icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
			match: (p) => p === '/'
		},
		{
			href: '/tracking',
			label: 'My List',
			icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
			match: (p) => p.startsWith('/tracking')
		},
		{
			href: '/stats',
			label: 'Stats',
			icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
			match: (p) => p.startsWith('/stats')
		},
		{
			href: '/settings',
			label: 'Settings',
			icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
			match: (p) => p.startsWith('/settings')
		}
	];
</script>

<aside class="hidden md:flex flex-col w-64 h-screen sticky top-0 bg-[#0d0e18]/80 backdrop-blur-2xl border-r border-white/[0.06] p-5 shrink-0 z-40">
	<!-- Logo / Header -->
	<a href="/" class="flex items-center gap-3 px-2 py-3 mb-6 group">
		<div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform">
			<span class="text-white font-black text-xl tracking-tighter">T</span>
		</div>
		<div>
			<div class="flex items-center gap-1.5">
				<span class="font-extrabold text-lg text-white tracking-tight">Traxy</span>
				<span class="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">Local</span>
			</div>
			<p class="text-xs text-slate-400">Media Tracker</p>
		</div>
	</a>

	<!-- Quick Search Button -->
	<a 
		href="/search"
		class="flex items-center justify-between px-3.5 py-2.5 mb-6 rounded-xl bg-[#141727] hover:bg-[#1a1e33] border border-white/[0.08] text-slate-400 hover:text-white transition-all group"
	>
		<div class="flex items-center gap-2.5">
			<svg class="w-4 h-4 text-slate-400 group-hover:text-indigo-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
			</svg>
			<span class="text-xs font-medium">Quick search...</span>
		</div>
		<kbd class="text-[10px] font-semibold text-slate-500 bg-[#0d0e18] px-1.5 py-0.5 rounded border border-white/[0.06]">⌘K</kbd>
	</a>

	<!-- Navigation Menu -->
	<div class="space-y-1.5 flex-1">
		<div class="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Navigation</div>
		{#each navItems as item}
			{@const isActive = item.match($page.url.pathname)}
			<a 
				href={item.href}
				class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all relative group
					{isActive 
						? 'text-white bg-indigo-600/15 border border-indigo-500/30 shadow-sm shadow-indigo-500/10' 
						: 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'}"
			>
				{#if isActive}
					<div class="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-indigo-500 shadow-sm shadow-indigo-500"></div>
				{/if}
				<svg class="w-5 h-5 transition-transform group-hover:scale-110 {isActive ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-300'}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={item.icon} />
				</svg>
				<span>{item.label}</span>
			</a>
		{/each}
	</div>

	<!-- Footer / Version Card -->
	<div class="mt-auto pt-4 border-t border-white/[0.06]">
		<div class="p-3 rounded-xl bg-[#141727]/60 border border-white/[0.04] text-xs">
			<div class="flex items-center justify-between text-slate-400 mb-1">
				<span>Status</span>
				<span class="flex items-center gap-1.5 text-emerald-400 font-medium">
					<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Offline Ready
				</span>
			</div>
			<p class="text-[11px] text-slate-500">All data stored locally on your device.</p>
		</div>
	</div>
</aside>
