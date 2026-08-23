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

<div class="bg-[#121422]/80 backdrop-blur-xl rounded-3xl border border-white/[0.08] p-4 sm:p-6 shadow-xl relative">
	<div class="flex justify-between items-center mb-4">
		<h3 class="text-base font-bold text-white flex items-center gap-2">
			<span>📝</span> Personal Note
		</h3>
		{#if !isEditing}
			<button 
				type="button"
				onclick={() => isEditing = true} 
				class="text-[10px] font-bold uppercase tracking-wider text-indigo-400 hover:text-white px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-lg border border-indigo-500/20 transition-colors cursor-pointer"
			>
				{currentNote ? 'Edit' : '+ Add Note'}
			</button>
		{/if}
	</div>
	
	{#if isEditing}
		<textarea 
			bind:value={currentNote} 
			class="w-full h-32 p-3 bg-[#16192b] border border-white/[0.08] rounded-xl focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 text-white placeholder-slate-500 text-sm resize-none transition-colors outline-none"
			placeholder="Write your personal thoughts, review notes, or memories here..."></textarea>
		<div class="flex justify-end gap-2 mt-3">
			<button 
				type="button"
				onclick={() => { currentNote = note ?? ''; isEditing = false; }} 
				class="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white hover:bg-white/[0.06] rounded-xl transition-colors cursor-pointer"
			>
				Cancel
			</button>
			<button 
				type="button"
				onclick={save} 
				class="px-4 py-2 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-md shadow-indigo-600/20 transition-colors cursor-pointer"
			>
				Save Note
			</button>
		</div>
	{:else}
		{#if currentNote}
			<div class="prose prose-sm text-slate-300 whitespace-pre-wrap leading-relaxed bg-[#16192b]/60 p-4 rounded-xl border border-white/[0.04]">{currentNote}</div>
		{:else}
			<p class="text-slate-500 italic text-xs text-center py-5 bg-[#16192b]/40 rounded-xl border border-dashed border-white/[0.06]">No personal note added yet.</p>
		{/if}
	{/if}
</div>
