<script lang="ts">
	import { exportDatabaseJson, importDatabaseJson, clearMediaCache } from '$lib/db/services/backup.service';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';

	let fileInput = $state<HTMLInputElement | null>(null);
	let backupStatus = $state('');
	let exporting = $state(false);
	let importing = $state(false);

	let showCacheModal = $state(false);
	let cacheTimer = $state(3);
	let cacheInterval: ReturnType<typeof setInterval>;

	function startCacheTimer() {
		cacheTimer = 3;
		clearInterval(cacheInterval);
		cacheInterval = setInterval(() => {
			if (cacheTimer > 0) cacheTimer--;
			else clearInterval(cacheInterval);
		}, 1000);
	}

	async function handleClearCache() {
		try {
			await clearMediaCache();
			backupStatus = 'success:Media cache cleared successfully.';
			setTimeout(() => (backupStatus = ''), 4000);
		} catch (err) {
			console.error(err);
			backupStatus = 'error:Failed to clear media cache.';
		} finally {
			showCacheModal = false;
		}
	}

	async function handleExport() {
		try {
			exporting = true;
			backupStatus = '';
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
			backupStatus = 'success:Export successful!';
			setTimeout(() => (backupStatus = ''), 4000);
		} catch (err) {
			console.error(err);
			backupStatus = 'error:Export failed.';
		} finally {
			exporting = false;
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
			importing = true;
			backupStatus = '';
			const text = await file.text();
			await importDatabaseJson(text);
			backupStatus = 'success:Import successful! Refreshing…';
			setTimeout(() => window.location.reload(), 1200);
		} catch (err) {
			console.error(err);
			backupStatus = 'error:Import failed. Check file format.';
			setTimeout(() => (backupStatus = ''), 4000);
			if (fileInput) fileInput.value = '';
		} finally {
			importing = false;
		}
	}

	const statusType = $derived(backupStatus.startsWith('success') ? 'success' : 'error');
	const statusMsg = $derived(backupStatus.split(':').slice(1).join(':'));
</script>

<div class="space-y-6">
	<SectionHeader
		title="Data & Backup"
		subtitle="All your data is stored locally on your device. Export a JSON backup or restore from a previous one."
	/>

	<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
		<!-- Export Card -->
		<div class="p-5 rounded-2xl bg-[#16192b]/60 border border-white/[0.06] flex flex-col justify-between gap-4">
			<div>
				<h3 class="font-bold text-white text-sm mb-1">Export Local Backup</h3>
				<p class="text-xs text-slate-400">Download a full snapshot of your lists, history, and notes as a portable JSON file.</p>
			</div>
			<Button onclick={handleExport} loading={exporting} class="w-full">
				📥 Export JSON Backup
			</Button>
		</div>

		<!-- Restore Card -->
		<div class="p-5 rounded-2xl bg-[#16192b]/60 border border-white/[0.06] flex flex-col justify-between gap-4">
			<div>
				<h3 class="font-bold text-white text-sm mb-1">Restore from Backup</h3>
				<p class="text-xs text-slate-400">Restore your library from a previously exported JSON backup file.</p>
			</div>
			<input type="file" accept=".json" class="hidden" bind:this={fileInput} onchange={handleImport} />
			<Button variant="secondary" loading={importing} onclick={() => fileInput?.click()} class="w-full">
				📤 Choose Backup File
			</Button>
		</div>
	</div>

	{#if statusMsg}
		<div
			class="p-4 rounded-xl text-xs font-semibold
				{statusType === 'success'
				? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
				: 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}"
		>
			{statusMsg}
		</div>
	{/if}

	<div class="pt-8">
		<SectionHeader
			title="Danger Zone"
			subtitle="Destructive actions that cannot be undone."
		/>
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
			<!-- Clear Cache Card -->
			<div class="p-5 rounded-2xl bg-rose-500/5 border border-rose-500/10 flex flex-col justify-between gap-4">
				<div>
					<h3 class="font-bold text-rose-500 text-sm mb-1">Clear Media Cache</h3>
					<p class="text-xs text-slate-400">Clears cached API search results and metadata. Useful if media info (country, runtime, etc.) is incorrect.</p>
				</div>
				<Button variant="danger" onclick={() => { showCacheModal = true; startCacheTimer(); }} class="w-full">
					🗑 Clear Media Cache
				</Button>
			</div>
		</div>
	</div>
</div>

<Modal bind:open={showCacheModal} title="Clear Media Cache" size="md">
	<div class="space-y-4">
		<p class="text-sm text-slate-300">
			This will delete all cached API responses and temporary metadata. It will <strong>not</strong> delete any of your tracked media, reviews, or lists.
		</p>
		<p class="text-sm text-slate-300">
			The app will simply re-fetch the latest data from sources like TMDB, AniList, and Wikipedia the next time it needs them.
		</p>
	</div>
	{#snippet footer()}
		<div class="flex justify-end gap-3 mt-6">
			<Button variant="secondary" onclick={() => (showCacheModal = false)}>Cancel</Button>
			<Button variant="danger" onclick={handleClearCache} disabled={cacheTimer > 0}>
				{cacheTimer > 0 ? `Clear Cache (${cacheTimer}s)` : 'Clear Cache'}
			</Button>
		</div>
	{/snippet}
</Modal>
