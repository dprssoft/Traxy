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

<div class="bg-[#121422]/80 backdrop-blur-xl rounded-3xl border border-white/[0.08] p-6 shadow-xl">
	<h3 class="text-base font-bold text-white mb-4 flex items-center gap-2">
		<span>📊</span> Progress Tracking
	</h3>
	
	<div class="flex flex-col gap-4">
		{#if media.type === 'film'}
			<p class="text-xs text-slate-400 bg-[#16192b] p-4 rounded-xl border border-white/[0.06]">
				Movies do not have a progress counter. Update status to "Completed".
			</p>
		
		{:else if media.type === 'tv' || media.type === 'anime'}
			{#if media.type === 'tv'}
				<div class="flex items-center justify-between p-3 rounded-2xl bg-[#16192b]/60 border border-white/[0.04]">
					<span class="text-slate-300 text-xs font-semibold">Season</span>
					<div class="flex items-center gap-2.5">
						<button class="w-8 h-8 rounded-xl bg-[#1e2238] hover:bg-[#282e4c] text-white font-bold transition-all active:scale-95 cursor-pointer border border-white/[0.06]" onclick={() => decrement('currentSeason')}>-</button>
						<span class="w-8 text-center font-extrabold text-white text-sm">{tracking.currentSeason || 1}</span>
						<button class="w-8 h-8 rounded-xl bg-[#1e2238] hover:bg-[#282e4c] text-white font-bold transition-all active:scale-95 cursor-pointer border border-white/[0.06]" onclick={() => increment('currentSeason')}>+</button>
					</div>
				</div>
			{/if}
			<div class="flex items-center justify-between p-3 rounded-2xl bg-[#16192b]/60 border border-white/[0.04]">
				<span class="text-slate-300 text-xs font-semibold">Episode {media.totalEpisodes ? `/ ${media.totalEpisodes}` : ''}</span>
				<div class="flex items-center gap-2.5">
					<button class="w-8 h-8 rounded-xl bg-[#1e2238] hover:bg-[#282e4c] text-white font-bold transition-all active:scale-95 cursor-pointer border border-white/[0.06]" onclick={() => decrement('currentEpisode')}>-</button>
					<span class="w-8 text-center font-extrabold text-white text-sm">{tracking.currentEpisode || 0}</span>
					<button class="w-8 h-8 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-md shadow-indigo-600/30 transition-all active:scale-95 cursor-pointer" onclick={() => increment('currentEpisode', 1, media.totalEpisodes)}>+</button>
				</div>
			</div>

		{:else if media.type === 'manga' || media.type === 'manhwa' || media.type === 'manhua'}
			<div class="flex items-center justify-between p-3 rounded-2xl bg-[#16192b]/60 border border-white/[0.04]">
				<span class="text-slate-300 text-xs font-semibold">Volume</span>
				<div class="flex items-center gap-2.5">
					<button class="w-8 h-8 rounded-xl bg-[#1e2238] hover:bg-[#282e4c] text-white font-bold transition-all active:scale-95 cursor-pointer border border-white/[0.06]" onclick={() => decrement('currentVolume')}>-</button>
					<span class="w-8 text-center font-extrabold text-white text-sm">{tracking.currentVolume || 0}</span>
					<button class="w-8 h-8 rounded-xl bg-[#1e2238] hover:bg-[#282e4c] text-white font-bold transition-all active:scale-95 cursor-pointer border border-white/[0.06]" onclick={() => increment('currentVolume')}>+</button>
				</div>
			</div>
			<div class="flex items-center justify-between p-3 rounded-2xl bg-[#16192b]/60 border border-white/[0.04]">
				<span class="text-slate-300 text-xs font-semibold">Chapter</span>
				<div class="flex items-center gap-2.5">
					<button class="w-8 h-8 rounded-xl bg-[#1e2238] hover:bg-[#282e4c] text-white font-bold transition-all active:scale-95 cursor-pointer border border-white/[0.06]" onclick={() => decrement('currentChapter')}>-</button>
					<span class="w-8 text-center font-extrabold text-white text-sm">{tracking.currentChapter || 0}</span>
					<button class="w-8 h-8 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-md shadow-indigo-600/30 transition-all active:scale-95 cursor-pointer" onclick={() => increment('currentChapter')}>+</button>
				</div>
			</div>

		{:else if media.type === 'comic'}
			<div class="flex items-center justify-between p-3 rounded-2xl bg-[#16192b]/60 border border-white/[0.04]">
				<span class="text-slate-300 text-xs font-semibold">Issue {media.totalEpisodes ? `/ ${media.totalEpisodes}` : ''}</span>
				<div class="flex items-center gap-2.5">
					<button class="w-8 h-8 rounded-xl bg-[#1e2238] hover:bg-[#282e4c] text-white font-bold transition-all active:scale-95 cursor-pointer border border-white/[0.06]" onclick={() => decrement('currentIssue')}>-</button>
					<span class="w-8 text-center font-extrabold text-white text-sm">{tracking.currentIssue || 0}</span>
					<button class="w-8 h-8 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-md shadow-indigo-600/30 transition-all active:scale-95 cursor-pointer" onclick={() => increment('currentIssue', 1, media.totalEpisodes)}>+</button>
				</div>
			</div>

		{:else if media.type === 'book'}
			<div class="flex items-center justify-between p-3 rounded-2xl bg-[#16192b]/60 border border-white/[0.04]">
				<span class="text-slate-300 text-xs font-semibold">Page {media.totalPages ? `/ ${media.totalPages}` : ''}</span>
				<div class="flex items-center gap-3">
					<input 
						type="number" 
						class="w-24 bg-[#0a0b12] border border-white/[0.1] rounded-xl p-1.5 text-center text-white font-bold text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" 
						value={tracking.currentPage || 0}
						onchange={(e) => updateField('currentPage', parseInt(e.currentTarget.value) || 0)}
					/>
				</div>
			</div>

		{:else if media.type === 'game'}
			<div class="flex items-center justify-between p-3 rounded-2xl bg-[#16192b]/60 border border-white/[0.04]">
				<span class="text-slate-300 text-xs font-semibold">Hours played</span>
				<div class="flex items-center gap-3">
					<input 
						type="number" 
						class="w-24 bg-[#0a0b12] border border-white/[0.1] rounded-xl p-1.5 text-center text-white font-bold text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" 
						value={tracking.hoursPlayed || 0}
						onchange={(e) => updateField('hoursPlayed', parseInt(e.currentTarget.value) || 0)}
					/>
				</div>
			</div>
			<div class="pt-3 border-t border-white/[0.06]">
				<span class="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-2.5">Completion Tier</span>
				<div class="flex flex-col gap-2">
					<button 
						class="text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer {tracking.completionTier === 'main_story' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/40 shadow-sm shadow-indigo-500/10' : 'bg-[#16192b]/70 text-slate-400 hover:text-white hover:bg-[#1e2238] border border-white/[0.04]'}"
						onclick={() => updateTier('main_story')}
					>
						Main story
					</button>
					<button 
						class="text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer {tracking.completionTier === 'main_plus_sides' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/40 shadow-sm shadow-indigo-500/10' : 'bg-[#16192b]/70 text-slate-400 hover:text-white hover:bg-[#1e2238] border border-white/[0.04]'}"
						onclick={() => updateTier('main_plus_sides')}
					>
						Story + Side quests
					</button>
					<button 
						class="text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer {tracking.completionTier === 'completionist' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/40 shadow-sm shadow-indigo-500/10' : 'bg-[#16192b]/70 text-slate-400 hover:text-white hover:bg-[#1e2238] border border-white/[0.04]'}"
						onclick={() => updateTier('completionist')}
					>
						100% (Completionist)
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>
