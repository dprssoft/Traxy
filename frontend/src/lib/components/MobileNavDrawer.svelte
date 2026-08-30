<script lang="ts">
	import { page } from '$app/stores';
	import { layoutStore, drawerNavItems } from '$lib/stores/layout';
	import { userStore } from '$lib/stores/user.svelte';
	import { onMount } from 'svelte';

	const username = $derived(userStore.value?.username ?? 'Traxy Explorer');
	const profileInitial = $derived(username.charAt(0).toUpperCase());

	const isMirrored = $derived(layoutStore.topbarMirrored);
	const isOpen = $derived(layoutStore.mobileMenuOpen);

	function close() {
		layoutStore.closeMobileMenu();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && isOpen) {
			close();
		}
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeydown);
		return () => window.removeEventListener('keydown', handleKeydown);
	});

	// Close drawer on route change
	$effect(() => {
		// Reading pathname registers dependency
		const _ = $page.url.pathname;
		if (isOpen) {
			close();
		}
	});

	// Lock body scroll when drawer is open
	$effect(() => {
		if (typeof document !== 'undefined') {
			if (isOpen) {
				document.body.style.overflow = 'hidden';
			} else {
				document.body.style.overflow = '';
			}
		}
		return () => {
			if (typeof document !== 'undefined') {
				document.body.style.overflow = '';
			}
		};
	});
</script>

{#if isOpen}
	<div class="fixed inset-0 z-50 md:hidden flex" role="dialog" aria-modal="true" aria-label="Navigation Drawer">
		<!-- Backdrop overlay -->
		<button
			type="button"
			class="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity cursor-default"
			onclick={close}
			aria-label="Close navigation drawer"
		></button>

		<!-- Slide-out Drawer Panel -->
		<aside
			class="relative flex flex-col w-72 max-w-[85vw] h-full bg-[#0d0e18]/95 backdrop-blur-2xl border-white/[0.08] shadow-2xl z-10 transition-transform duration-300 ease-out overflow-y-auto
				{isMirrored 
					? 'ml-auto border-l animate-slide-in-right' 
					: 'mr-auto border-r animate-slide-in-left'}"
		>
			<!-- Top: User profile block (from wireframe) -->
			<div class="p-5 pb-4 border-b border-white/[0.08] flex items-center justify-between gap-3">
				<div class="flex items-center gap-3 min-w-0">
					<!-- Avatar square from wireframe -->
					<div class="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-indigo-500/25 shrink-0 border border-white/[0.1]">
						{profileInitial}
					</div>
					<div class="min-w-0">
						<h3 class="font-bold text-white text-base truncate tracking-tight">{username}</h3>
						<p class="text-[11px] text-indigo-400 font-medium flex items-center gap-1">
							<span class="w-1.5 h-1.5 rounded-full bg-indigo-400"></span> Local Profile
						</p>
					</div>
				</div>

				<!-- Close button -->
				<button
					type="button"
					onclick={close}
					class="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
					aria-label="Close drawer"
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<line x1="18" y1="6" x2="6" y2="18"></line>
						<line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				</button>
			</div>

			<!-- Main Navigation Items (from wireframe) -->
			<nav class="p-3 space-y-1 flex-1">
				{#each drawerNavItems.filter((i) => i.href !== '/settings/about') as item}
					{@const isActive = item.match($page.url.pathname)}
					<a
						href={item.href}
						class="flex items-center justify-between px-3.5 py-3 rounded-2xl font-semibold text-sm transition-all duration-200 group
							{isActive 
								? 'text-white bg-gradient-to-r from-indigo-600/25 to-purple-600/15 border border-indigo-500/35 shadow-md shadow-indigo-500/10' 
								: 'text-slate-300 hover:text-white hover:bg-white/[0.05] border border-transparent'}"
					>
						<div class="flex items-center gap-3.5">
							<!-- Square icon wrapper matching wireframe's rounded squares -->
							<div class="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200
								{isActive 
									? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30' 
									: 'bg-white/[0.04] text-slate-400 group-hover:text-indigo-400 group-hover:bg-white/[0.08]'}"
							>
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d={item.icon} />
								</svg>
							</div>
							<span class="tracking-tight">{item.label}</span>
						</div>

						{#if item.badge}
							<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
								{item.badge}
							</span>
						{/if}
					</a>
				{/each}
			</nav>

			<!-- Bottom Section: About & Layout Mirror Toggle -->
			<div class="p-4 border-t border-white/[0.08] space-y-3 bg-[#090a12]/60">
				<!-- About link from wireframe bottom -->
				<a
					href="/settings/about"
					class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors text-xs font-semibold"
				>
					<div class="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center text-slate-400">
						<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
					</div>
					<span>About Traxy</span>
				</a>

				<!-- Mirror Topbar Quick Toggle with hint -->
				<div class="p-3 rounded-2xl bg-[#141727]/70 border border-white/[0.06] space-y-2">
					<div class="flex items-center justify-between text-xs">
						<span class="font-bold text-white flex items-center gap-1.5">
							<span>⇄</span> Mirror Top Bar
						</span>
						<button
							type="button"
							onclick={layoutStore.toggleTopbarMirror}
							class="px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer
								{isMirrored 
									? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30' 
									: 'bg-white/[0.08] text-slate-300 hover:bg-white/[0.12]'}"
						>
							{isMirrored ? 'Right' : 'Left'}
						</button>
					</div>
					<p class="text-[10px] text-slate-400 leading-tight">
						Tip: <span class="text-indigo-300 font-semibold">Hold and drag</span> the top icon across the screen to mirror!
					</p>
				</div>
			</div>
		</aside>
	</div>
{/if}

<style>
	@keyframes slideInLeft {
		from {
			transform: translateX(-100%);
		}
		to {
			transform: translateX(0);
		}
	}

	@keyframes slideInRight {
		from {
			transform: translateX(100%);
		}
		to {
			transform: translateX(0);
		}
	}

	.animate-slide-in-left {
		animation: slideInLeft 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
	}

	.animate-slide-in-right {
		animation: slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
	}
</style>
