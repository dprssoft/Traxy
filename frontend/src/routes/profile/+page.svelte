<script lang="ts">
	import { userStore } from '$lib/stores/user.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';

	let usernameInput = $state(userStore.value?.username ?? 'Traxy Explorer');
	let saved = $state(false);

	function saveProfile() {
		userStore.set({
			username: usernameInput,
			email: userStore.value?.email ?? 'local@traxy.app',
			role: userStore.value?.role ?? 'USER',
			memberSinceYear: userStore.value?.memberSinceYear ?? 2026
		});
		saved = true;
		setTimeout(() => (saved = false), 2500);
	}
</script>

<svelte:head>
	<title>Profile · Traxy</title>
</svelte:head>

<div class="max-w-2xl mx-auto space-y-6">
	<SectionHeader
		title="User Profile"
		subtitle="Manage your local profile identity and preferences."
	/>

	<!-- Profile Card (Wireframe Top section) -->
	<div class="p-6 rounded-3xl bg-[#121422]/90 border border-white/[0.08] backdrop-blur-xl shadow-2xl space-y-6">
		<div class="flex items-center gap-4">
			<div class="w-16 h-16 rounded-3xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-indigo-500/25 border border-white/[0.1]">
				{usernameInput.charAt(0).toUpperCase()}
			</div>
			<div>
				<h2 class="text-xl font-bold text-white tracking-tight">{usernameInput}</h2>
				<div class="flex items-center gap-2 mt-1">
					<Badge variant="indigo" dot>Local-First Profile</Badge>
					<span class="text-xs text-slate-500">Offline ready</span>
				</div>
			</div>
		</div>

		<div class="border-t border-white/[0.06] pt-5 space-y-4">
			<div>
				<label for="username" class="block text-xs font-semibold text-slate-400 mb-1.5">
					Display Name
				</label>
				<input
					id="username"
					type="text"
					bind:value={usernameInput}
					class="w-full bg-[#0a0b12] border border-white/[0.1] rounded-xl p-3 text-white text-sm focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-colors"
					placeholder="Enter your nickname"
				/>
			</div>

			<div class="flex items-center gap-3 pt-2">
				<Button onclick={saveProfile}>Save Changes</Button>
				{#if saved}
					<span class="text-emerald-400 text-xs font-bold flex items-center gap-1">
						<span>✓</span> Saved!
					</span>
				{/if}
			</div>
		</div>
	</div>
</div>
