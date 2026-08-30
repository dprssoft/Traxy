<script lang="ts">
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Card from '$lib/components/ui/Card.svelte';

	interface Achievement {
		id: string;
		title: string;
		desc: string;
		icon: string;
		unlocked: boolean;
		progress: number;
		max: number;
		reward: string;
	}

	const achievements: Achievement[] = [
		{
			id: 'first_track',
			title: 'First Step',
			desc: 'Log your very first movie, game, book, or show.',
			icon: '🎬',
			unlocked: true,
			progress: 1,
			max: 1,
			reward: '+50 XP'
		},
		{
			id: 'cinephile',
			title: 'Cinephile in Training',
			desc: 'Complete 10 movies in your library.',
			icon: '🍿',
			unlocked: false,
			progress: 3,
			max: 10,
			reward: 'Silver Badge'
		},
		{
			id: 'bookworm',
			title: 'Avid Reader',
			desc: 'Track 5 books or manga series to completion.',
			icon: '📚',
			unlocked: false,
			progress: 1,
			max: 5,
			reward: 'Bookworm Title'
		},
		{
			id: 'gamer',
			title: 'Level Up',
			desc: 'Mark 3 video games as Completed.',
			icon: '🎮',
			unlocked: false,
			progress: 2,
			max: 3,
			reward: 'Gold Badge'
		},
		{
			id: 'mirror_master',
			title: 'Ergonomic Master',
			desc: 'Mirror the top bar using the long-press drag gesture.',
			icon: '⇄',
			unlocked: true,
			progress: 1,
			max: 1,
			reward: 'Layout Pioneer'
		}
	];

	const unlockedCount = $derived(achievements.filter((a) => a.unlocked).length);
</script>

<svelte:head>
	<title>Achievements · Traxy</title>
</svelte:head>

<div class="max-w-4xl mx-auto space-y-6">
	<SectionHeader
		title="Achievements & Milestones"
		subtitle="Unlock badges and track personal milestones as you log entertainment media."
	>
		{#snippet actions()}
			<Badge variant="indigo">
				{unlockedCount} / {achievements.length} Unlocked
			</Badge>
		{/snippet}
	</SectionHeader>

	<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
		{#each achievements as a}
			<div
				class="p-5 rounded-2xl border transition-all duration-200 flex items-start gap-4
					{a.unlocked 
						? 'bg-[#141727]/90 border-indigo-500/30 shadow-lg shadow-indigo-500/5' 
						: 'bg-[#10121d]/60 border-white/[0.05] opacity-75'}"
			>
				<div
					class="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 border
						{a.unlocked 
							? 'bg-gradient-to-tr from-indigo-600/30 to-purple-600/30 border-indigo-500/40' 
							: 'bg-white/[0.03] border-white/[0.06] grayscale'}"
				>
					{a.icon}
				</div>

				<div class="flex-1 min-w-0 space-y-2">
					<div class="flex items-center justify-between gap-2">
						<h3 class="font-bold text-white text-sm truncate">{a.title}</h3>
						{#if a.unlocked}
							<Badge variant="emerald" size="sm">Completed</Badge>
						{:else}
							<span class="text-[10px] text-slate-500 font-semibold">{a.progress}/{a.max}</span>
						{/if}
					</div>

					<p class="text-xs text-slate-400 leading-relaxed">{a.desc}</p>

					<!-- Progress bar -->
					<div class="w-full bg-[#0a0b12] rounded-full h-1.5 overflow-hidden border border-white/[0.04]">
						<div
							class="h-full rounded-full transition-all duration-300
								{a.unlocked ? 'bg-gradient-to-r from-indigo-500 to-purple-500' : 'bg-slate-600'}"
							style="width: {Math.min(100, (a.progress / a.max) * 100)}%;"
						></div>
					</div>
				</div>
			</div>
		{/each}
	</div>
</div>
