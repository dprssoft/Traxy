<script lang="ts">
	import { importFromAnilist } from '$lib/db/services/import.service';

	let isOpen = $state(false);
	let isImporting = $state(false);
	let username = $state('');
	let result = $state<{ success: number; failed: number } | null>(null);

	async function handleImport() {
		if (!username.trim()) return;
		isImporting = true;
		result = null;

		try {
			result = await importFromAnilist(username.trim());
			setTimeout(() => {
				window.location.reload(); // Reload to refresh lists
			}, 2000);
		} catch (err) {
			console.error('Import failed', err);
			alert('Import error');
		} finally {
			isImporting = false;
		}
	}
</script>

<button 
	class="px-3.5 py-2 bg-[#121422] hover:bg-[#181b2e] text-slate-200 hover:text-white font-bold rounded-xl text-xs transition-all border border-white/[0.08] flex items-center gap-2 cursor-pointer shadow-sm active:scale-95"
	onclick={() => isOpen = true}
>
	<span>📥</span> Import from AniList
</button>

{#if isOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
		<div class="bg-[#121422] border border-white/[0.1] rounded-3xl max-w-md w-full p-6 sm:p-8 relative shadow-2xl space-y-4">
			<button 
				class="absolute top-5 right-5 text-slate-400 hover:text-white cursor-pointer p-1 rounded-lg hover:bg-white/[0.06] transition-colors"
				onclick={() => isOpen = false}
			>
				✕
			</button>

			<div>
				<h2 class="text-xl font-bold text-white flex items-center gap-2">
					<span>📥</span> Import from AniList
				</h2>
				<p class="text-xs text-slate-400 mt-1">
					Import your anime and manga lists directly from a public AniList profile.
				</p>
			</div>

			{#if isImporting}
				<div class="py-10 text-center text-indigo-400 font-bold text-sm animate-pulse flex flex-col items-center gap-3">
					<span class="w-6 h-6 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin"></span>
					Importing entries... This may take a moment.
				</div>
			{:else if result}
				<div class="py-6 text-center space-y-2">
					<div class="text-emerald-400 font-bold text-base">Successfully imported: {result.success}</div>
					{#if result.failed > 0}
						<div class="text-rose-400 text-xs">Failed to import: {result.failed}</div>
					{/if}
					<p class="text-slate-400 text-xs">Page will refresh shortly...</p>
				</div>
			{:else}
				<div class="space-y-4 pt-2">
					<div>
						<label for="anilist-username" class="block text-xs font-medium text-slate-400 mb-1.5">AniList Username</label>
						<input
							type="text"
							id="anilist-username"
							bind:value={username}
							placeholder="Enter your username"
							class="w-full bg-[#0a0b12] border border-white/[0.1] rounded-xl p-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-colors text-sm"
						/>
					</div>
					<div class="text-[11px] text-amber-400/80 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
						<strong>Note:</strong> Your AniList profile must be set to <strong>public</strong> for the import to work. Private profiles are not supported.
					</div>
					<button 
						class="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl text-sm shadow-lg shadow-indigo-500/20 transition-all cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
						onclick={handleImport}
						disabled={!username.trim()}
					>
						Start Import
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}
