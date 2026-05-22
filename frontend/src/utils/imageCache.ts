/**
 * Image Cache Utility
 * Handles image loading with rate limiting, fallbacks, and caching
 */

interface CachedImage {
  url: string;
  blob?: Blob;
  objectUrl?: string;
  timestamp: number;
  failed: boolean;
}

class ImageCache {
  private cache = new Map<string, CachedImage>();
  private pendingRequests = new Map<string, Promise<string>>();
  private maxCacheSize = 100;
  private cacheTTL = 30 * 60 * 1000; // 30 minutes
  private rateLimitDelay = 100; // ms between requests
  private lastRequestTime = 0;
  private failedUrls = new Set<string>();

  /**
   * Load image with rate limiting and caching
   */
  async loadImage(url: string, fallbackUrl?: string): Promise<string> {
    if (!url) return fallbackUrl || '';

    // Check if URL has failed before
    if (this.failedUrls.has(url)) {
      return fallbackUrl || url;
    }

    // Check cache first
    const cached = this.cache.get(url);
    if (cached && !cached.failed) {
      if (Date.now() - cached.timestamp < this.cacheTTL) {
        return cached.objectUrl || url;
      } else {
        // Expired, remove from cache
        this.removeFromCache(url);
      }
    }

    // Check for pending request
    const pending = this.pendingRequests.get(url);
    if (pending) {
      return pending;
    }

    // Create new request with rate limiting
    const requestPromise = this.fetchWithRateLimit(url, fallbackUrl);
    this.pendingRequests.set(url, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } finally {
      this.pendingRequests.delete(url);
    }
  }

  /**
   * Fetch image with rate limiting and retry logic
   */
  private async fetchWithRateLimit(url: string, fallbackUrl?: string): Promise<string> {
    // Special handling for Google profile images - use direct URL without fetching
    if (url.includes('googleusercontent.com') || url.includes('lh3.google')) {
      // Don't fetch Google images, just return the URL directly to avoid 429 errors
      // The browser will handle caching automatically
      this.addToCache(url, undefined, url, false);
      return url;
    }

    // Rate limiting for other images
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.rateLimitDelay) {
      await new Promise(resolve => 
        setTimeout(resolve, this.rateLimitDelay - timeSinceLastRequest)
      );
    }
    this.lastRequestTime = Date.now();

    try {
      // Try to fetch the image
      const response = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        cache: 'force-cache',
        credentials: 'omit'
      });

      if (!response.ok) {
        // For 429 errors, just return the URL directly
        if (response.status === 429) {
          return url;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      // Store in cache
      this.addToCache(url, blob, objectUrl);

      return objectUrl;
    } catch (error) {
      // Mark as failed
      this.failedUrls.add(url);
      this.addToCache(url, undefined, undefined, true);

      // Return fallback or original URL
      return fallbackUrl || url;
    }
  }

  /**
   * Add image to cache
   */
  private addToCache(url: string, blob?: Blob, objectUrl?: string, failed = false): void {
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      let oldestKey: string | undefined = undefined;
      let oldestTimestamp = Infinity;
      for (const [key, item] of this.cache.entries()) {
        if (item.timestamp < oldestTimestamp) {
          oldestTimestamp = item.timestamp;
          oldestKey = key;
        }
      }
      
      if (oldestKey) {
        this.removeFromCache(oldestKey);
      }
    }

    this.cache.set(url, {
      url,
      blob,
      objectUrl,
      timestamp: Date.now(),
      failed
    });
  }

  /**
   * Remove image from cache
   */
  private removeFromCache(url: string): void {
    const cached = this.cache.get(url);
    if (cached?.objectUrl) {
      URL.revokeObjectURL(cached.objectUrl);
    }
    this.cache.delete(url);
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.cache.forEach(cached => {
      if (cached.objectUrl) {
        URL.revokeObjectURL(cached.objectUrl);
      }
    });
    this.cache.clear();
    this.failedUrls.clear();
    this.pendingRequests.clear();
  }

  /**
   * Preload images
   */
  async preloadImages(urls: string[]): Promise<void> {
    const promises = urls.map(url => this.loadImage(url).catch(() => url));
    await Promise.all(promises);
  }

  /**
   * Get cache stats
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      failedUrls: this.failedUrls.size,
      pendingRequests: this.pendingRequests.size
    };
  }
}

// Singleton instance
export const imageCache = new ImageCache();

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    imageCache.clearCache();
  });
}

export default imageCache;
