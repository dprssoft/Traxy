<script lang="ts">
	import type { LocalMedia } from '$lib/types/mediaTypes';
	import type { SystemCollectionKey } from '$lib/types/collectionTypes';
	import {
		isInSystemCollection,
		toggleSystemCollection,
	} from '$lib/db/services/collection.service';

	interface Props {
		media: Pick<LocalMedia, 'id' | 'type'>;
		kind: SystemCollectionKey;
		onchange?: (active: boolean) => void;
	}

	let { media, kind, onchange }: Props = $props();

	let active = $state(false);
	let loading = $state(false);

	$effect(() => {
		const mediaId = media.id;
		isInSystemCollection(kind, mediaId)
			.then((v) => (active = v))
			.catch(() => (active = false));
	});

	async function toggle() {
		if (loading) return;
		loading = true;
		try {
			active = await toggleSystemCollection(kind, media);
			onchange?.(active);
		} catch (err) {
			console.error(`Failed to toggle ${kind}`, err);
		} finally {
			loading = false;
		}
	}

	const labels: Record<SystemCollectionKey, [string, string]> = {
		favorites: ['Add to favorites', 'Remove from favorites'],
		wishlist: ['Add to wishlist', 'Remove from wishlist'],
	};
	const activeClass: Record<SystemCollectionKey, string> = {
		favorites: 'bg-rose-500/20 border-rose-500/30 text-rose-400',
		wishlist: 'bg-amber-500/20 border-amber-500/30 text-amber-400',
	};
	const hoverClass: Record<SystemCollectionKey, string> = {
		favorites: 'hover:text-rose-400',
		wishlist: 'hover:text-amber-400',
	};
</script>

<button
	type="button"
	onclick={toggle}
	disabled={loading}
	class="w-10 h-10 flex items-center justify-center rounded-xl border transition-all active:scale-95 cursor-pointer
		{active
		? activeClass[kind]
		: `bg-white/[0.06] hover:bg-white/[0.12] border-white/[0.08] text-slate-400 ${hoverClass[kind]}`}"
	aria-label={labels[kind][active ? 1 : 0]}
	aria-pressed={active}
	title={labels[kind][active ? 1 : 0]}
>
	{#if kind === 'favorites'}
		<svg
			class="w-5 h-5"
			fill={active ? 'currentColor' : 'none'}
			viewBox="0 0 24 24"
			stroke="currentColor"
			stroke-width="2"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
			/>
		</svg>
	{:else}
		<!-- Gift: "want to own" -->
		<svg
			class="w-5 h-5"
			fill={active ? 'currentColor' : 'none'}
			fill-opacity={active ? 0.25 : 0}
			viewBox="0 0 24 24"
			stroke="currentColor"
			stroke-width="2"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
			/>
		</svg>
	{/if}
</button>
