<script lang="ts">
	import { untrack } from 'svelte';
	let { note, onSave }: { note?: string; onSave: (val: string) => void } = $props();

	let currentNote = $state(untrack(() => note ?? ''));
	let isEditing = $state(false);

	$effect(() => {
		// Sync with prop if it changes externally while not editing
		if (!isEditing) {
			currentNote = note ?? '';
		}
	});

	function save() {
		onSave(currentNote.trim());
		isEditing = false;
	}
</script>

<div class="bg-gray-800/50 rounded-xl border border-gray-700 p-5 relative">
	<div class="flex justify-between items-center mb-3">
		<h3 class="font-bold text-white text-base flex items-center gap-2">
			<span>📝</span> Personal Note
		</h3>
		{#if !isEditing}
			<button 
				type="button"
				onclick={() => isEditing = true} 
				class="text-xs font-semibold uppercase tracking-wider text-brand-accent hover:text-white px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors cursor-pointer"
			>
				{currentNote ? 'Edit' : '+ Add Note'}
			</button>
		{/if}
	</div>
	
	{#if isEditing}
		<textarea 
			bind:value={currentNote} 
			class="w-full h-32 p-3 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-brand-accent text-white placeholder-gray-500 text-sm resize-none transition-colors"
			placeholder="Write your personal thoughts, review notes, or memories here..."></textarea>
		<div class="flex justify-end gap-2 mt-3">
			<button 
				type="button"
				onclick={() => { currentNote = note ?? ''; isEditing = false; }} 
				class="px-4 py-1.5 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-700/60 rounded-lg transition-colors cursor-pointer"
			>
				Cancel
			</button>
			<button 
				type="button"
				onclick={save} 
				class="px-4 py-1.5 text-sm bg-brand-accent hover:bg-brand-accent/90 text-white font-medium rounded-lg shadow transition-colors cursor-pointer"
			>
				Save Note
			</button>
		</div>
	{:else}
		{#if currentNote}
			<div class="prose prose-sm text-gray-300 whitespace-pre-wrap leading-relaxed bg-gray-900/40 p-3.5 rounded-lg border border-gray-700/40">{currentNote}</div>
		{:else}
			<p class="text-gray-500 italic text-sm text-center py-4 bg-gray-900/20 rounded-lg border border-dashed border-gray-700">No personal note added yet.</p>
		{/if}
	{/if}
</div>
