<script lang="ts">
	import type { LocalMedia } from '$lib/types/mediaTypes';
	import type { LocalTrackingStatus } from '$lib/types/trackingTypes';
	import { updateProgress, upsertTracking } from '$lib/db/services/tracking.service';

	import { getMediaByExternalId, upsertMedia } from '$lib/db/services/media.service';
	import { getAnilistDetails } from '$lib/db/sources/anilist';
	import { goto } from '$app/navigation';

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

	let currentAnimeSeason = $derived(
		media.type === 'anime' && media.seasonData
			? media.seasonData.find((s) => s.linkedMediaId === media.externalId)?.seasonNumber || 1
			: 1
	);

	async function changeAnimeSeason(step: number) {
		if (isUpdating || !media.seasonData) return;

		const nextSeasonNum = currentAnimeSeason + step;
		const nextSeason = media.seasonData.find((s) => s.seasonNumber === nextSeasonNum);
		if (!nextSeason?.linkedMediaId) return;

		isUpdating = true;
		try {
			let existing = await getMediaByExternalId('anilist', nextSeason.linkedMediaId);
			if (existing) {
				goto(`/media/${existing.id}`);
				return;
			}
			const fullDetails = await getAnilistDetails(parseInt(nextSeason.linkedMediaId));
			if (!fullDetails) return;

			const inserted = await upsertMedia({
				id: crypto.randomUUID(),
				source: fullDetails.source,
				externalId: fullDetails.externalId,
				type: fullDetails.type,
				title: fullDetails.title,
				year: fullDetails.year,
				posterUrl: fullDetails.posterUrl,
				description: fullDetails.description,
				totalEpisodes: fullDetails.totalEpisodes,
				totalSeasons: fullDetails.totalSeasons,
				totalPages: fullDetails.totalPages,
				seasonData: fullDetails.seasonData,
			});
			goto(`/media/${inserted.id}`);
		} finally {
			isUpdating = false;
		}
	}

	/**
	 * Returns per-season episode counts, falling back to uniform distribution
	 * of totalEpisodes across totalSeasons when seasonData lacks episodeCount.
	 */
	function resolvedSeasonCounts(): { seasonNumber: number; episodeCount: number }[] {
		const seasons = media.seasonData ?? [];
		const sorted = [...seasons].sort((a, b) => a.seasonNumber - b.seasonNumber);
		const hasGranular = sorted.some((s) => (s.episodeCount ?? 0) > 0);
		if (hasGranular) {
			return sorted.map((s) => ({ seasonNumber: s.seasonNumber, episodeCount: s.episodeCount ?? 0 }));
		}
		// Fall back: distribute totalEpisodes evenly across totalSeasons
		const total = media.totalEpisodes ?? 0;
		const count = media.totalSeasons ?? sorted.length;
		if (count === 0) return [];
		const base = Math.floor(total / count);
		const remainder = total % count;
		return sorted.length > 0
			? sorted.map((s, i) => ({
					seasonNumber: s.seasonNumber,
					episodeCount: base + (i < remainder ? 1 : 0)
				}))
			: Array.from({ length: count }, (_, i) => ({
					seasonNumber: i + 1,
					episodeCount: base + (i < remainder ? 1 : 0)
				}));
	}

	function firstEpisodeOfSeason(seasonNum: number): number {
		if (seasonNum <= 1) return 1;
		const counts = resolvedSeasonCounts();
		let sum = 0;
		for (const s of counts) {
			if (s.seasonNumber < seasonNum) {
				sum += s.episodeCount;
			}
		}
		return sum + 1;
	}

	function getTvSeasonForAbsoluteEpisode(absoluteEp: number): number {
		if (absoluteEp <= 0) return 1;
		const counts = resolvedSeasonCounts();
		if (counts.length === 0) return 1;
		let sum = 0;
		
		for (const s of counts) {
			sum += s.episodeCount;
			if (absoluteEp <= sum) {
				return s.seasonNumber;
			}
		}
		
		return counts[counts.length - 1].seasonNumber;
	}

	async function handleTvSeasonChange(step: number) {
		if (isUpdating) return;
		const current = tracking.currentSeason || 1;
		const max = media.totalSeasons || 1;
		const next = Math.max(1, Math.min(current + step, max));
		if (next === current) return;

		// Jump to the first episode of the target season (1-indexed absolute).
		// Previously this used getAbsoluteEpisodeStartForSeason which returned the
		// cumulative boundary (= last ep of the previous season), causing the
		// reverse-mapper to snap the season display back to season N-1.
		const targetEp = firstEpisodeOfSeason(next);

		isUpdating = true;
		try {
			await updateProgress(media.id, 'currentEpisode', targetEp);
			await updateProgress(media.id, 'currentSeason', next);
			onUpdate({ ...tracking, currentSeason: next, currentEpisode: targetEp });
		} catch (err) {
			console.error(err);
		} finally {
			isUpdating = false;
		}
	}

	async function handleTvEpisodeChange(newAbsoluteEp: number) {
		if (media.totalEpisodes) newAbsoluteEp = Math.min(newAbsoluteEp, media.totalEpisodes);
		newAbsoluteEp = Math.max(0, newAbsoluteEp);
		
		if (isUpdating || tracking.currentEpisode === newAbsoluteEp) return;
		isUpdating = true;
		try {
			const calculatedSeason = getTvSeasonForAbsoluteEpisode(newAbsoluteEp);
			const seasonChanged = calculatedSeason !== (tracking.currentSeason || 1);

			// Write both fields in parallel then update state once
			const writes: Promise<void>[] = [updateProgress(media.id, 'currentEpisode', newAbsoluteEp)];
			if (seasonChanged) writes.push(updateProgress(media.id, 'currentSeason', calculatedSeason));
			await Promise.all(writes);

			onUpdate({
				...tracking,
				currentEpisode: newAbsoluteEp,
				...(seasonChanged ? { currentSeason: calculatedSeason } : {})
			});
		} catch (err) {
			console.error(err);
		} finally {
			isUpdating = false;
		}
	}
</script>

<div class="bg-[#121422]/80 backdrop-blur-xl rounded-3xl border border-white/[0.08] p-4 sm:p-6 shadow-xl">
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
					<span class="text-slate-300 text-xs font-semibold">Season {media.totalSeasons ? `/ ${media.totalSeasons}` : ''}</span>
					<div class="flex items-center gap-2.5">
						<button class="w-8 h-8 rounded-xl bg-[#1e2238] hover:bg-[#282e4c] text-white font-bold transition-all active:scale-95 cursor-pointer border border-white/[0.06] disabled:opacity-50 disabled:cursor-not-allowed" disabled={(tracking.currentSeason || 1) <= 1} onclick={() => handleTvSeasonChange(-1)}>-</button>
						<input type="text" inputmode="numeric" pattern="[0-9]*" class="w-10 bg-transparent border-b border-transparent focus:border-indigo-500 outline-none text-center font-extrabold text-white text-sm" value={tracking.currentSeason || 1} onchange={(e) => { const val = parseInt(e.currentTarget.value) || 1; handleTvSeasonChange(val - (tracking.currentSeason || 1)); }} />
						<button class="w-8 h-8 rounded-xl bg-[#1e2238] hover:bg-[#282e4c] text-white font-bold transition-all active:scale-95 cursor-pointer border border-white/[0.06] disabled:opacity-50 disabled:cursor-not-allowed" disabled={!!media.totalSeasons && (tracking.currentSeason || 1) >= media.totalSeasons} onclick={() => handleTvSeasonChange(1)}>+</button>
					</div>
				</div>
			{:else if media.type === 'anime' && media.seasonData && media.totalSeasons && media.totalSeasons > 1}
				<div class="flex items-center justify-between p-3 rounded-2xl bg-[#16192b]/60 border border-white/[0.04]">
					<span class="text-slate-300 text-xs font-semibold">Season / Part {media.totalSeasons ? `/ ${media.totalSeasons}` : ''}</span>
					<div class="flex items-center gap-2.5">
						<button class="w-8 h-8 rounded-xl bg-[#1e2238] hover:bg-[#282e4c] text-white font-bold transition-all active:scale-95 cursor-pointer border border-white/[0.06] disabled:opacity-50" disabled={currentAnimeSeason <= 1} onclick={() => changeAnimeSeason(-1)}>-</button>
						<input type="text" inputmode="numeric" pattern="[0-9]*" class="w-10 bg-transparent border-b border-transparent focus:border-indigo-500 outline-none text-center font-extrabold text-white text-sm" value={currentAnimeSeason} onchange={(e) => { const val = parseInt(e.currentTarget.value) || 1; changeAnimeSeason(val - currentAnimeSeason); }} />
						<button class="w-8 h-8 rounded-xl bg-[#1e2238] hover:bg-[#282e4c] text-white font-bold transition-all active:scale-95 cursor-pointer border border-white/[0.06] disabled:opacity-50" disabled={currentAnimeSeason >= media.totalSeasons} onclick={() => changeAnimeSeason(1)}>+</button>
					</div>
				</div>
			{/if}
			<div class="flex items-center justify-between p-3 rounded-2xl bg-[#16192b]/60 border border-white/[0.04]">
				<span class="text-slate-300 text-xs font-semibold">Episode {media.totalEpisodes ? `/ ${media.totalEpisodes}` : ''}</span>
				<div class="flex items-center gap-2.5">
					<button class="w-8 h-8 rounded-xl bg-[#1e2238] hover:bg-[#282e4c] text-white font-bold transition-all active:scale-95 cursor-pointer border border-white/[0.06] disabled:opacity-50 disabled:cursor-not-allowed" disabled={(tracking.currentEpisode || 0) <= 0} onclick={() => handleTvEpisodeChange((tracking.currentEpisode || 0) - 1)}>-</button>
					<input type="text" inputmode="numeric" pattern="[0-9]*" class="w-12 bg-transparent border-b border-transparent focus:border-indigo-500 outline-none text-center font-extrabold text-white text-sm" value={tracking.currentEpisode || 0} onchange={(e) => handleTvEpisodeChange(parseInt(e.currentTarget.value) || 0)} />
					<button class="w-8 h-8 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-md shadow-indigo-600/30 transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" disabled={!!media.totalEpisodes && (tracking.currentEpisode || 0) >= media.totalEpisodes} onclick={() => handleTvEpisodeChange((tracking.currentEpisode || 0) + 1)}>+</button>
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
					<button class="w-8 h-8 rounded-xl bg-[#1e2238] hover:bg-[#282e4c] text-white font-bold transition-all active:scale-95 cursor-pointer border border-white/[0.06] disabled:opacity-50 disabled:cursor-not-allowed" disabled={(tracking.currentIssue || 0) <= 0} onclick={() => decrement('currentIssue')}>-</button>
					<span class="w-8 text-center font-extrabold text-white text-sm">{tracking.currentIssue || 0}</span>
					<button class="w-8 h-8 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-md shadow-indigo-600/30 transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" disabled={!!media.totalEpisodes && (tracking.currentIssue || 0) >= media.totalEpisodes} onclick={() => increment('currentIssue', 1, media.totalEpisodes)}>+</button>
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
						onchange={(e) => {
							let val = parseInt(e.currentTarget.value) || 0;
							if (media.totalPages) val = Math.min(val, media.totalPages);
							val = Math.max(0, val);
							updateField('currentPage', val);
						}}
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
