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
		proxy: {
			'/api-proxy/twitch': {
				target: 'https://id.twitch.tv',
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/api-proxy\/twitch/, ''),
			},
			'/api-proxy/igdb': {
				target: 'https://api.igdb.com',
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/api-proxy\/igdb/, ''),
			},
			'/api-proxy/comicvine': {
				target: 'https://comicvine.gamespot.com/api',
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/api-proxy\/comicvine/, ''),
				headers: {
					'User-Agent': 'TraxyApp/1.0',
				},
			},
			'/api-proxy/hltb': {
				target: 'https://howlongtobeat.com',
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/api-proxy\/hltb/, ''),
				headers: {
					'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
					'Referer': 'https://howlongtobeat.com/',
					'Origin': 'https://howlongtobeat.com',
				},
			},
		},
	},
	preview: {
		proxy: {
			'/api-proxy/twitch': {
				target: 'https://id.twitch.tv',
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/api-proxy\/twitch/, ''),
			},
			'/api-proxy/igdb': {
				target: 'https://api.igdb.com',
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/api-proxy\/igdb/, ''),
			},
			'/api-proxy/comicvine': {
				target: 'https://comicvine.gamespot.com/api',
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/api-proxy\/comicvine/, ''),
				headers: {
					'User-Agent': 'TraxyApp/1.0',
				},
			},
			'/api-proxy/hltb': {
				target: 'https://howlongtobeat.com',
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/api-proxy\/hltb/, ''),
				headers: {
					'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
					'Referer': 'https://howlongtobeat.com/',
					'Origin': 'https://howlongtobeat.com',
				},
			},
		},
	},
	optimizeDeps: {
		exclude: ['jeep-sqlite', '@capacitor-community/sqlite', 'sql.js']
	}
});

