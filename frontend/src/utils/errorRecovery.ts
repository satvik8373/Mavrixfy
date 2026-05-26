export const APP_LOAD_RECOVERY_KEY = 'mavrixfy_chunk_recovery_done';

export const isRecoverableAppLoadError = (error?: Error | null) => {
	const message = `${error?.message ?? ''}`;
	return (
		/ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed|Cannot read properties of undefined \(reading 'default'\)|Cannot read property 'default' of undefined/i.test(message) ||
		/\(0\s*,\s*.*\.default\)\s*is not a function/i.test(message)
	);
};

export const performHardRefresh = async () => {
	try {
		if ('serviceWorker' in navigator) {
			const registrations = await navigator.serviceWorker.getRegistrations();
			await Promise.all(registrations.map((registration) => registration.unregister().catch(() => undefined)));
		}
	} catch {
		// Ignore cleanup errors and continue with refresh.
	}

	try {
		if ('caches' in window) {
			const cacheKeys = await caches.keys();
			await Promise.all(cacheKeys.map((key) => caches.delete(key).catch(() => false)));
		}
	} catch {
		// Ignore cache cleanup errors and continue with refresh.
	}

	window.location.replace(`${window.location.pathname}${window.location.search}${window.location.hash}`);
};
