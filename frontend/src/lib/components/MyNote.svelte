<script lang="ts">
	import { untrack } from 'svelte';
	let { note, onSave }: { note?: string, onSave: (val: string) => void } = $props();
	
	let currentNote = $state(untrack(() => note ?? ''));
	let isEditing = $state(false);

	$effect(() => {
		// Sync with prop if it changes externally while not editing
		if (!isEditing) {
			currentNote = note ?? '';
		}
	});

	function save() {
		onSave(currentNote);
		isEditing = false;
	}
</script>

<div class="bg-gradient-to-br from-blue-50/50 to-indigo-50/50 rounded-3xl p-6 border border-blue-100/60 shadow-sm relative overflow-hidden">
	<div class="absolute top-0 right-0 w-32 h-32 bg-blue-100/30 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>

	<div class="flex justify-between items-center mb-4 relative">
		<h3 class="font-bold text-blue-950 text-lg flex items-center gap-2">
			<span class="text-xl">📝</span> Personal Note
		</h3>
		{#if !isEditing}
			<button onclick={() => isEditing = true} class="text-xs font-bold uppercase tracking-wider text-blue-600 hover:text-blue-800 hover:bg-white px-4 py-1.5 bg-white/60 rounded-full shadow-sm border border-blue-200/60 transition-all active:scale-95">Edit</button>
		{/if}
	</div>
	
	{#if isEditing}
		<textarea 
			bind:value={currentNote} 
			class="w-full h-36 p-4 border border-blue-200/80 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 bg-white shadow-inner text-gray-700 transition-all resize-none relative z-10"
			placeholder="Write your personal thoughts, critique, or memories here..."></textarea>
		<div class="flex justify-end gap-3 mt-4 relative z-10">
			<button onclick={() => { currentNote = note ?? ''; isEditing = false; }} class="px-5 py-2.5 text-sm font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-100/80 rounded-xl transition-colors">Cancel</button>
			<button onclick={save} class="px-5 py-2.5 text-sm bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-600/20 transition-all active:scale-95">Save Note</button>
		</div>
	{:else}
		{#if currentNote}
			<div class="prose prose-sm text-gray-700 whitespace-pre-wrap leading-relaxed relative z-10">{currentNote}</div>
		{:else}
			<p class="text-gray-400 italic text-sm text-center py-6 bg-white/40 rounded-2xl border border-dashed border-blue-200">No personal note added yet.</p>
		{/if}
	{/if}
</div>
