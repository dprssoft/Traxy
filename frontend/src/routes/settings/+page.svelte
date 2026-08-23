<script lang="ts">
	import { apiKeyStore, saveApiKeys } from '$lib/stores/apiKeys.svelte';
	import { exportDatabaseJson, importDatabaseJson } from '$lib/db/services/backup.service';
	import MalImport from '$lib/components/MalImport.svelte';
	import AnilistImport from '$lib/components/AnilistImport.svelte';
	import TmdbImport from '$lib/components/TmdbImport.svelte';
	import { searchPrefsStore } from '$lib/stores/searchPrefs.svelte';
	import { onMount } from 'svelte';

	onMount(() => { searchPrefsStore.load(); });

	type SettingsTab = 'general' | 'search' | 'api' | 'data' | 'import' | 'about';
	let activeTab = $state<SettingsTab>('api');

	const inputClass =
		'w-full bg-[#0a0b12] border border-white/[0.1] rounded-xl p-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-colors text-sm';

	let tmdbKey = $state(apiKeyStore.current.tmdb);
	let comicvineKey = $state(apiKeyStore.current.comicvine);
	let igdbClientId = $state(apiKeyStore.current.igdbClientId);
	let igdbClientSecret = $state(apiKeyStore.current.igdbClientSecret);

	let keysSaved = $state(false);

	function saveApiSettings() {
		saveApiKeys({ tmdb: tmdbKey, comicvine: comicvineKey, igdbClientId, igdbClientSecret });
		keysSaved = true;
		setTimeout(() => (keysSaved = false), 3000);
	}

	let fileInput = $state<HTMLInputElement | null>(null);
	let backupStatus = $state('');

	async function handleExport() {
		try {
			backupStatus = 'Exporting...';
			const json = await exportDatabaseJson();
			const blob = new Blob([json], { type: 'application/json' });
			const url = URL.createObjectURL(blob);

			const a = document.createElement('a');
			a.href = url;
			a.download = `traxy-backup-${new Date().toISOString().split('T')[0]}.json`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);

			backupStatus = 'Export successful!';
			setTimeout(() => (backupStatus = ''), 3000);
		} catch (err) {
			console.error(err);
			backupStatus = 'Export failed.';
		}
	}

	async function handleImport(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;

		if (!confirm('Warning: this will overwrite all current local data with the backup file. Continue?')) {
			if (fileInput) fileInput.value = '';
			return;
		}

		try {
			backupStatus = 'Importing...';
			const text = await file.text();
			await importDatabaseJson(text);
			backupStatus = 'Import successful! Refreshing...';
			setTimeout(() => window.location.reload(), 1200);
		} catch (err) {
			console.error(err);
			backupStatus = 'Import failed. Check file format.';
			setTimeout(() => (backupStatus = ''), 3000);
			if (fileInput) fileInput.value = '';
		}
	}

	const tabs: { id: SettingsTab; label: string; icon: string; desc: string }[] = [
		{ 
			id: 'api', 
			label: 'API Integrations', 
			icon: '🔑',
			desc: 'Configure TMDB, IGDB & ComicVine source keys'
		},
		{ 
			id: 'search', 
			label: 'Search & Deduplication', 
			icon: '🔍',
			desc: 'Deduplication rules, source priority & filtering'
		},
		{ 
			id: 'data', 
			label: 'Data & Backup', 
			icon: '💾',
			desc: 'Export JSON backups & restore from file'
		},
		{ 
			id: 'import', 
			label: 'Import', 
			icon: '📥',
			desc: 'Import lists from external trackers'
		},
		{ 
			id: 'general', 
			label: 'Appearance & UI', 
			icon: '🎨',
			desc: 'Theme, layout & display preferences'
		},
		{ 
			id: 'about', 
			label: 'About Traxy', 
			icon: 'ℹ️',
			desc: 'App info, local storage policy & license'
		}
	];
</script>

<div class="space-y-6">
	<!-- Page Header -->
	<div>
		<h1 class="text-3xl font-extrabold text-white tracking-tight">Settings</h1>
		<p class="text-sm text-slate-400 mt-1">Manage your local storage, API keys, and app preferences.</p>
	</div>

	<!-- Clusterized Settings Layout -->
	<div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
		<!-- Sidebar Navigation Tabs -->
		<nav class="lg:col-span-4 flex lg:flex-col gap-1.5 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
			{#each tabs as tab}
				{@const active = activeTab === tab.id}
				<button
					type="button"
					onclick={() => activeTab = tab.id}
					class="flex items-center gap-3.5 p-3.5 rounded-2xl text-left transition-all cursor-pointer whitespace-nowrap lg:whitespace-normal w-full
						{active 
							? 'bg-[#181b2e] border border-indigo-500/40 text-white shadow-lg shadow-indigo-500/10' 
							: 'bg-[#121422]/60 hover:bg-[#181b2e]/60 border border-white/[0.04] text-slate-400 hover:text-slate-200'}"
				>
					<span class="text-xl p-2 rounded-xl bg-white/[0.04] shrink-0">{tab.icon}</span>
					<div class="min-w-0">
						<h4 class="text-sm font-bold {active ? 'text-indigo-400' : 'text-slate-200'}">{tab.label}</h4>
						<p class="hidden lg:block text-xs text-slate-500 truncate mt-0.5">{tab.desc}</p>
					</div>
				</button>
			{/each}
		</nav>

		<!-- Content Panel -->
		<div class="lg:col-span-8 bg-[#121422]/80 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
			{#if activeTab === 'api'}
				<!-- API Keys Section -->
				<div class="space-y-6">
					<div class="border-b border-white/[0.06] pb-4">
						<h2 class="text-xl font-bold text-white flex items-center gap-2">
							<span>🔑</span> External Source Integrations
						</h2>
						<p class="text-xs text-slate-400 mt-1">
							Traxy directly searches external public APIs from your device. You can provide your personal API keys below or leave blank to use the build defaults.
						</p>
					</div>

					<!-- TMDB Card -->
					<div class="p-5 rounded-2xl bg-[#16192b]/60 border border-white/[0.06] space-y-3">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2.5">
								<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">Movies & TV</span>
								<h3 class="font-bold text-white text-sm">The Movie Database (TMDB)</h3>
							</div>
							<span class="text-xs font-semibold text-emerald-400 flex items-center gap-1">
								<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Ready
							</span>
						</div>
						<div>
							<label for="tmdbKey" class="block text-xs font-medium text-slate-400 mb-1.5">TMDB API Key (v3 auth)</label>
							<input
								type="password"
								id="tmdbKey"
								bind:value={tmdbKey}
								placeholder="Leave blank to use personal default"
								class={inputClass}
							/>
						</div>
					</div>

					<!-- IGDB Card -->
					<div class="p-5 rounded-2xl bg-[#16192b]/60 border border-white/[0.06] space-y-3">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2.5">
								<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Video Games</span>
								<h3 class="font-bold text-white text-sm">IGDB (Twitch Developer)</h3>
							</div>
							<span class="text-xs font-semibold text-emerald-400 flex items-center gap-1">
								<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Ready
							</span>
						</div>
						<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
							<div>
								<label for="igdbClientId" class="block text-xs font-medium text-slate-400 mb-1.5">Client ID</label>
								<input
									type="text"
									id="igdbClientId"
									bind:value={igdbClientId}
									placeholder="Twitch Client ID"
									class={inputClass}
								/>
							</div>
							<div>
								<label for="igdbClientSecret" class="block text-xs font-medium text-slate-400 mb-1.5">Client Secret</label>
								<input
									type="password"
									id="igdbClientSecret"
									bind:value={igdbClientSecret}
									placeholder="Twitch Client Secret"
									class={inputClass}
								/>
							</div>
						</div>
						<p class="text-[11px] text-slate-500">
							Obtain free credentials at <a href="https://dev.twitch.tv/console" target="_blank" class="text-indigo-400 hover:underline">dev.twitch.tv/console</a> → Applications.
						</p>
					</div>

					<!-- ComicVine Card -->
					<div class="p-5 rounded-2xl bg-[#16192b]/60 border border-white/[0.06] space-y-3">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2.5">
								<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">Comics</span>
								<h3 class="font-bold text-white text-sm">ComicVine API</h3>
							</div>
							<span class="text-xs font-semibold text-emerald-400 flex items-center gap-1">
								<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Ready
							</span>
						</div>
						<div>
							<label for="comicvineKey" class="block text-xs font-medium text-slate-400 mb-1.5">ComicVine API Key</label>
							<input
								type="password"
								id="comicvineKey"
								bind:value={comicvineKey}
								placeholder="Leave blank to use personal default"
								class={inputClass}
							/>
						</div>
					</div>

					<!-- Save Button -->
					<div class="pt-2 flex items-center gap-4">
						<button
							type="button"
							class="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all cursor-pointer text-sm active:scale-95"
							onclick={saveApiSettings}
						>
							Save API Keys
						</button>
						{#if keysSaved}
							<span class="text-emerald-400 text-sm font-semibold animate-pulse flex items-center gap-1.5">
								<span>✓</span> Keys saved successfully!
							</span>
						{/if}
					</div>
				</div>

			{:else if activeTab === 'data'}
				<!-- Data & Storage Section -->
				<div class="space-y-6">
					<div class="border-b border-white/[0.06] pb-4">
						<h2 class="text-xl font-bold text-white flex items-center gap-2">
							<span>💾</span> Data Backup & Migration
						</h2>
						<p class="text-xs text-slate-400 mt-1">
							All your data is stored locally in your device's SQLite database. You can export backups, import from other trackers, or restore from a JSON file.
						</p>
					</div>

					<!-- Backup / Restore Grid -->
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<!-- Export Card -->
						<div class="p-5 rounded-2xl bg-[#16192b]/60 border border-white/[0.06] flex flex-col justify-between space-y-4">
							<div>
								<h3 class="font-bold text-white text-sm mb-1">Export Local Backup</h3>
								<p class="text-xs text-slate-400">Download a full snapshot of your lists, history, and notes as a portable JSON file.</p>
							</div>
							<button
								type="button"
								onclick={handleExport}
								class="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-colors cursor-pointer text-sm shadow-md shadow-indigo-600/20"
							>
								📥 Export JSON Backup
							</button>
						</div>

						<!-- Restore Card -->
						<div class="p-5 rounded-2xl bg-[#16192b]/60 border border-white/[0.06] flex flex-col justify-between space-y-4">
							<div>
								<h3 class="font-bold text-white text-sm mb-1">Restore from Backup</h3>
								<p class="text-xs text-slate-400">Restore your library from a previously exported JSON backup file.</p>
							</div>
							<input type="file" accept=".json" class="hidden" bind:this={fileInput} onchange={handleImport} />
							<button
								type="button"
								onclick={() => fileInput?.click()}
								class="w-full py-2.5 px-4 bg-[#1e2238] hover:bg-[#252a45] text-slate-200 hover:text-white font-bold rounded-xl border border-white/[0.08] transition-colors cursor-pointer text-sm"
							>
								📤 Choose Backup File
							</button>
						</div>
					</div>

					{#if backupStatus}
						<div class="p-4 rounded-xl text-xs font-semibold {backupStatus.includes('failed') ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}">
							{backupStatus}
						</div>
					{/if}

				</div>

			{:else if activeTab === 'search'}
				<!-- Search & Deduplication Section -->
				<div class="space-y-6">
					<div class="border-b border-white/[0.06] pb-4">
						<h2 class="text-xl font-bold text-white flex items-center gap-2">
							<span>🔍</span> Search & Deduplication
						</h2>
						<p class="text-xs text-slate-400 mt-1">
							Configure cross-source priority rules and duplicate entry suppression.
						</p>
					</div>

					<div class="space-y-3">
						{#snippet toggle(id: string, label: string, hint: string, value: boolean, onChange: (v: boolean) => void)}
							<div class="flex items-start justify-between gap-4 p-4 rounded-xl bg-[#16192b]/60 border border-white/[0.06]">
								<div class="min-w-0">
									<label for={id} class="text-sm font-semibold text-white cursor-pointer">{label}</label>
									<p class="text-xs text-slate-400 mt-0.5 leading-relaxed">{hint}</p>
								</div>
								<button
									{id}
									role="switch"
									aria-checked={value}
									aria-label={label}
									onclick={() => onChange(!value)}
									class="relative shrink-0 w-11 h-6 rounded-full transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/50 {value ? 'bg-indigo-600' : 'bg-slate-700'}"
								>
									<span class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform {value ? 'translate-x-5' : 'translate-x-0'}"></span>
								</button>
							</div>
						{/snippet}

						{@render toggle(
							'pref-anime',
							'AniList wins for Anime vs TV',
							'If AniList has a title as anime (e.g. Jujutsu Kaisen), the same title from TMDB TV Series is hidden — even when filtering by TV.',
							searchPrefsStore.current.anilistWinsAnime,
							(v) => searchPrefsStore.save({ ...searchPrefsStore.current, anilistWinsAnime: v })
						)}

						{@render toggle(
							'pref-manga',
							'AniList wins for Manga vs Books',
							'If AniList has a title as manga/manhwa/manhua, the exact same title from OpenLibrary (as a book) or ComicVine is hidden.',
							searchPrefsStore.current.anilistWinsManga,
							(v) => searchPrefsStore.save({ ...searchPrefsStore.current, anilistWinsManga: v })
						)}

						{@render toggle(
							'pref-volumes',
							'Suppress manga volume entries from OpenLibrary',
							'Hides "Gantz Volume 1", "Berserk Vol 38" etc. from OpenLibrary when AniList has the series. Disable if you track a non-manga book series that shares a name.',
							searchPrefsStore.current.suppressMangaVolumes,
							(v) => searchPrefsStore.save({ ...searchPrefsStore.current, suppressMangaVolumes: v })
						)}
					</div>
				</div>

			{:else if activeTab === 'import'}
				<!-- Import Section -->
				<div class="space-y-6">
					<div class="border-b border-white/[0.06] pb-4">
						<h2 class="text-xl font-bold text-white flex items-center gap-2">
							<span>📥</span> Import
						</h2>
						<p class="text-xs text-slate-400 mt-1">
							Import your existing tracking lists from external services.
						</p>
					</div>

					<div class="space-y-4">
						<div class="p-5 rounded-2xl bg-[#16192b]/60 border border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
							<div>
								<h4 class="font-bold text-white text-sm">MyAnimeList XML Import</h4>
								<p class="text-xs text-slate-400 mt-0.5">Import your anime tracking list exported from MyAnimeList.</p>
							</div>
							<MalImport />
						</div>

						<div class="p-5 rounded-2xl bg-[#16192b]/60 border border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
							<div>
								<h4 class="font-bold text-white text-sm">AniList Import</h4>
								<p class="text-xs text-slate-400 mt-0.5">Import directly using your AniList username (public profiles only).</p>
							</div>
							<AnilistImport />
						</div>

						<div class="p-5 rounded-2xl bg-[#16192b]/60 border border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
							<div>
								<h4 class="font-bold text-white text-sm">TMDB Import</h4>
								<p class="text-xs text-slate-400 mt-0.5">Import your watchlist and rated media from TMDB.</p>
							</div>
							<TmdbImport />
						</div>
					</div>
				</div>

			{:else if activeTab === 'general'}
				<!-- General & Appearance Section -->
				<div class="space-y-6">
					<div class="border-b border-white/[0.06] pb-4">
						<h2 class="text-xl font-bold text-white flex items-center gap-2">
							<span>🎨</span> Appearance & Preferences
						</h2>
						<p class="text-xs text-slate-400 mt-1">
							Customize your visual experience and display settings.
						</p>
					</div>

					<div class="space-y-4">
						<!-- Theme Palette Indicator -->
						<div class="p-5 rounded-2xl bg-[#16192b]/60 border border-white/[0.06] space-y-3">
							<div class="flex items-center justify-between">
								<div>
									<h3 class="font-bold text-white text-sm">Theme Mode</h3>
									<p class="text-xs text-slate-400 mt-0.5">Deep Obsidian Dark with Electric Indigo accents</p>
								</div>
								<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
									Active
								</span>
							</div>
						</div>

						<!-- Storage Status -->
						<div class="p-5 rounded-2xl bg-[#16192b]/60 border border-white/[0.06] space-y-2">
							<h3 class="font-bold text-white text-sm">Storage Engine</h3>
							<p class="text-xs text-slate-400">
								Using Capacitor SQLite persistent storage on mobile devices and browser IndexedDB/LocalStorage for local development.
							</p>
						</div>
					</div>
				</div>

			{:else if activeTab === 'about'}
				<!-- About Section -->
				<div class="space-y-6">
					<div class="border-b border-white/[0.06] pb-4">
						<h2 class="text-xl font-bold text-white flex items-center gap-2">
							<span>ℹ️</span> About Traxy
						</h2>
						<p class="text-xs text-slate-400 mt-1">
							Your private, local-first media tracker and entertainment organizer.
						</p>
					</div>

					<div class="p-6 rounded-2xl bg-gradient-to-br from-[#16192b] to-[#121422] border border-white/[0.08] space-y-4">
						<div class="flex items-center gap-3">
							<div class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-indigo-500/20">
								T
							</div>
							<div>
								<h3 class="text-lg font-black text-white">Traxy</h3>
								<p class="text-xs text-indigo-400 font-semibold">Standalone Local-First Edition</p>
							</div>
						</div>
						<p class="text-xs text-slate-300 leading-relaxed">
							Traxy is designed to be completely independent: no centralized server, no user tracking, no accounts required. All your data stays private and safe directly on your device.
						</p>
						<div class="pt-2 flex flex-wrap gap-3">
							<a
								href="https://github.com/dprssoft/Traxy"
								target="_blank"
								class="inline-flex items-center gap-2 px-4 py-2 bg-[#1e2238] hover:bg-[#252a45] text-white font-semibold rounded-xl text-xs border border-white/[0.08] transition-colors"
							>
								<span>⭐</span> GitHub Repository
							</a>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>
