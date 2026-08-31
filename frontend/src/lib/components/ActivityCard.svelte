<script lang="ts">
	import type { FeedItem } from '$lib/types/activityTypes';
	import FeedEntry from '$lib/components/FeedEntry.svelte';

	interface Props {
		activity: FeedItem;
	}
	let { activity }: Props = $props();
</script>

<FeedEntry {activity} />
