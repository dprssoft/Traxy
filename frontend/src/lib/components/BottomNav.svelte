<script lang="ts">
	import { page } from '$app/stores';
	import { navItems } from '$lib/stores/layout';
</script>

<nav class="md:hidden fixed bottom-0 left-0 right-0 bg-[#0a0b12]/95 backdrop-blur-2xl border-t border-white/[0.08] flex justify-around items-center px-2 py-2 z-40 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl">
	{#each navItems as item}
		{@const isActive = item.match($page.url.pathname)}
		<a 
			href={item.href} 
			class="flex flex-col items-center gap-1 py-1 px-1.5 transition-all duration-200 flex-1 max-w-16 group"
			aria-label={item.label}
		>
			<!-- Rounded square button matching wireframe Board 1 bottom nav -->
			<div class="w-10 h-9 rounded-xl flex items-center justify-center transition-all duration-200
				{isActive 
					? 'border-2 border-indigo-400/90 bg-indigo-500/25 text-white shadow-md shadow-indigo-500/30 scale-105' 
					: 'bg-white/[0.04] text-slate-400 group-hover:text-white group-hover:bg-white/[0.08] border border-white/[0.04]'}"
			>
				<svg class="w-4 h-4 transition-transform {isActive ? 'stroke-[2.2]' : 'stroke-[1.8]'}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" d={item.icon} />
				</svg>
			</div>
			<span class="text-[9.5px] font-bold tracking-tight truncate {isActive ? 'text-white' : 'text-slate-400'}">{item.label}</span>
		</a>
	{/each}
</nav>
