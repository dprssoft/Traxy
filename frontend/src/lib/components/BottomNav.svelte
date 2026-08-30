<script lang="ts">
	import { page } from '$app/stores';
	import { navItems } from '$lib/stores/layout';
</script>

<nav class="md:hidden fixed bottom-0 left-0 right-0 bg-[#0d0e18]/90 backdrop-blur-2xl border-t border-white/[0.08] flex justify-around items-center px-3 py-2 z-50 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-2xl">
	{#each navItems as item}
		{@const isActive = item.match($page.url.pathname)}
		<a 
			href={item.href} 
			class="flex flex-col items-center py-1 px-3 min-w-16 rounded-xl transition-all duration-200
				{isActive 
					? 'text-indigo-400 bg-indigo-500/10 scale-105' 
					: 'text-slate-400 hover:text-slate-200'}"
		>
			<svg class="w-5 h-5 transition-transform {isActive ? 'stroke-[2.2]' : 'stroke-[1.8]'}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" d={item.icon} />
			</svg>
			<span class="text-[10px] font-semibold mt-1 tracking-tight">{item.label}</span>
		</a>
	{/each}
</nav>
