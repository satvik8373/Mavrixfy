/**
 * Service Worker Audio Cache Utilities
 *
 * Provides functions to interact with the service worker's audio cache
 * for pre-caching, cache management, and offline playback support.
 */

interface CacheStatus {
  audioItemCount: number;
  totalSizeBytes: number;
  totalSizeMB: string;
  maxItems: number;
  maxSizeMB: string;
  items: Array<{
    url: string;
    size: number;
    cachedAt: string | null;
  }>;
  error?: string;
}

/**
 * Check if service worker is available and active
 */
export const isServiceWorkerActive = (): boolean => {
  return 'serviceWorker' in navigator && !!navigator.serviceWorker.controller;
};

/**
 * Pre-cache an audio file for offline playback
 * Call this when a user starts playing a song to ensure it's cached
 */
export const cacheAudioUrl = async (url: string): Promise<void> => {
  if (!isServiceWorkerActive() || !url) return;

  try {
    navigator.serviceWorker.controller?.postMessage({
      type: 'CACHE_AUDIO',
      url
    });
  } catch (error) {
    // Silent fail - caching is optional
  }
};

/**
 * Pre-cache multiple audio URLs (e.g., next songs in queue)
 */
export const cacheAudioUrls = async (urls: string[]): Promise<void> => {
  if (!isServiceWorkerActive()) return;

  // Cache with small delays to avoid overwhelming the network
  for (let i = 0; i < urls.length; i++) {
    setTimeout(() => {
      cacheAudioUrl(urls[i]);
    }, i * 500);
  }
};

/**
 * Clear the entire audio cache
 */
export const clearAudioCache = async (): Promise<void> => {
  if (!isServiceWorkerActive()) return;

  try {
    navigator.serviceWorker.controller?.postMessage({
      type: 'CLEAR_AUDIO_CACHE'
    });
  } catch (error) {
    // Silent fail
  }
};

/**
 * Get current audio cache status
 */
export const getAudioCacheStatus = (): Promise<CacheStatus | null> => {
  return new Promise((resolve) => {
    if (!isServiceWorkerActive()) {
      resolve(null);
      return;
    }

    // Set up listener for response
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'CACHE_STATUS') {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
        resolve(event.data as CacheStatus);
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);

    // Request cache status
    navigator.serviceWorker.controller?.postMessage({
      type: 'GET_CACHE_STATUS'
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
      resolve(null);
    }, 5000);
  });
};

/**
 * Check if a specific audio URL is cached
 */
export const isAudioCached = async (url: string): Promise<boolean> => {
  if (!('caches' in window) || !url) return false;

  try {
    // Check across all open caches (Workbox names them dynamically)
    const cacheNames = await caches.keys();
    const matches = await Promise.all(
      cacheNames.map(async (name) => {
        const cache = await caches.open(name);
        return cache.match(url);
      })
    );
    return matches.some(Boolean);
  } catch {
    return false;
  }
};

/**
 * Pre-cache upcoming tracks in the queue
 * Call this after a song starts playing to cache the next few tracks
 */
export const precacheUpcomingTracks = async (
  queue: Array<{ audioUrl?: string }>,
  currentIndex: number,
  count: number = 3
): Promise<void> => {
  if (!isServiceWorkerActive() || !queue.length) return;

  const urls: string[] = [];

  for (let i = 1; i <= count; i++) {
    const nextIndex = (currentIndex + i) % queue.length;
    const track = queue[nextIndex];
    if (track?.audioUrl && !track.audioUrl.startsWith('blob:')) {
      urls.push(track.audioUrl);
    }
  }

  if (urls.length > 0) {
    cacheAudioUrls(urls);
  }
};

/**
 * Force service worker to update
 */
export const updateServiceWorker = async (): Promise<void> => {
  if (!('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      await registration.update();

      // If there's a waiting worker, activate it
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    }
  } catch (error) {
    // Silent fail
  }
};

export default {
  isServiceWorkerActive,
  cacheAudioUrl,
  cacheAudioUrls,
  clearAudioCache,
  getAudioCacheStatus,
  isAudioCached,
  precacheUpcomingTracks,
  updateServiceWorker
};
