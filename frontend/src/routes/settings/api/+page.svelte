<script lang="ts">
	import { apiKeyStore, saveApiKeys } from '$lib/stores/apiKeys.svelte';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';

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
</script>

<div class="space-y-6">
	<SectionHeader
		title="External Source Integrations"
		subtitle="Traxy searches external APIs directly from your device. Provide personal keys or leave blank to use the built-in defaults."
	/>

	<!-- TMDB -->
	<div class="p-5 rounded-2xl bg-[#16192b]/60 border border-white/[0.06] space-y-3">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2.5">
				<Badge variant="indigo">Movies & TV</Badge>
				<h3 class="font-bold text-white text-sm">The Movie Database (TMDB)</h3>
			</div>
			<Badge variant="emerald" dot>Ready</Badge>
		</div>
		<div>
			<label for="tmdbKey" class="block text-xs font-medium text-slate-400 mb-1.5">
				TMDB API Key (v3 auth)
			</label>
			<input
				type="password"
				id="tmdbKey"
				bind:value={tmdbKey}
				placeholder="Leave blank to use built-in default"
				class={inputClass}
			/>
		</div>
	</div>

	<!-- IGDB -->
	<div class="p-5 rounded-2xl bg-[#16192b]/60 border border-white/[0.06] space-y-3">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2.5">
				<Badge variant="emerald">Video Games</Badge>
				<h3 class="font-bold text-white text-sm">IGDB (Twitch Developer)</h3>
			</div>
			<Badge variant="emerald" dot>Ready</Badge>
		</div>
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
			<div>
				<label for="igdbClientId" class="block text-xs font-medium text-slate-400 mb-1.5">
					Client ID
				</label>
				<input
					type="text"
					id="igdbClientId"
					bind:value={igdbClientId}
					placeholder="Twitch Client ID"
					class={inputClass}
				/>
			</div>
			<div>
				<label for="igdbClientSecret" class="block text-xs font-medium text-slate-400 mb-1.5">
					Client Secret
				</label>
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
			Obtain free credentials at <a
				href="https://dev.twitch.tv/console"
				target="_blank"
				class="text-indigo-400 hover:underline">dev.twitch.tv/console</a
			> → Applications.
		</p>
	</div>

	<!-- ComicVine -->
	<div class="p-5 rounded-2xl bg-[#16192b]/60 border border-white/[0.06] space-y-3">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2.5">
				<Badge variant="amber">Comics</Badge>
				<h3 class="font-bold text-white text-sm">ComicVine API</h3>
			</div>
			<Badge variant="emerald" dot>Ready</Badge>
		</div>
		<div>
			<label for="comicvineKey" class="block text-xs font-medium text-slate-400 mb-1.5">
				ComicVine API Key
			</label>
			<input
				type="password"
				id="comicvineKey"
				bind:value={comicvineKey}
				placeholder="Leave blank to use built-in default"
				class={inputClass}
			/>
		</div>
	</div>

	<!-- Save -->
	<div class="flex items-center gap-4 pt-1">
		<Button onclick={saveApiSettings}>Save API Keys</Button>
		{#if keysSaved}
			<span class="text-emerald-400 text-sm font-semibold flex items-center gap-1.5">
				<span>✓</span> Keys saved successfully!
			</span>
		{/if}
	</div>
</div>
