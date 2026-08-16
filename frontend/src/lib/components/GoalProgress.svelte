<script lang="ts">
	import { goalStore } from '$lib/stores/goal.svelte';
	import type { TrackingListItem } from '$lib/types/trackingTypes';
	import { getMediaTypeGroup } from '$lib/constants';

	interface Props {
		trackingList: TrackingListItem[];
	}

	let { trackingList }: Props = $props();

	const currentYear = new Date().getFullYear();

	// Calculate completions for the current year.
	// Since we don't have a reliable completedAt date in trackingList directly (it's in cycles),
	// we'll approximate by checking if status === 'completed' and updatedAt is in current year.
	// A better way would be reading from CycleHistory, but this works for local tracking.
	
	const completions = $derived.by(() => {
		const res = { watch: 0, game: 0, read: 0 };
		for (const item of trackingList) {
			if (item.tracking.status === 'completed') {
				const updatedYear = new Date(item.tracking.updatedAt).getFullYear();
				if (updatedYear === currentYear) {
					const group = getMediaTypeGroup(item.media.type);
					if (group === 'watch') res.watch++;
					else if (group === 'game') res.game++;
					else if (group === 'read') res.read++;
				}
			}
		}
		return res;
	});

	const goals = $derived(goalStore.current);

	const watchProgress = $derived(goals.watchCount > 0 ? (completions.watch / goals.watchCount) * 100 : 0);
	const gameProgress = $derived(goals.gameCount > 0 ? (completions.game / goals.gameCount) * 100 : 0);
	const readProgress = $derived(goals.readCount > 0 ? (completions.read / goals.readCount) * 100 : 0);
</script>

<div class="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
	<div class="flex items-center justify-between mb-6">
		<h3 class="text-white font-bold">Goals for {currentYear} year</h3>
		<a href="/settings" class="text-sm text-gray-400 hover:text-white transition-colors">Configure ⚙️</a>
	</div>

	<div class="space-y-6">
		<!-- Watch Goal -->
		<div>
			<div class="flex items-center justify-between text-sm mb-2">
				<span class="text-gray-300">Rewatch (Фільми, Серіали, Аніме)</span>
				<span class="font-medium {completions.watch >= goals.watchCount ? 'text-green-400' : 'text-white'}">
					{completions.watch} / {goals.watchCount}
				</span>
			</div>
			<div class="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
				<div 
					class="bg-blue-500 h-2 rounded-full transition-all duration-1000" 
					style="width: {Math.min(watchProgress, 100)}%;"
				></div>
			</div>
		</div>

		<!-- Game Goal -->
		<div>
			<div class="flex items-center justify-between text-sm mb-2">
				<span class="text-gray-300">Games</span>
				<span class="font-medium {completions.game >= goals.gameCount ? 'text-green-400' : 'text-white'}">
					{completions.game} / {goals.gameCount}
				</span>
			</div>
			<div class="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
				<div 
					class="bg-green-500 h-2 rounded-full transition-all duration-1000" 
					style="width: {Math.min(gameProgress, 100)}%;"
				></div>
			</div>
		</div>

		<!-- Read Goal -->
		<div>
			<div class="flex items-center justify-between text-sm mb-2">
				<span class="text-gray-300">Читання (Книги, Манга, Комікси)</span>
				<span class="font-medium {completions.read >= goals.readCount ? 'text-green-400' : 'text-white'}">
					{completions.read} / {goals.readCount}
				</span>
			</div>
			<div class="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
				<div 
					class="bg-yellow-500 h-2 rounded-full transition-all duration-1000" 
					style="width: {Math.min(readProgress, 100)}%;"
				></div>
			</div>
		</div>
	</div>
</div>
