<!--
@component
Renderless: keeps this device in sync in the background while cloud sync is switched on and
the drive is connected. Syncs on start, ~10 s after local changes, when the app comes back to
the foreground or online, and every 5 minutes. Never asks the user anything — a needed
sign-in shows up in Settings → Sync instead.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { Capacitor } from '@capacitor/core';
	import { App } from '@capacitor/app';
	import { getCloudSyncEnabled } from '$lib/db/services/settings.service';
	import { onLocalChange } from '$lib/db/services/sync.service';
	import { currentSyncProvider, performSync, syncStore } from '$lib/stores/sync.svelte';

	const AFTER_CHANGE_MS = 10_000;
	const PERIODIC_MS = 5 * 60_000;

	let timer: ReturnType<typeof setTimeout> | undefined;

	async function autoSync() {
		timer = undefined;
		if (!navigator.onLine || syncStore.status.needsSignIn) return;
		if (!currentSyncProvider()?.isConnected()) return;
		if (!(await getCloudSyncEnabled().catch(() => false))) return;
		const result = await performSync(false);
		if (result?.pulled) await invalidateAll();
	}

	function schedule(delay: number) {
		clearTimeout(timer);
		timer = setTimeout(autoSync, delay);
	}

	/** Leaving the app: push a pending change now rather than when we're next opened. */
	function flushPending() {
		if (timer !== undefined) {
			clearTimeout(timer);
			void autoSync();
		}
	}

	onMount(() => {
		schedule(1_000);
		// Sync's own writes happen while `syncing`; they must not schedule another round.
		const stopListening = onLocalChange(() => {
			if (!syncStore.status.syncing) schedule(AFTER_CHANGE_MS);
		});
		const onVisibility = () =>
			document.visibilityState === 'visible' ? schedule(500) : flushPending();
		const onOnline = () => schedule(500);
		document.addEventListener('visibilitychange', onVisibility);
		window.addEventListener('online', onOnline);
		const interval = setInterval(() => schedule(0), PERIODIC_MS);
		const appState = Capacitor.isNativePlatform()
			? App.addListener('appStateChange', ({ isActive }) =>
					isActive ? schedule(500) : flushPending(),
				)
			: null;

		return () => {
			clearTimeout(timer);
			clearInterval(interval);
			stopListening();
			document.removeEventListener('visibilitychange', onVisibility);
			window.removeEventListener('online', onOnline);
			void appState?.then((handle) => handle.remove());
		};
	});
</script>
