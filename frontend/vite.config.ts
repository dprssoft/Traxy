/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	envDir: '..',
	plugins: [tailwindcss(), sveltekit()],
	test: {
		include: ['src/**/*.test.ts'],
		environment: 'jsdom',
	},
	// Only override resolve conditions under Vitest, so component tests pick the
	// browser build of Svelte. Setting `conditions` unconditionally would clobber
	// Vite's defaults and make `$app/paths` resolve to its server entry point,
	// which drags hooks.server.ts into the client bundle and fails the build.
	resolve: process.env.VITEST ? { conditions: ['browser'] } : {},
	server: {
		headers: {
			// Required for sql.js (jeep-sqlite) to use SharedArrayBuffer in the WASM worker
			'Cross-Origin-Opener-Policy': 'same-origin',
			'Cross-Origin-Embedder-Policy': 'require-corp',
		},
	},
	optimizeDeps: {
		exclude: ['jeep-sqlite', '@capacitor-community/sqlite', 'sql.js']
	}
});

