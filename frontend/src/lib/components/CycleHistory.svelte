<script lang="ts">
	import type { LocalMedia } from '$lib/types/mediaTypes';
	import type { LocalWatchCycle } from '$lib/types/trackingTypes';
	import { updateCycleDates } from '$lib/db/services/cycle.service';

	interface Props {
		media: LocalMedia;
		cycles: LocalWatchCycle[];
	}

	let { media, cycles }: Props = $props();

	function formatDate(dateString?: string) {
		if (!dateString) return '—';
		return new Date(dateString).toLocaleDateString('en-US', { 
			day: 'numeric', month: 'short', year: 'numeric' 
		});
	}

	async function saveDate(cycleId: string, field: 'startedAt' | 'finishedAt', val: string) {
		const iso = val ? new Date(val).toISOString() : undefined;
		const cycle = cycles.find(c => c.id === cycleId);
		if (!cycle) return;
		
		try {
			if (field === 'startedAt') {
				await updateCycleDates(cycleId, iso, cycle.finishedAt);
				cycle.startedAt = iso;
			} else {
				await updateCycleDates(cycleId, cycle.startedAt, iso);
				cycle.finishedAt = iso;
			}
		} catch (err) {
			console.error('Failed to update cycle date', err);
		}
	}
</script>

<div class="bg-[#121422]/80 backdrop-blur-xl rounded-3xl border border-white/[0.08] p-6 shadow-xl">
	<h3 class="text-base font-bold text-white mb-4 flex items-center gap-2">
		<span>🔄</span> Playthrough History
	</h3>
	
	{#if cycles.length === 0}
		<p class="text-xs text-slate-400 bg-[#16192b] p-4 rounded-xl border border-white/[0.06]">No playthrough records yet.</p>
	{:else}
		<div class="overflow-x-auto">
			<table class="w-full text-xs text-left">
				<thead class="text-[10px] text-slate-400 font-bold uppercase tracking-wider bg-[#16192b]/60">
					<tr>
						<th class="px-3.5 py-2.5 rounded-l-xl font-semibold">#</th>
						<th class="px-3.5 py-2.5 font-semibold">Start Date</th>
						<th class="px-3.5 py-2.5 rounded-r-xl font-semibold">Finish Date</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-white/[0.04]">
					{#each [...cycles].reverse() as cycle}
						<tr class="hover:bg-white/[0.02] transition-colors">
							<td class="px-3.5 py-3 text-white font-bold">
								{media.type === 'game' ? 'Playthrough' : media.type === 'film' || media.type === 'tv' || media.type === 'anime' ? 'Rewatch' : 'Reread'} {cycle.cycleNumber}
							</td>
							<td class="px-3.5 py-3">
								<input 
									type="date" 
									class="bg-[#16192b] text-slate-300 px-2.5 py-1 rounded-lg border border-white/[0.08] hover:border-indigo-500/50 focus:border-indigo-500 focus:outline-none cursor-pointer text-xs"
									value={cycle.startedAt ? cycle.startedAt.split('T')[0] : ''}
									onchange={(e) => saveDate(cycle.id, 'startedAt', e.currentTarget.value)}
								/>
							</td>
							<td class="px-3.5 py-3">
								<input 
									type="date" 
									class="bg-[#16192b] text-slate-300 px-2.5 py-1 rounded-lg border border-white/[0.08] hover:border-indigo-500/50 focus:border-indigo-500 focus:outline-none cursor-pointer text-xs"
									value={cycle.finishedAt ? cycle.finishedAt.split('T')[0] : ''}
									onchange={(e) => saveDate(cycle.id, 'finishedAt', e.currentTarget.value)}
								/>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

