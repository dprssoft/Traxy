<script lang="ts">
	import { page } from '$app/stores';
</script>

<nav class="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-md border-t border-gray-800 flex justify-around p-2 z-50 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
	<a href="/" class="flex flex-col items-center p-2 min-w-16 rounded-2xl transition-all {$page.url.pathname === '/' ? 'text-brand-accent bg-gray-800/80 scale-105' : 'text-gray-500 hover:text-gray-300'}">
		<span class="text-[10px] font-bold mt-1 uppercase tracking-wider">Feed</span>
	</a>
	<a href="/tracking" class="flex flex-col items-center p-2 min-w-16 rounded-2xl transition-all {$page.url.pathname.startsWith('/tracking') ? 'text-brand-accent bg-gray-800/80 scale-105' : 'text-gray-500 hover:text-gray-300'}">
		<span class="text-[10px] font-bold mt-1 uppercase tracking-wider">My List</span>
	</a>
	<a href="/stats" class="flex flex-col items-center p-2 min-w-16 rounded-2xl transition-all {$page.url.pathname.startsWith('/stats') ? 'text-brand-accent bg-gray-800/80 scale-105' : 'text-gray-500 hover:text-gray-300'}">
		<span class="text-[10px] font-bold mt-1 uppercase tracking-wider">Stats</span>
	</a>
	<a href="/settings" class="flex flex-col items-center p-2 min-w-16 rounded-2xl transition-all {$page.url.pathname.startsWith('/settings') ? 'text-brand-accent bg-gray-800/80 scale-105' : 'text-gray-500 hover:text-gray-300'}">
		<span class="text-[10px] font-bold mt-1 uppercase tracking-wider">Settings</span>
	</a>
</nav>
