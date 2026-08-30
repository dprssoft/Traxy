<script lang="ts">
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import Button from '$lib/components/ui/Button.svelte';
</script>

<div class="space-y-5">
	<SectionHeader
		title="About Traxy"
		subtitle="Your private, local-first media tracker and entertainment organiser."
	/>

	<div
		class="p-6 rounded-2xl bg-gradient-to-br from-[#16192b] to-[#121422] border border-white/[0.08] space-y-4"
	>
		<div class="flex items-center gap-3">
			<div
				class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-indigo-500/20"
			>
				T
			</div>
			<div>
				<h3 class="text-lg font-black text-white">Traxy</h3>
				<p class="text-xs text-indigo-400 font-semibold">Standalone Local-First Edition</p>
			</div>
		</div>

		<p class="text-xs text-slate-300 leading-relaxed">
			Traxy is designed to be completely independent: no centralized server, no user tracking, no
			accounts required. All your data stays private and safe directly on your device.
		</p>

		<div class="flex flex-wrap gap-3 pt-1">
			<Button
				variant="secondary"
				size="sm"
				onclick={() => window.open('https://github.com/dprssoft/Traxy', '_blank')}
			>
				⭐ GitHub Repository
			</Button>
		</div>
	</div>
</div>
