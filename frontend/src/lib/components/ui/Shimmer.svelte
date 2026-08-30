<script lang="ts">
	interface Props {
		class?: string;
	}
	let { class: cls = '' }: Props = $props();
</script>

<div class="tl-shimmer rounded-xl {cls}"></div>

<style>
	.tl-shimmer {
		background: linear-gradient(90deg, #1a1d2e 25%, #242840 50%, #1a1d2e 75%);
		background-size: 200% 100%;
		animation: tl-shimmer 1.5s infinite;
	}
	@keyframes tl-shimmer {
		0% {
			background-position: -200% 0;
		}
		100% {
			background-position: 200% 0;
		}
	}
</style>
