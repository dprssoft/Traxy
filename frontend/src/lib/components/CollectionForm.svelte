<script lang="ts">
	import { untrack } from 'svelte';
	import type { MediaType } from '$lib/db/schema';
	import type { CollectionInput } from '$lib/types/collectionTypes';
	import { MEDIA_TYPE_PLURAL_LABELS } from '$lib/constants';
	import { Button, Select, Toggle } from '$lib/components/ui';

	interface Props {
		initial?: Partial<CollectionInput>;
		/** System collections: name and type are fixed. */
		locked?: boolean;
		submitLabel?: string;
		onsubmit: (input: CollectionInput) => Promise<void>;
		oncancel?: () => void;
	}

	let { initial = {}, locked = false, submitLabel = 'Save', onsubmit, oncancel }: Props = $props();

	let name = $state(untrack(() => initial.name ?? ''));
	let description = $state(untrack(() => initial.description ?? ''));
	let mediaType = $state<string>(untrack(() => initial.mediaType ?? ''));
	let isRanked = $state(untrack(() => initial.isRanked ?? false));
	let saving = $state(false);
	let error = $state('');

	const typeOptions = [
		{ value: '', label: 'Shared — any media type' },
		...(Object.keys(MEDIA_TYPE_PLURAL_LABELS) as MediaType[]).map((t) => ({
			value: t,
			label: `${MEDIA_TYPE_PLURAL_LABELS[t]} only`,
		})),
	];

	const inputClass =
		'w-full px-3 py-2 bg-[#181b2e] border border-white/[0.08] focus:border-indigo-500 rounded-xl text-sm text-white placeholder-slate-500 outline-none disabled:opacity-60';

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!name.trim() || saving) return;
		saving = true;
		error = '';
		try {
			await onsubmit({
				name: name.trim(),
				description: description.trim(),
				mediaType: (mediaType || null) as MediaType | null,
				isRanked,
			});
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not save the collection.';
		} finally {
			saving = false;
		}
	}
</script>

<form onsubmit={handleSubmit} class="space-y-4">
	<label class="block space-y-1.5">
		<span class="text-xs font-bold uppercase tracking-wider text-slate-400">Name</span>
		<input
			type="text"
			bind:value={name}
			maxlength={80}
			required
			disabled={locked}
			placeholder="e.g. Cozy games"
			class={inputClass}
		/>
	</label>

	<label class="block space-y-1.5">
		<span class="text-xs font-bold uppercase tracking-wider text-slate-400">Description</span>
		<textarea
			bind:value={description}
			maxlength={255}
			rows="2"
			placeholder="Optional"
			class="{inputClass} resize-none"
		></textarea>
	</label>

	<div class="space-y-1.5">
		<span class="text-xs font-bold uppercase tracking-wider text-slate-400">Media type</span>
		<Select options={typeOptions} bind:value={mediaType} disabled={locked} />
	</div>

	<div class="flex items-center justify-between gap-3">
		<div>
			<span class="text-sm font-semibold text-slate-200 block">Ranked list</span>
			<span class="text-xs text-slate-500">Number items as a Top N in your own order</span>
		</div>
		<Toggle bind:checked={isRanked} label="Ranked list" />
	</div>

	{#if error}
		<p class="text-xs text-rose-400">{error}</p>
	{/if}

	<div class="flex justify-end gap-2 pt-1">
		{#if oncancel}
			<Button variant="ghost" size="sm" onclick={oncancel}>Cancel</Button>
		{/if}
		<Button type="submit" size="sm" loading={saving} disabled={!name.trim()}>{submitLabel}</Button>
	</div>
</form>
