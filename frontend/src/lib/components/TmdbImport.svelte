<script lang="ts">
	import { apiKeyStore } from '$lib/stores/apiKeys.svelte';
	import { createTmdbRequestToken, createTmdbSession } from '$lib/db/sources/tmdbAuth';
	import { importFromTmdb } from '$lib/db/services/import.service';

	let isOpen = $state(false);
	let step = $state<1 | 2 | 3>(1);
	let requestToken = $state('');
	let approvalUrl = $state('');
	let sessionId = $state('');
	let isProcessing = $state(false);
	let result = $state<{ success: number; failed: number } | null>(null);
	let errorMsg = $state('');

	const ENV_TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;
	let currentApiKey = $derived(apiKeyStore.current.tmdb || ENV_TMDB_API_KEY);

	async function startAuth() {
		if (!currentApiKey) return;
		errorMsg = '';
		isProcessing = true;
		try {
			const data = await createTmdbRequestToken(currentApiKey);
			requestToken = data.token;
			approvalUrl = data.approvalUrl;
			step = 2;
		} catch (err) {
			console.error(err);
			errorMsg = 'Failed to generate token. Check API key.';
		} finally {
			isProcessing = false;
		}
	}

	async function completeAuth() {
		errorMsg = '';
		isProcessing = true;
		try {
			sessionId = await createTmdbSession(currentApiKey, requestToken);
			step = 3;
			await runImport();
		} catch (err) {
			console.error(err);
			errorMsg = 'Approval failed. Did you approve on TMDB?';
		} finally {
			isProcessing = false;
		}
	}

	async function runImport() {
		try {
			result = await importFromTmdb(currentApiKey, sessionId);
			setTimeout(() => window.location.reload(), 2000);
		} catch (err) {
			console.error(err);
			errorMsg = 'Import process failed.';
		}
	}

	function reset() {
		isOpen = false;
		step = 1;
		requestToken = '';
		approvalUrl = '';
		sessionId = '';
		result = null;
		errorMsg = '';
	}
</script>

<button 
	class="px-3.5 py-2 bg-[#121422] hover:bg-[#181b2e] text-slate-200 hover:text-white font-bold rounded-xl text-xs transition-all border border-white/[0.08] flex items-center gap-2 cursor-pointer shadow-sm active:scale-95"
	onclick={() => isOpen = true}
>
	<span>📥</span> Import from TMDB
</button>

{#if isOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
		<div class="bg-[#121422] border border-white/[0.1] rounded-3xl max-w-md w-full p-6 sm:p-8 relative shadow-2xl space-y-4">
			<button 
				class="absolute top-5 right-5 text-slate-400 hover:text-white cursor-pointer p-1 rounded-lg hover:bg-white/[0.06] transition-colors"
				onclick={reset}
			>
				✕
			</button>

			<div>
				<h2 class="text-xl font-bold text-white flex items-center gap-2">
					<span>📥</span> Import from TMDB
				</h2>
				<p class="text-xs text-slate-400 mt-1">
					Import your watchlist and rated movies/TV shows directly from your TMDB account.
				</p>
			</div>

			{#if !currentApiKey}
				<div class="text-[11px] text-rose-400/80 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
					<strong>API Key Required:</strong> You must configure a TMDB API key in the "API Integrations" tab to use this feature.
				</div>
			{:else}
				{#if errorMsg}
					<div class="text-[11px] text-rose-400/80 bg-rose-500/10 p-2 rounded-xl border border-rose-500/20 mb-2">
						{errorMsg}
					</div>
				{/if}

				{#if step === 1}
					<div class="space-y-4 pt-2 text-center">
						<p class="text-xs text-slate-300">
							Step 1: Generate an authentication token to request access to your TMDB account.
						</p>
						<button 
							class="w-full py-2.5 bg-[#1e2238] hover:bg-[#252a45] text-white font-bold rounded-xl text-sm border border-white/[0.08] transition-all cursor-pointer active:scale-95 disabled:opacity-50"
							onclick={startAuth}
							disabled={isProcessing}
						>
							{isProcessing ? 'Generating...' : 'Generate Token'}
						</button>
					</div>
				{:else if step === 2}
					<div class="space-y-4 pt-2 text-center">
						<p class="text-xs text-slate-300">
							Step 2: Please approve the request on TMDB's website. A new tab will open.
						</p>
						<a 
							href={approvalUrl} 
							target="_blank" 
							rel="noopener noreferrer"
							class="inline-block w-full py-2.5 bg-[#0a0b12] text-indigo-400 font-bold rounded-xl text-sm border border-indigo-500/30 transition-all hover:bg-indigo-500/10 mb-2 text-center"
						>
							Open TMDB Approval Page ↗
						</a>
						<p class="text-xs text-slate-400 mb-2">Once approved on TMDB, click below:</p>
						<button 
							class="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl text-sm shadow-lg shadow-indigo-500/20 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
							onclick={completeAuth}
							disabled={isProcessing}
						>
							{isProcessing ? 'Processing...' : "I've Approved on TMDB"}
						</button>
					</div>
				{:else if step === 3}
					{#if !result}
						<div class="py-10 text-center text-indigo-400 font-bold text-sm animate-pulse flex flex-col items-center gap-3">
							<span class="w-6 h-6 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin"></span>
							Importing entries... This may take a moment.
						</div>
					{:else}
						<div class="py-6 text-center space-y-2">
							<div class="text-emerald-400 font-bold text-base">Successfully imported: {result.success}</div>
							{#if result.failed > 0}
								<div class="text-rose-400 text-xs">Failed to import: {result.failed}</div>
							{/if}
							<p class="text-slate-400 text-xs">Page will refresh shortly...</p>
						</div>
					{/if}
				{/if}
			{/if}
		</div>
	</div>
{/if}
