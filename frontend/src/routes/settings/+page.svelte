<script lang="ts">
	import { goalStore, saveGoals } from '$lib/stores/goal.svelte';
	import { apiKeyStore, saveApiKeys } from '$lib/stores/apiKeys.svelte';
	import { exportDatabaseJson, importDatabaseJson } from '$lib/db/services/backup.service';

	const currentYear = new Date().getFullYear();
	const inputClass =
		'w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white focus:ring-brand-accent focus:border-brand-accent';

	let watchCount = $state(goalStore.current.watchCount);
	let gameCount = $state(goalStore.current.gameCount);
	let readCount = $state(goalStore.current.readCount);

	let tmdbKey = $state(apiKeyStore.current.tmdb);
	let comicvineKey = $state(apiKeyStore.current.comicvine);
	let igdbClientId = $state(apiKeyStore.current.igdbClientId);
	let igdbClientSecret = $state(apiKeyStore.current.igdbClientSecret);

	let goalsSaved = $state(false);
	let keysSaved = $state(false);

	function saveGoalSettings() {
		saveGoals({ watchCount, gameCount, readCount });
		goalsSaved = true;
		setTimeout(() => (goalsSaved = false), 3000);
	}

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

		if (!confirm('Warning: this will delete all current data and replace it with the backup. Continue?')) {
			if (fileInput) fileInput.value = '';
			return;
		}

		try {
			backupStatus = 'Importing...';
			const text = await file.text();
			await importDatabaseJson(text);
			backupStatus = 'Import successful! Refreshing page...';
			setTimeout(() => window.location.reload(), 1500);
		} catch (err) {
			console.error(err);
			backupStatus = 'Import failed. Check the file format.';
			setTimeout(() => (backupStatus = ''), 3000);
			if (fileInput) fileInput.value = '';
		}
	}
</script>

<div class="max-w-3xl mx-auto py-8 px-4 space-y-8">
	<h1 class="text-3xl font-bold text-white mb-6">Settings</h1>

	<!-- Goals Settings -->
	<div class="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
		<h2 class="text-xl font-bold text-white mb-4">Goals for {currentYear}</h2>
		<p class="text-gray-400 text-sm mb-6">Set how many titles you want to finish this year.</p>

		<div class="space-y-4 max-w-sm">
			<div>
				<label class="block text-sm font-medium text-gray-300 mb-1" for="watchCount">
					Watching (Movies, TV, Anime)
				</label>
				<input type="number" id="watchCount" bind:value={watchCount} class={inputClass} />
			</div>
			<div>
				<label class="block text-sm font-medium text-gray-300 mb-1" for="gameCount">
					Games
				</label>
				<input type="number" id="gameCount" bind:value={gameCount} class={inputClass} />
			</div>
			<div>
				<label class="block text-sm font-medium text-gray-300 mb-1" for="readCount">
					Reading (Books, Manga, Comics)
				</label>
				<input type="number" id="readCount" bind:value={readCount} class={inputClass} />
			</div>
			<div class="pt-4 flex items-center gap-4">
				<button
					class="px-6 py-2 bg-brand-accent hover:bg-brand-accent/90 text-white font-medium rounded-lg transition-colors"
					onclick={saveGoalSettings}
				>
					Save goals
				</button>
				{#if goalsSaved}
					<span class="text-green-400 text-sm animate-pulse">Saved!</span>
				{/if}
			</div>
		</div>
	</div>

	<!-- API Keys Settings -->
	<div class="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
		<h2 class="text-xl font-bold text-white mb-4">API Keys</h2>
		<p class="text-gray-400 text-sm mb-6">
			Enter your personal API keys to enable searching in specific databases.
		</p>

		<div class="space-y-4 max-w-sm">
			<div>
				<label class="block text-sm font-medium text-gray-300 mb-1" for="tmdbKey">
					TMDB API Key (Movies &amp; TV)
				</label>
				<input
					type="password"
					id="tmdbKey"
					bind:value={tmdbKey}
					placeholder="Leave blank to use default"
					class={inputClass}
				/>
			</div>
			<div>
				<label class="block text-sm font-medium text-gray-300 mb-1" for="comicvineKey">
					ComicVine API Key (Comics)
				</label>
				<input
					type="password"
					id="comicvineKey"
					bind:value={comicvineKey}
					placeholder="Leave blank to use default"
					class={inputClass}
				/>
			</div>
			<div>
				<label class="block text-sm font-medium text-gray-300 mb-1" for="igdbClientId">
					IGDB Client ID (Games)
				</label>
				<input
					type="text"
					id="igdbClientId"
					bind:value={igdbClientId}
					placeholder="From dev.twitch.tv/console"
					class={inputClass}
				/>
			</div>
			<div>
				<label class="block text-sm font-medium text-gray-300 mb-1" for="igdbClientSecret">
					IGDB Client Secret (Games)
				</label>
				<input
					type="password"
					id="igdbClientSecret"
					bind:value={igdbClientSecret}
					placeholder="From dev.twitch.tv/console"
					class={inputClass}
				/>
				<p class="mt-1 text-xs text-gray-500">
					Free at <a href="https://dev.twitch.tv/console" target="_blank" class="text-brand-accent hover:underline">dev.twitch.tv/console</a>
					→ Create application → copy Client ID &amp; Secret.
				</p>
			</div>

			<div class="pt-4 flex items-center gap-4">
				<button
					class="px-6 py-2 bg-brand-accent hover:bg-brand-accent/90 text-white font-medium rounded-lg transition-colors"
					onclick={saveApiSettings}
				>
					Save keys
				</button>
				{#if keysSaved}
					<span class="text-green-400 text-sm animate-pulse">Saved!</span>
				{/if}
			</div>
		</div>
	</div>

	<!-- Backup / Restore -->
	<div class="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
		<h2 class="text-xl font-bold text-white mb-4">Backup</h2>
		<p class="text-gray-400 text-sm mb-6">
			Since all data is stored locally on your device, we recommend making periodic backups.
		</p>

		<div class="flex flex-col sm:flex-row gap-4">
			<button
				class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
				onclick={handleExport}
			>
				Export data
			</button>

			<input type="file" accept=".json" class="hidden" bind:this={fileInput} onchange={handleImport} />
			<button
				class="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors border border-gray-600"
				onclick={() => fileInput?.click()}
			>
				Restore from backup
			</button>
		</div>

		{#if backupStatus}
			<p class="mt-4 text-sm font-medium {backupStatus.includes('failed') ? 'text-red-400' : 'text-green-400'}">
				{backupStatus}
			</p>
		{/if}
	</div>
</div>
