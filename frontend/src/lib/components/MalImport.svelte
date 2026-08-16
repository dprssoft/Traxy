<script lang="ts">
	import { importFromMal } from '$lib/db/services/import.service';

	let isOpen = $state(false);
	let isImporting = $state(false);
	let fileInput = $state<HTMLInputElement | null>(null);
	let result = $state<{ success: number; failed: number } | null>(null);

	async function handleFileChange(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;

		isImporting = true;
		result = null;

		try {
			const text = await file.text();
			result = await importFromMal(text);
			setTimeout(() => {
				window.location.reload(); // Reload to refresh lists
			}, 2000);
		} catch (err) {
			console.error('Import failed', err);
			alert('File import error');
		} finally {
			isImporting = false;
			if (fileInput) fileInput.value = '';
		}
	}
</script>

<button 
	class="px-3.5 py-2 bg-[#121422] hover:bg-[#181b2e] text-slate-200 hover:text-white font-bold rounded-xl text-xs transition-all border border-white/[0.08] flex items-center gap-2 cursor-pointer shadow-sm active:scale-95"
	onclick={() => isOpen = true}
>
	<span>📥</span> Import from MAL
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
					<span>📥</span> Import from MyAnimeList
				</h2>
				<p class="text-xs text-slate-400 mt-1">
					Export your anime list from MyAnimeList (in XML format) and upload it here to import your entries directly into Traxy.
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
				<div class="flex flex-col items-center justify-center border-2 border-dashed border-white/[0.1] rounded-2xl p-8 hover:bg-white/[0.02] transition-colors">
					<input 
						type="file" 
						accept=".xml" 
						class="hidden" 
						bind:this={fileInput}
						onchange={handleFileChange}
					/>
					<button 
						class="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-indigo-500/20 transition-all cursor-pointer mb-2 active:scale-95"
						onclick={() => fileInput?.click()}
					>
						Select XML File
					</button>
					<span class="text-[11px] text-slate-500 font-medium">MAL Anime List (.xml) export format</span>
				</div>
			{/if}
		</div>
	</div>
{/if}

