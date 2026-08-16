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

<div class="bg-gray-800/50 rounded-xl border border-gray-700 p-4">
	<h3 class="text-lg font-bold text-white mb-4">Playthrough history</h3>
	
	{#if cycles.length === 0}
		<p class="text-sm text-gray-400">Ще немає записів про проходження.</p>
	{:else}
		<div class="overflow-x-auto">
			<table class="w-full text-sm text-left">
				<thead class="text-xs text-gray-400 uppercase bg-gray-800/50">
					<tr>
						<th class="px-3 py-2 font-medium">#</th>
						<th class="px-3 py-2 font-medium">Start</th>
						<th class="px-3 py-2 font-medium">End</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-700">
					{#each [...cycles].reverse() as cycle}
						<tr class="hover:bg-gray-800/30">
							<td class="px-3 py-2 text-white font-medium">
								{media.type === 'game' ? 'Playthrough' : media.type === 'film' || media.type === 'tv' || media.type === 'anime' ? 'Rewatch' : 'Reread'} {cycle.cycleNumber}
							</td>
							<td class="px-3 py-2">
								<input 
									type="date" 
									class="bg-transparent text-gray-300 border-b border-transparent hover:border-gray-600 focus:border-brand-accent focus:outline-none cursor-pointer"
									value={cycle.startedAt ? cycle.startedAt.split('T')[0] : ''}
									onchange={(e) => saveDate(cycle.id, 'startedAt', e.currentTarget.value)}
								/>
							</td>
							<td class="px-3 py-2">
								<input 
									type="date" 
									class="bg-transparent text-gray-300 border-b border-transparent hover:border-gray-600 focus:border-brand-accent focus:outline-none cursor-pointer"
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
