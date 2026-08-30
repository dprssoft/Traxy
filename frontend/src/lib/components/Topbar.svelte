<script lang="ts">
	import Searchbar from './Searchbar.svelte';
	import { page } from '$app/stores';
	import { layoutStore } from '$lib/stores/layout';
	import { onMount } from 'svelte';

	const titleMap: Record<string, string> = {
		'/': 'Activity Feed',
		'/tracking': 'Tracking',
		'/collections': 'Lists',
		'/catalogue': 'Catalogue',
		'/stats': 'Statistics',
		'/settings': 'Settings',
		'/search': 'Search'
	};

	const currentTitle = $derived.by(() => {
		const path = $page.url.pathname;
		if (path.startsWith('/media/')) return 'Media Details';
		if (path.startsWith('/collections/')) return 'Collection Details';
		if (path.startsWith('/settings/')) return 'Settings';
		return titleMap[path] ?? 'Traxy';
	});

	const isMirrored = $derived(layoutStore.topbarMirrored);

	let isDesktop = $state(false);

	onMount(() => {
		const mq = window.matchMedia('(min-width: 768px)');
		isDesktop = mq.matches;
		const handleMediaChange = (e: MediaQueryListEvent) => {
			isDesktop = e.matches;
		};
		mq.addEventListener('change', handleMediaChange);

		return () => {
			mq.removeEventListener('change', handleMediaChange);
		};
	});

	// Gesture state for Long Hold & Drag to Mirror (Desktop mouse only)
	let isPressing = $state(false);
	let isDragging = $state(false);
	let isOverDropZone = $state(false);

	let topbarEl: HTMLElement | null = null;
	let holdTimer: ReturnType<typeof setTimeout> | null = null;
	let startPointerX = 0;
	let dragOffsetX = $state(0);
	let didDrag = false;

	function handlePointerDown(e: PointerEvent) {
		// Only enable drag gesture on desktop with primary mouse button (touch devices use direct tap)
		if (!isDesktop || e.pointerType === 'touch' || e.button !== 0) return;

		isPressing = true;
		didDrag = false;
		isOverDropZone = false;
		startPointerX = e.clientX;
		dragOffsetX = 0;

		// 400ms threshold for desktop mouse drag
		holdTimer = setTimeout(() => {
			isDragging = true;
			didDrag = true;
			isPressing = false;

			const target = e.currentTarget as HTMLElement;
			if (target?.setPointerCapture) {
				try {
					target.setPointerCapture(e.pointerId);
				} catch {}
			}
		}, 400);
	}

	function handlePointerMove(e: PointerEvent) {
		if (!isDragging) return;

		dragOffsetX = e.clientX - startPointerX;

		if (topbarEl) {
			const rect = topbarEl.getBoundingClientRect();
			const midX = rect.left + rect.width / 2;

			if (!isMirrored) {
				isOverDropZone = e.clientX > midX;
			} else {
				isOverDropZone = e.clientX < midX;
			}
		}
	}

	function handlePointerUp(e: PointerEvent) {
		if (holdTimer) {
			clearTimeout(holdTimer);
			holdTimer = null;
		}

		if (isDragging) {
			if (isOverDropZone || Math.abs(dragOffsetX) > 90) {
				layoutStore.toggleTopbarMirror();
				try {
					if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
						navigator.vibrate(50);
					}
				} catch {}
			}
			isDragging = false;
			isOverDropZone = false;
			dragOffsetX = 0;
			// Keep didDrag true briefly so click isn't triggered after dragging
			setTimeout(() => {
				didDrag = false;
			}, 200);
		}

		isPressing = false;
	}

	function handlePointerCancel() {
		if (holdTimer) {
			clearTimeout(holdTimer);
			holdTimer = null;
		}
		isPressing = false;
		isDragging = false;
		isOverDropZone = false;
		dragOffsetX = 0;
	}

	function handleClick(e: MouseEvent) {
		if (didDrag || isDragging) return;

		if (isDesktop) {
			layoutStore.toggleSidebar();
		} else {
			layoutStore.toggleMobileMenu();
		}
	}

	function directMirrorDrop() {
		if (isDragging) {
			layoutStore.toggleTopbarMirror();
			isDragging = false;
			isOverDropZone = false;
			isPressing = false;
			dragOffsetX = 0;
		}
	}
</script>

<header
	bind:this={topbarEl}
	class="sticky top-0 z-30 flex items-center justify-between gap-2.5 sm:gap-4 px-3.5 sm:px-8 py-2.5 sm:py-3 bg-[#0a0b12]/90 backdrop-blur-xl border-b border-white/[0.06] transition-all duration-300 select-none
		{isMirrored ? 'flex-row-reverse' : 'flex-row'}"
>
	<!-- Top Bar Action / Menu Icon (The Draggable Top-Left/Right Icon from wireframe) -->
	<div class="relative flex items-center gap-2.5 shrink-0 z-10">
		<!-- The Icon Button from wireframe: instant touch tap on mobile, hold+drag on desktop -->
		<button
			type="button"
			onpointerdown={handlePointerDown}
			onpointermove={handlePointerMove}
			onpointerup={handlePointerUp}
			onpointercancel={handlePointerCancel}
			onclick={handleClick}
			class="relative flex items-center justify-center w-10 h-10 rounded-2xl transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/40 touch-manipulation select-none active:scale-95
				{isDragging 
					? 'scale-115 ring-2 ring-indigo-400 bg-gradient-to-tr from-indigo-500 to-purple-500 shadow-xl shadow-indigo-500/50 z-50 cursor-grab active:cursor-grabbing' 
					: isPressing 
						? 'scale-95 bg-indigo-700/60 ring-2 ring-indigo-500/50' 
						: 'bg-[#141727] hover:bg-[#1c2138] border border-white/[0.08] text-white shadow-md shadow-black/30'}"
			style={isDragging ? `transform: translateX(${dragOffsetX * 0.4}px) scale(1.15);` : ''}
			aria-label="Navigation menu"
			title={isDesktop ? 'Toggle sidebar' : 'Open navigation menu'}
		>
			<!-- Icon visuals: 4-square grid / launcher icon matching wireframe square icon -->
			<div class="w-5 h-5 flex flex-col justify-center gap-1">
				<div class="flex items-center justify-between gap-1">
					<span class="w-2 h-2 rounded-[4px] bg-gradient-to-br from-indigo-400 to-purple-400"></span>
					<span class="w-2 h-2 rounded-[4px] bg-white/80"></span>
				</div>
				<div class="flex items-center justify-between gap-1">
					<span class="w-2 h-2 rounded-[4px] bg-white/80"></span>
					<span class="w-2 h-2 rounded-[4px] bg-gradient-to-br from-purple-400 to-pink-400"></span>
				</div>
			</div>

			<!-- Press-and-hold progress ring indicator -->
			{#if isPressing}
				<div class="absolute inset-0 rounded-2xl border-2 border-indigo-400 animate-ping opacity-60 pointer-events-none"></div>
			{/if}
		</button>

		<!-- Desktop Breadcrumb / Title Context -->
		<div class="hidden md:flex items-center gap-2">
			<h1 class="text-base font-bold text-white/95 tracking-tight">{currentTitle}</h1>
		</div>
	</div>

	<!-- Opposite Drop Zone (Appears when dragging to show where to drop) -->
	{#if isDragging}
		<!-- Target drop zone on opposite side -->
		<button
			type="button"
			onclick={directMirrorDrop}
			class="flex items-center justify-center gap-2 px-3 sm:px-4 h-10 rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer animate-pulse shrink-0
				{isOverDropZone 
					? 'bg-indigo-500/25 border-indigo-400 text-indigo-200 scale-105 shadow-xl shadow-indigo-500/20' 
					: 'bg-white/[0.04] border-white/20 text-slate-400 hover:border-indigo-400/50'}"
		>
			<svg class="w-4 h-4 animate-spin-slow shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
			</svg>
			<span class="text-xs font-bold whitespace-nowrap">
				{isOverDropZone ? 'Release to Mirror!' : 'Drop Here'}
			</span>
		</button>
	{/if}

	<!-- Right / Left: Integrated Searchbar (Wide bar from wireframe) -->
	<div class="flex-1 min-w-0 {isDragging ? 'max-w-[150px] sm:max-w-xs' : 'max-w-md'} {isMirrored ? 'mr-auto' : 'ml-auto'} transition-all">
		<Searchbar />
	</div>
</header>
