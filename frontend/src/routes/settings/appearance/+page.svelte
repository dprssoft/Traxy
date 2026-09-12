<script lang="ts">
	import { onMount } from 'svelte';
	import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Toggle from '$lib/components/ui/Toggle.svelte';
	import { getAppSettingBool, setAppSettingBool } from '$lib/db/services/settings.service';

	let showCountryFlags = $state(false);

	onMount(async () => {
		try {
			showCountryFlags = await getAppSettingBool('ui_country_flags', false);
		} catch {}
	});

	async function toggleFlags(enabled: boolean) {
		showCountryFlags = enabled;
		await setAppSettingBool('ui_country_flags', enabled);
	}
</script>

<div class="space-y-5">
	<SectionHeader
		title="Appearance & UI"
		subtitle="Customize your visual experience, language, and display settings."
	/>

	<!-- Theme -->
	<div class="p-5 rounded-2xl bg-[#16192b]/60 border border-white/[0.06] space-y-3">
		<div class="flex items-center justify-between">
			<div>
				<h3 class="font-bold text-white text-sm">Theme Mode</h3>
				<p class="text-xs text-slate-400 mt-0.5">Deep Obsidian Dark with Electric Indigo accents</p>
			</div>
			<Badge variant="indigo">Active</Badge>
		</div>
		<p class="text-xs text-slate-500 italic">
			Additional themes (AMOLED, Light) coming soon.
		</p>
	</div>

	<!-- Flags Toggle -->
	<div class="p-5 rounded-2xl bg-[#16192b]/60 border border-white/[0.06] flex items-center justify-between gap-4">
		<div class="min-w-0">
			<label for="flag-toggle" class="text-sm font-bold text-white cursor-pointer">Country Flags</label>
			<p class="text-xs text-slate-400 mt-0.5">Display country of origin as a flag emoji instead of text.</p>
		</div>
		<Toggle id="flag-toggle" checked={showCountryFlags} onchange={toggleFlags} label="Country Flags" />
	</div>

	<!-- Storage Engine -->
	<div class="p-5 rounded-2xl bg-[#16192b]/60 border border-white/[0.06] space-y-2">
		<h3 class="font-bold text-white text-sm">Storage Engine</h3>
		<p class="text-xs text-slate-400">
			Using Capacitor SQLite persistent storage on mobile devices and browser IndexedDB/LocalStorage
			for local development.
		</p>
	</div>
</div>
