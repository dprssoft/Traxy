<script lang="ts">
	import { page } from '$app/stores';
	import Tabs from '$lib/components/ui/Tabs.svelte';

	let { children } = $props();

	const tabs = [
		{ id: 'api', label: 'API Integrations', icon: '🔑', desc: 'TMDB, IGDB & ComicVine keys', href: '/settings/api' },
		{ id: 'search', label: 'Search', icon: '🔍', desc: 'Deduplication & source priority', href: '/settings/search' },
		{ id: 'data', label: 'Data & Backup', icon: '💾', desc: 'Export & restore your data', href: '/settings/data' },
		{ id: 'import', label: 'Import', icon: '📥', desc: 'Import from external trackers', href: '/settings/import' },
		{ id: 'appearance', label: 'Appearance', icon: '🎨', desc: 'Theme, language & display', href: '/settings/appearance' },
		{ id: 'about', label: 'About', icon: 'ℹ️', desc: 'App info & license', href: '/settings/about' },
	];

	const activeTab = $derived(
		tabs.find((t) => $page.url.pathname.startsWith(t.href))?.id ?? 'api'
	);
</script>

<div class="space-y-6">
	<!-- Page Header -->
	<div>
		<h1 class="text-3xl font-extrabold text-white tracking-tight">Settings</h1>
		<p class="text-sm text-slate-400 mt-1">Manage your local storage, API keys, and app preferences.</p>
	</div>

	<!-- Settings Layout: sidebar nav + content panel -->
	<div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
		<!-- Sidebar Nav -->
		<div class="lg:col-span-4">
			<Tabs
				{tabs}
				active={activeTab}
				orientation="vertical"
				onchange={(id) => {
					const tab = tabs.find((t) => t.id === id);
					if (tab) window.location.href = tab.href;
				}}
			/>
		</div>

		<!-- Content Panel -->
		<div class="lg:col-span-8 bg-[#121422]/80 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-6 sm:p-8 shadow-2xl min-h-64">
			{@render children()}
		</div>
	</div>
</div>
