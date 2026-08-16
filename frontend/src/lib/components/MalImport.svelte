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
	class="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg text-sm transition-colors border border-gray-600 flex items-center gap-2"
	onclick={() => isOpen = true}
>
	<span>📥</span> Import from MAL
</button>

{#if isOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
		<div class="bg-gray-800 border border-gray-700 rounded-xl max-w-md w-full p-6 relative shadow-2xl">
			<button 
				class="absolute top-4 right-4 text-gray-400 hover:text-white"
				onclick={() => isOpen = false}
			>
				✕
			</button>

			<h2 class="text-xl font-bold text-white mb-2">Import from MyAnimeList</h2>
			<p class="text-gray-400 text-sm mb-6">
				Експортуйте свій список аніме з MyAnimeList (у форматі XML) та завантажте його сюди, щоб перенести ваші збереження.
			</p>

			{#if isImporting}
				<div class="py-8 text-center text-brand-accent animate-pulse">
					Імпортуємо записи... Це може зайняти хвилину.
				</div>
			{:else if result}
				<div class="py-6 text-center">
					<div class="text-green-400 font-bold text-lg mb-2">Successfully imported: {result.success}</div>
					{#if result.failed > 0}
						<div class="text-red-400 text-sm">Failed to import: {result.failed}</div>
					{/if}
					<p class="text-gray-400 mt-4 text-sm">Page зараз оновиться...</p>
				</div>
			{:else}
				<div class="flex flex-col items-center justify-center border-2 border-dashed border-gray-600 rounded-xl p-8 hover:bg-gray-700/30 transition-colors">
					<input 
						type="file" 
						accept=".xml" 
						class="hidden" 
						bind:this={fileInput}
						onchange={handleFileChange}
					/>
					<button 
						class="px-6 py-2 bg-brand-accent hover:bg-brand-accent/90 text-white font-medium rounded-lg transition-colors mb-2"
						onclick={() => fileInput?.click()}
					>
						Select XML file
					</button>
					<span class="text-xs text-gray-500">тільки MAL Anime List (.xml)</span>
				</div>
			{/if}
		</div>
	</div>
{/if}
