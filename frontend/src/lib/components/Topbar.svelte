<script lang="ts">
	import Searchbar from './Searchbar.svelte';
	import { page } from '$app/stores';

	const titleMap: Record<string, string> = {
		'/': 'Activity Feed',
		'/tracking': 'My List',
		'/stats': 'Statistics',
		'/settings': 'Settings',
		'/search': 'Search'
	};

	const currentTitle = $derived.by(() => {
		const path = $page.url.pathname;
		if (path.startsWith('/media/')) return 'Media Details';
		return titleMap[path] ?? 'Traxy';
	});
</script>

<header class="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-8 py-3.5 bg-[#0a0b12]/80 backdrop-blur-xl border-b border-white/[0.06]">
	<!-- Left: Mobile Brand / Page Context -->
	<div class="flex items-center gap-3">
		<!-- Mobile Logo -->
		<a href="/" class="flex md:hidden items-center gap-2">
			<div class="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center shadow-md shadow-indigo-500/20">
				<span class="text-white font-black text-sm">T</span>
			</div>
			<span class="font-bold text-base text-white">Traxy</span>
		</a>

		<!-- Desktop Breadcrumb / Title -->
		<div class="hidden md:flex items-center gap-2">
			<h1 class="text-base font-semibold text-white/90">{currentTitle}</h1>
		</div>
	</div>

	<!-- Right: Integrated Searchbar -->
	<div class="w-full max-w-xs sm:max-w-md ml-auto">
		<Searchbar />
	</div>
</header>
