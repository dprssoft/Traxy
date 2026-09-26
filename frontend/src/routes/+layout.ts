import { browser } from '$app/environment';
import { Capacitor } from '@capacitor/core';
import { initDb } from '$lib/db';
import {
	getBottomNavPrefs,
	getContentFilterPrefs,
	getMergeAnimeSeasonsEnabled,
} from '$lib/db/services/settings.service';
import {
	isAnimeMergePending,
	mergeAnimeSeasonsInLibrary,
} from '$lib/db/services/animeSeries.service';

// Client-side layout load — no auth, no cookies.
// SSR is disabled (adapter-static, ssr: false), so this runs only in the browser.
export const ssr = false;
export const prerender = false;

async function initJeepSqliteWeb(): Promise<void> {
	const { defineCustomElements } = await import('jeep-sqlite/loader');
	defineCustomElements(window);

	// Wait for the custom element to be defined
	await customElements.whenDefined('jeep-sqlite');

	// Append the element to the DOM if not already present
	if (!document.querySelector('jeep-sqlite')) {
		const el = document.createElement('jeep-sqlite');
		document.body.appendChild(el);
	}

	// Give the element a tick to initialize its internal state
	await new Promise<void>((resolve) => setTimeout(resolve, 100));
}

/** Finish an anime season merge that skipped series last time, in the background. */
function retryPendingAnimeMerge(): void {
	isAnimeMergePending()
		.then((pending) => (pending ? mergeAnimeSeasonsInLibrary() : undefined))
		.catch((err) => console.error('Anime merge retry failed', err));
}

export const load = async () => {
	if (browser) {
		if (Capacitor.getPlatform() === 'web') {
			await initJeepSqliteWeb();
		}
		await initDb();
		const mergeAnimeSeasons = await getMergeAnimeSeasonsEnabled().catch(() => false);
		if (mergeAnimeSeasons) retryPendingAnimeMerge();
		return {
			bottomNav: await getBottomNavPrefs().catch(() => null),
			contentFilter: await getContentFilterPrefs().catch(() => null),
			mergeAnimeSeasons,
		};
	}
	return { bottomNav: null, contentFilter: null, mergeAnimeSeasons: false };
};