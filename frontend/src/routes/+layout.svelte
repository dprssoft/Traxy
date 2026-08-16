<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';

	import BottomNav from '$lib/components/BottomNav.svelte';
	import { beforeNavigate, afterNavigate } from '$app/navigation';
	import { previousPath } from '$lib/stores/breadcrumb';
	import { onMount } from 'svelte';
	import { initDb } from '$lib/db';
	import { Capacitor } from '@capacitor/core';

	let { children } = $props();

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
	<title>Track List Personal</title>
</svelte:head>

<div class="min-h-screen flex flex-col font-sans text-[var(--color-text-main)] pb-20 bg-[var(--color-bkg-main)]">

	<main class="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6">
		{@render children()}
	</main>

	<BottomNav />
</div>
