import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from 'vite-plugin-pwa';
import { compression } from 'vite-plugin-compression2';

export default defineConfig(({ mode }) => {
	// Load environment variables
	const env = loadEnv(mode, process.cwd(), '');
	const apiUrl = env.VITE_API_URL || 'http://localhost:5000';
	const cloudinaryName = env.REACT_APP_CLOUDINARY_CLOUD_NAME || 'djqq8kba8';
	const cloudinaryPreset = env.REACT_APP_CLOUDINARY_UPLOAD_PRESET || 'spotify_clone';
	const cloudinaryKey = env.REACT_APP_CLOUDINARY_API_KEY || '';
	const cloudinarySecret = env.REACT_APP_CLOUDINARY_API_SECRET || '';
	
	return {
		plugins: [
			react(),
			VitePWA({
				registerType: 'prompt',
				injectRegister: 'inline',
				includeAssets: ['mavrixfy.png', 'apple-touch-icon.png', 'mavrixfy-icons/*.png'],
				workbox: {
					globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,avif}'],
					globIgnores: ['**/*.{mp3,mp4,m4a,aac,ogg,wav,flac}', '**/firebase-messaging-sw.js'],
					cleanupOutdatedCaches: true,
					importScripts: ['/firebase-messaging-sw.js'],
					runtimeCaching: [
						{
							urlPattern: /^https:\/\/res\.cloudinary\.com\/.*/i,
							handler: 'CacheFirst',
							options: {
								cacheName: 'cloudinary-images',
								expiration: {
									maxEntries: 100,
									maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
								},
							},
						},
						// Audio — never cache, always stream fresh
						{
							urlPattern: /\.(mp3|mp4|m4a|aac|ogg|wav|flac)(\?.*)?$/i,
							handler: 'NetworkOnly',
						},
						{
							urlPattern: /^https:\/\/(aac|cdnx?)\.saavncdn\.com\/.*/i,
							handler: 'NetworkOnly',
						},
						{
							urlPattern: /saavn\.me\/.*/i,
							handler: 'NetworkOnly',
						},
					],
				},
				manifest: {
					name: 'Mavrixfy',
					short_name: 'Mavrixfy',
					description: 'Discover, listen to, and organize music you love',
					theme_color: '#000000',
					background_color: '#000000',
					display: 'standalone',
					orientation: 'portrait',
					scope: '/',
					start_url: '/?source=pwa',
					lang: 'en',
					categories: ['music', 'entertainment'],
					icons: [
						{
							src: '/mavrixfy-icons/mavrixfy-icon-maskable-192.png',
							sizes: '192x192',
							type: 'image/png',
							purpose: 'any',
						},
						{
							src: '/mavrixfy-icons/mavrixfy-icon-maskable-512.png',
							sizes: '512x512',
							type: 'image/png',
							purpose: 'any',
						},
						{
							src: '/mavrixfy-icons/mavrixfy-icon-maskable-192.png',
							sizes: '192x192',
							type: 'image/png',
							purpose: 'maskable',
						},
						{
							src: '/mavrixfy-icons/mavrixfy-icon-maskable-512.png',
							sizes: '512x512',
							type: 'image/png',
							purpose: 'maskable',
						},
					],
					shortcuts: [
						{
							name: 'Liked Songs',
							short_name: 'Liked',
							description: 'View your liked songs',
							url: '/liked-songs',
							icons: [{ src: '/shortcut-liked-96.png', sizes: '96x96' }],
						},
						{
							name: 'Search',
							short_name: 'Search',
							description: 'Search for music',
							url: '/search',
							icons: [{ src: '/shortcut-search-96.png', sizes: '96x96' }],
						},
					],
				},
				devOptions: {
					enabled: false, // enable locally if you need to test SW in dev
				},
			}),
			compression({
				algorithms: ['gzip'],
				exclude: [/\.(br)$/, /\.(gz)$/],
			}),
			compression({
				algorithms: ['brotliCompress'],
				exclude: [/\.(br)$/, /\.(gz)$/],
			}),
		],
		base: '/',
		resolve: {
			alias: {
				"@": path.resolve(__dirname, "./src"),
			},
		},
		server: {
			port: 3000,
			allowedHosts: [
				'localhost',
				'127.0.0.1',
				'.ngrok-free.app',
				'0b40-2401-4900-8fec-ca38-5daf-e2ce-d28a-7cef.ngrok-free.app'
			],
			hmr: {
				overlay: false,
			},
			proxy: {
				'/api': {
					target: apiUrl,
					changeOrigin: true,
					secure: false,
					rewrite: (path) => path.replace(/^\/api/, '')
				}
			}
		},
		preview: {
			port: 3000,
			proxy: {
				'/api': {
					target: apiUrl,
					changeOrigin: true,
					secure: false,
					rewrite: (path) => path.replace(/^\/api/, '')
				}
			}
		},
		build: {
			outDir: "dist",
			assetsDir: "assets",
			sourcemap: false,
			minify: 'esbuild',
			cssCodeSplit: true,
			target: 'es2020',
			commonjsOptions: { 
				transformMixedEsModules: true,
				requireReturnsDefault: 'auto'
			},
			rollupOptions: {
				output: {
					manualChunks(id) {
						if (!id.includes('node_modules')) return undefined;

						if (id.includes('firebase')) return 'vendor-firebase';
						if (id.includes('framer-motion')) return 'vendor-motion';
						if (id.includes('@mui') || id.includes('@emotion')) return 'vendor-mui';
						if (id.includes('react-dom') || id.includes('react-router-dom') || id.includes(`${path.sep}react${path.sep}`)) {
							return 'vendor-react';
						}
						if (id.includes('howler')) return 'vendor-audio';
						if (id.includes('three')) return 'vendor-three';
						if (id.includes('recharts')) return 'vendor-charts';
						if (id.includes('lodash')) return 'vendor-utils';

						return 'vendor';
					},
					chunkFileNames: 'assets/js/[name]-[hash].js',
					assetFileNames: (assetInfo) => {
						if (!assetInfo.name) return 'assets/[name]-[hash][extname]';
						const ext = assetInfo.name.split('.').pop() || '';
						if (/png|jpe?g|svg|gif|webp|avif/i.test(ext)) {
							return 'assets/img/[name]-[hash][extname]';
						}
						if (/css/i.test(ext)) {
							return 'assets/css/[name]-[hash][extname]';
						}
						return 'assets/[name]-[hash][extname]';
					}
				},
				onwarn(warning, warn) {
					// Suppress circular dependency warnings
					if (warning.code === 'CIRCULAR_DEPENDENCY') return;
					warn(warning);
				}
			},
			chunkSizeWarningLimit: 1000,
			assetsInlineLimit: 2048, // Inline small assets
			reportCompressedSize: false, // Faster builds
			cssMinify: true,
		},
		define: {
			'process.env.VITE_API_URL': JSON.stringify(apiUrl),
			'process.env.REACT_APP_CLOUDINARY_CLOUD_NAME': JSON.stringify(cloudinaryName),
			'process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET': JSON.stringify(cloudinaryPreset),
			'process.env.REACT_APP_CLOUDINARY_API_KEY': JSON.stringify(cloudinaryKey),
			'process.env.REACT_APP_CLOUDINARY_API_SECRET': JSON.stringify(cloudinarySecret)
		},
		esbuild: {
			drop: mode === 'production' ? ['console', 'debugger'] : [],
			legalComments: 'none',
			treeShaking: true
		},
		optimizeDeps: {
			include: ['react', 'react-dom', 'react-router-dom', 'zustand'],
			exclude: ['@vite/client', '@vite/env']
		}
	}
});

