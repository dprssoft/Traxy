<script lang="ts">
	import { onMount } from 'svelte';
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	import Sidebar from '$lib/components/Sidebar.svelte';
	import Topbar from '$lib/components/Topbar.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import MobileNavDrawer from '$lib/components/MobileNavDrawer.svelte';
	import ContentFilterPrompt from '$lib/components/ContentFilterPrompt.svelte';
	import MediaQuickSheet from '$lib/components/MediaQuickSheet.svelte';
	import { quickEdit } from '$lib/stores/quickEdit.svelte';
	import { beforeNavigate, afterNavigate } from '$app/navigation';
	import { previousPath } from '$lib/stores/breadcrumb';
	import { layoutStore, bottomNavCatalogue, defaultBottomNavItems } from '$lib/stores/layout';
	import { resolveBottomNavItems } from '$lib/utils/bottomNav';
	import { contentFilterStore } from '$lib/stores/contentFilter.svelte';
	import { userStore } from '$lib/stores/user.svelte';
	import { App } from '@capacitor/app';
	import { Capacitor } from '@capacitor/core';
	import { page } from '$app/stores';
	import { triggerAutosave } from '$lib/services/autosave.service';

	let { children, data } = $props();

	const isMirrored = $derived(layoutStore.topbarMirrored);
	const isMediaPage = $derived($page.url.pathname.startsWith('/media'));

	$effect.pre(() => {
		const prefs = data.bottomNav;
		layoutStore.setBottomNavEnabled(prefs?.enabled ?? true);
		layoutStore.setBottomNavItems(
			prefs?.enabled
				? resolveBottomNavItems(prefs.ids, bottomNavCatalogue, defaultBottomNavItems)
				: defaultBottomNavItems,
		);
	});

	$effect.pre(() => {
		if (data.contentFilter) contentFilterStore.setPrefs(data.contentFilter);
	});

	$effect.pre(() => {
		if (data.profile) userStore.init(data.profile);
	});

	beforeNavigate(({ from }) => {
		const p = from?.url?.pathname ?? null;
		previousPath.set(p ? p.replace(/\/$/, '') || '/' : null);
	});
	afterNavigate(({ from }) => {
		if (!from || !from.url) return;
		const p = from.url.pathname.replace(/\/$/, '') || '/';
		previousPath.set(p);
	});

	onMount(() => {
		if (Capacitor.isNativePlatform()) {
			App.addListener('backButton', ({ canGoBack }) => {
				if (layoutStore.mobileMenuOpen) {
					layoutStore.closeMobileMenu();
				} else if (canGoBack) {
					window.history.back();
				} else {
					App.exitApp();
				}
			});
		}

		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'hidden') triggerAutosave();
		});

		const autosaveInterval = setInterval(triggerAutosave, 5 * 60 * 1000);
		return () => clearInterval(autosaveInterval);
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Traxy · Personal Media Tracker</title>
</svelte:head>

<div
	class="min-h-screen flex text-[var(--color-text-main)] bg-[var(--color-bkg-main)] selection:bg-indigo-500/30 selection:text-indigo-200 transition-all duration-300
	{isMirrored ? 'flex-row-reverse' : 'flex-row'}"
>
	<!-- Desktop Sidebar (Moves together with top-left button) -->
	<Sidebar />

	<!-- Main App Shell -->
	<div class="flex-1 flex flex-col min-w-0 pb-20 md:pb-12">
		<!-- Desktop / Mobile Topbar (hidden on media pages per wireframe) -->
		{#if !isMediaPage}
			<Topbar />
		{/if}

		<!-- Page Content -->
		<main
			class="flex-1 w-full max-w-6xl mx-auto {isMediaPage
				? 'p-0 sm:px-4 sm:py-6'
				: 'px-4 sm:px-8 py-6 sm:py-8'}"
		>
			{@render children()}
		</main>
	</div>

	<!-- Mobile Navigation Drawer (from wireframe) -->
	<MobileNavDrawer />

	<!-- Mobile Bottom Navigation -->
	<BottomNav />
</div>

<!-- First-launch adult content filter question -->
<ContentFilterPrompt />

<!-- App-wide quick edit, opened from the ✎ button on posters and entries -->
{#if quickEdit.media}
	{#key quickEdit.media.id}
		<MediaQuickSheet media={quickEdit.media} />
	{/key}
{/if}
