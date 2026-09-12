<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		text: string;
		class?: string;
		title?: string;
	}
	let { text, class: className = '', title }: Props = $props();

	let containerNode: HTMLElement | undefined = $state();
	let textNode: HTMLElement | undefined = $state();
	
	let isOverflowing = $state(false);
	let overflowAmount = $state(0);
	
	// How long a full loop (left and back) takes in seconds
	// We scale it based on how much it needs to scroll so it's not too fast
	let animationDuration = $state(8);

	onMount(() => {
		const checkOverflow = () => {
			if (containerNode && textNode) {
				const cw = containerNode.clientWidth;
				const sw = textNode.scrollWidth;
				if (sw > cw) {
					isOverflowing = true;
					overflowAmount = sw - cw;
					// Roughly 30px per second of scroll, min 6s, max 15s for the round trip
					const speed = Math.max(6, Math.min(15, (overflowAmount / 30) * 2));
					animationDuration = speed;
				} else {
					isOverflowing = false;
					overflowAmount = 0;
				}
			}
		};
		
		// Use ResizeObserver for accurate container resizing detection
		const observer = new ResizeObserver(checkOverflow);
		if (containerNode) observer.observe(containerNode);
		
		// Initial check
		setTimeout(checkOverflow, 100);
		
		return () => {
			observer.disconnect();
		};
	});
</script>

<div bind:this={containerNode} class="relative overflow-hidden w-full {className}" {title}>
	<div 
		bind:this={textNode}
		class="whitespace-nowrap inline-block"
		class:animate-marquee={isOverflowing}
		class:truncate={!isOverflowing}
		style={isOverflowing ? `--overflow: -${overflowAmount}px; --duration: ${animationDuration}s;` : ''}
	>
		{text}
	</div>
</div>

<style>
	@keyframes marquee-ping-pong {
		0%, 15% { transform: translateX(0); }
		45%, 55% { transform: translateX(var(--overflow)); }
		85%, 100% { transform: translateX(0); }
	}
	
	.animate-marquee {
		/* Start after 3s delay once loaded */
		animation: marquee-ping-pong var(--duration) ease-in-out infinite;
		animation-delay: 3s;
		animation-fill-mode: both;
		/* Improve text rendering during transform */
		will-change: transform;
	}
</style>
