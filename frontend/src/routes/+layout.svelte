<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	import Sidebar from '$lib/components/Sidebar.svelte';
	import Topbar from '$lib/components/Topbar.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import MobileNavDrawer from '$lib/components/MobileNavDrawer.svelte';
	import { beforeNavigate, afterNavigate } from '$app/navigation';
	import { previousPath } from '$lib/stores/breadcrumb';
	import { layoutStore } from '$lib/stores/layout';

	let { children } = $props();

	const isMirrored = $derived(layoutStore.topbarMirrored);

	beforeNavigate(({ from }) => {
		const p = from?.url?.pathname ?? null;
		previousPath.set(p ? p.replace(/\/$/, '') || '/' : null);
	});
	afterNavigate(({ from }) => {
		if (!from || !from.url) return;
		const p = from.url.pathname.replace(/\/$/, '') || '/';
		previousPath.set(p);
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Traxy · Personal Media Tracker</title>
</svelte:head>

<div class="min-h-screen flex text-[var(--color-text-main)] bg-[var(--color-bkg-main)] selection:bg-indigo-500/30 selection:text-indigo-200 transition-all duration-300
	{isMirrored ? 'flex-row-reverse' : 'flex-row'}">
	<!-- Desktop Sidebar (Moves together with top-left button) -->
	<Sidebar />

	<!-- Main App Shell -->
	<div class="flex-1 flex flex-col min-w-0 pb-20 md:pb-12">
		<!-- Desktop / Mobile Topbar -->
		<Topbar />

		<!-- Page Content -->
		<main class="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-8">
			{@render children()}
		</main>
	</div>

	<!-- Mobile Navigation Drawer (from wireframe) -->
	<MobileNavDrawer />

	<!-- Mobile Bottom Navigation -->
	<BottomNav />
</div>
