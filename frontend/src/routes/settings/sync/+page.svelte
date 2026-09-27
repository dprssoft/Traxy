<!--
@component
Cloud sync settings: the per-device switch (`feat_cloud_sync`), which drive to use and its
credentials, connect/disconnect, "Sync now", and a setup guide for Google Drive.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';
	import { Badge, Button, SectionHeader, Select, Toggle } from '$lib/components/ui';
	import { setCloudSyncEnabled } from '$lib/db/services/settings.service';
	import { SYNC_PROVIDERS, getSyncProviderInfo } from '$lib/db/sync/providers';
	import {
		currentSyncProvider,
		performSync,
		saveSyncSettings,
		setSyncStatus,
		syncStore,
	} from '$lib/stores/sync.svelte';

	let { data }: { data: PageData } = $props();
	let enabled = $state(untrack(() => data.syncEnabled));
	let clientId = $state(syncStore.settings.clientId);
	let connected = $state(currentSyncProvider()?.isConnected() ?? false);
	let busy = $state(false);

	const inputClass =
		'w-full bg-[#0a0b12] border border-white/[0.1] rounded-xl p-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-colors text-sm';

	const providerInfo = $derived(getSyncProviderInfo(syncStore.settings.providerId));
	const configured = $derived(!!syncStore.settings.clientId);
	const origin = typeof window !== 'undefined' ? window.location.origin : '';

	async function toggle(value: boolean) {
		enabled = value;
		await setCloudSyncEnabled(value);
	}

	function saveClientId() {
		saveSyncSettings({ clientId: clientId.trim() });
		connected = currentSyncProvider()?.isConnected() ?? false;
	}

	async function syncNow() {
		const result = await performSync(true);
		connected = currentSyncProvider()?.isConnected() ?? false;
		if (result?.pulled) await invalidateAll();
	}

	async function disconnect() {
		busy = true;
		try {
			await currentSyncProvider()?.disconnect();
			setSyncStatus({ needsSignIn: false, error: null });
			connected = false;
		} finally {
			busy = false;
		}
	}
</script>

<div class="space-y-5">
	<SectionHeader
		title="Sync"
		subtitle="Keep your library the same on every device through your own cloud drive. Nothing goes to a Traxy server — there isn't one."
	/>

	<div
		class="p-5 rounded-2xl bg-[#16192b]/60 border border-white/[0.06] flex items-center justify-between gap-4"
	>
		<div>
			<label for="cloud-sync" class="font-bold text-white text-sm cursor-pointer">
				Sync this device
			</label>
			<p class="text-xs text-slate-400 mt-0.5">
				Tracking, history, collections, the feed, goals and settings. Descriptions and other details
				reload on each device by themselves. Turn it on separately on every device.
			</p>
		</div>
		<Toggle id="cloud-sync" checked={enabled} onchange={toggle} label="Sync this device" />
	</div>

	{#if enabled}
		<div class="p-5 rounded-2xl bg-[#16192b]/60 border border-white/[0.06] space-y-4">
			<div class="flex items-center justify-between gap-3">
				<h3 class="font-bold text-white text-sm">Drive</h3>
				{#if syncStore.status.needsSignIn}
					<Badge variant="amber" dot>Sign in again</Badge>
				{:else if connected}
					<Badge variant="emerald" dot>Connected</Badge>
				{:else}
					<Badge variant="slate" dot>Not connected</Badge>
				{/if}
			</div>

			<Select
				options={SYNC_PROVIDERS.map((p) => ({ value: p.id, label: p.label }))}
				value={syncStore.settings.providerId ?? ''}
				onchange={(providerId) => saveSyncSettings({ providerId })}
			/>

			{#if providerInfo?.needs.includes('clientId')}
				<div>
					<label for="sync-client-id" class="block text-xs font-medium text-slate-400 mb-1.5">
						OAuth client ID (Web application)
					</label>
					<div class="flex gap-2">
						<input
							id="sync-client-id"
							bind:value={clientId}
							placeholder="1234567890-abc….apps.googleusercontent.com"
							autocomplete="off"
							spellcheck="false"
							class={inputClass}
						/>
						<Button
							variant="secondary"
							onclick={saveClientId}
							disabled={clientId.trim() === syncStore.settings.clientId}
						>
							Save
						</Button>
					</div>
				</div>
			{/if}

			<div class="flex flex-wrap gap-2">
				<Button onclick={syncNow} loading={syncStore.status.syncing} disabled={!configured}>
					{connected && !syncStore.status.needsSignIn ? '⟳ Sync now' : 'Connect & sync'}
				</Button>
				{#if connected}
					<Button variant="ghost" onclick={disconnect} loading={busy}>Disconnect</Button>
				{/if}
			</div>

			<p class="text-xs text-slate-400">
				{#if syncStore.status.lastSyncAt}
					Last synced {new Date(syncStore.status.lastSyncAt).toLocaleString()}.
				{:else}
					Not synced yet.
				{/if}
			</p>
			{#if syncStore.status.error}
				<p
					class="p-3 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20"
				>
					{syncStore.status.error}
				</p>
			{/if}
		</div>

		{#if providerInfo?.id === 'google-drive'}
			<details class="p-5 rounded-2xl bg-[#16192b]/60 border border-white/[0.06] group">
				<summary class="font-bold text-white text-sm cursor-pointer">
					Setting up Google Drive (once)
				</summary>
				<ol class="mt-4 space-y-3 text-xs text-slate-400 list-decimal pl-5">
					<li>
						In <a
							href="https://console.cloud.google.com/"
							target="_blank"
							rel="noopener noreferrer"
							class="text-indigo-400 underline">Google Cloud Console</a
						>, create a project and enable the
						<strong class="text-slate-200">Google Drive API</strong>.
					</li>
					<li>
						Under <strong class="text-slate-200">Google Auth Platform</strong>, set up the consent
						screen as <em>External</em>, leave it in <em>Testing</em>, add your Google account as a
						test user, and add the scope
						<code class="text-slate-200">…/auth/drive.appdata</code>.
					</li>
					<li>
						Create an OAuth client of type <strong class="text-slate-200">Web application</strong>.
						Under <em>Authorized JavaScript origins</em> add every address you open Traxy at — this
						one is <code class="text-slate-200 break-all">{origin}</code>. Paste its client ID above
						on every device.
					</li>
					<li>
						For the Android app, also create an OAuth client of type
						<strong class="text-slate-200">Android</strong> in the same project with package
						<code class="text-slate-200">vc.dprssoft.traxy</code> and SHA-1
						<code class="text-slate-200 break-all"
							>AF:CE:46:56:65:CD:1E:9A:16:A0:08:7B:0D:02:DB:2B:D9:1F:D3:1B</code
						> (debug builds). You don't paste this one anywhere.
					</li>
				</ol>
				<p class="mt-3 text-xs text-slate-500">
					Traxy only gets access to its own hidden folder on your Drive. On the web, Google's
					sign-in lasts about an hour; after that, tap Sync to continue.
				</p>
			</details>
		{/if}
	{/if}
</div>
