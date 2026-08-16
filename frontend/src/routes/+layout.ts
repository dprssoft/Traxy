import { browser } from '$app/environment';
import { Capacitor } from '@capacitor/core';
import { initDb } from '$lib/db';

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

export const load = async () => {
	if (browser) {
		if (Capacitor.getPlatform() === 'web') {
			await initJeepSqliteWeb();
		}
		await initDb();
	}
	return {};
};