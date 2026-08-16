<script lang="ts">
	import type { LocalMedia } from '$lib/types/mediaTypes';
	import type { LocalTrackingStatus } from '$lib/types/trackingTypes';
	import { updateProgress, upsertTracking } from '$lib/db/services/tracking.service';

	interface Props {
		media: LocalMedia;
		tracking: LocalTrackingStatus;
		onUpdate: (t: LocalTrackingStatus) => void;
	}

	let { media, tracking, onUpdate }: Props = $props();

	let isUpdating = $state(false);

	async function updateField(field: keyof LocalTrackingStatus, value: any) {
		if (isUpdating || tracking[field] === value) return;
		isUpdating = true;
		try {
			await updateProgress(media.id, field, value);
			onUpdate({ ...tracking, [field]: value });
		} catch (err) {
			console.error(`Failed to update ${field}`, err);
		} finally {
			isUpdating = false;
		}
	}

	async function updateTier(tier: any) {
		if (isUpdating || tracking.completionTier === tier) return;
		isUpdating = true;
		try {
			await upsertTracking({ mediaId: media.id, completionTier: tier });
			onUpdate({ ...tracking, completionTier: tier });
		} catch (err) {
			console.error(`Failed to update tier`, err);
		} finally {
			isUpdating = false;
		}
	}

	function increment(field: keyof LocalTrackingStatus, step = 1, max?: number) {
		const current = (tracking[field] as number) || 0;
		const next = max ? Math.min(current + step, max) : current + step;
		updateField(field, next);
	}

	function decrement(field: keyof LocalTrackingStatus, step = 1) {
		const current = (tracking[field] as number) || 0;
		const next = Math.max(current - step, 0);
		updateField(field, next);
	}
</script>

<div class="bg-gray-800/50 rounded-xl border border-gray-700 p-4">
	<h3 class="text-lg font-bold text-white mb-4">Progress</h3>
	
	<div class="flex flex-col gap-4">
		{#if media.type === 'film'}
			<p class="text-sm text-gray-400">Фільми не мають лічильника прогресу. Оновіть статус на "Переглянуто".</p>
		
		{:else if media.type === 'tv' || media.type === 'anime'}
			{#if media.type === 'tv'}
				<div class="flex items-center justify-between">
					<span class="text-gray-300 text-sm">Season</span>
					<div class="flex items-center gap-3">
						<button class="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 text-white font-bold" onclick={() => decrement('currentSeason')}>-</button>
						<span class="w-8 text-center font-bold text-white">{tracking.currentSeason || 1}</span>
						<button class="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 text-white font-bold" onclick={() => increment('currentSeason')}>+</button>
					</div>
				</div>
			{/if}
			<div class="flex items-center justify-between">
				<span class="text-gray-300 text-sm">Episode {media.totalEpisodes ? `/ ${media.totalEpisodes}` : ''}</span>
				<div class="flex items-center gap-3">
					<button class="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 text-white font-bold" onclick={() => decrement('currentEpisode')}>-</button>
					<span class="w-8 text-center font-bold text-white">{tracking.currentEpisode || 0}</span>
					<button class="w-8 h-8 rounded-full bg-brand-accent hover:bg-brand-accent/80 text-white font-bold" onclick={() => increment('currentEpisode', 1, media.totalEpisodes)}>+</button>
				</div>
			</div>

		{:else if media.type === 'manga' || media.type === 'manhwa' || media.type === 'manhua'}
			<div class="flex items-center justify-between">
				<span class="text-gray-300 text-sm">Volume</span>
				<div class="flex items-center gap-3">
					<button class="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 text-white font-bold" onclick={() => decrement('currentVolume')}>-</button>
					<span class="w-8 text-center font-bold text-white">{tracking.currentVolume || 0}</span>
					<button class="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 text-white font-bold" onclick={() => increment('currentVolume')}>+</button>
				</div>
			</div>
			<div class="flex items-center justify-between">
				<span class="text-gray-300 text-sm">Chapter</span>
				<div class="flex items-center gap-3">
					<button class="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 text-white font-bold" onclick={() => decrement('currentChapter')}>-</button>
					<span class="w-8 text-center font-bold text-white">{tracking.currentChapter || 0}</span>
					<button class="w-8 h-8 rounded-full bg-brand-accent hover:bg-brand-accent/80 text-white font-bold" onclick={() => increment('currentChapter')}>+</button>
				</div>
			</div>

		{:else if media.type === 'comic'}
			<div class="flex items-center justify-between">
				<span class="text-gray-300 text-sm">Issue {media.totalEpisodes ? `/ ${media.totalEpisodes}` : ''}</span>
				<div class="flex items-center gap-3">
					<button class="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 text-white font-bold" onclick={() => decrement('currentIssue')}>-</button>
					<span class="w-8 text-center font-bold text-white">{tracking.currentIssue || 0}</span>
					<button class="w-8 h-8 rounded-full bg-brand-accent hover:bg-brand-accent/80 text-white font-bold" onclick={() => increment('currentIssue', 1, media.totalEpisodes)}>+</button>
				</div>
			</div>

		{:else if media.type === 'book'}
			<div class="flex items-center justify-between">
				<span class="text-gray-300 text-sm">Page {media.totalPages ? `/ ${media.totalPages}` : ''}</span>
				<div class="flex items-center gap-3">
					<input 
						type="number" 
						class="w-20 bg-gray-700 border border-gray-600 rounded p-1 text-center text-white" 
						value={tracking.currentPage || 0}
						onchange={(e) => updateField('currentPage', parseInt(e.currentTarget.value) || 0)}
					/>
				</div>
			</div>

		{:else if media.type === 'game'}
			<div class="flex items-center justify-between">
				<span class="text-gray-300 text-sm">Hours played</span>
				<div class="flex items-center gap-3">
					<input 
						type="number" 
						class="w-20 bg-gray-700 border border-gray-600 rounded p-1 text-center text-white" 
						value={tracking.hoursPlayed || 0}
						onchange={(e) => updateField('hoursPlayed', parseInt(e.currentTarget.value) || 0)}
					/>
				</div>
			</div>
			<div class="pt-2 border-t border-gray-700">
				<span class="text-gray-300 text-sm block mb-2">Completion tier</span>
				<div class="flex flex-col gap-2">
					<button 
						class="text-left px-3 py-2 rounded text-sm transition-colors {tracking.completionTier === 'main_story' ? 'bg-brand-accent/20 text-brand-accent border border-brand-accent/30' : 'bg-gray-700/50 text-gray-300 border border-transparent'}"
						onclick={() => updateTier('main_story')}
					>
						Main story
					</button>
					<button 
						class="text-left px-3 py-2 rounded text-sm transition-colors {tracking.completionTier === 'main_plus_sides' ? 'bg-brand-accent/20 text-brand-accent border border-brand-accent/30' : 'bg-gray-700/50 text-gray-300 border border-transparent'}"
						onclick={() => updateTier('main_plus_sides')}
					>
						Story + Доп. квести
					</button>
					<button 
						class="text-left px-3 py-2 rounded text-sm transition-colors {tracking.completionTier === 'completionist' ? 'bg-brand-accent/20 text-brand-accent border border-brand-accent/30' : 'bg-gray-700/50 text-gray-300 border border-transparent'}"
						onclick={() => updateTier('completionist')}
					>
						100% (Комплеціоніст)
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>
