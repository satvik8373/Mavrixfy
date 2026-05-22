/**
 * Request Manager Service
 * Handles API call deduplication, caching, and background processing optimization
 */

import axiosInstance from '../lib/axios';

interface RequestConfig {
  url: string;
  method: string;
  params?: Record<string, any>;
  body?: any;
  headers?: Record<string, string>;
  priority?: 'high' | 'medium' | 'low';
  cacheTTL?: number;
}

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

interface PendingRequest {
  promise: Promise<any>;
  timestamp: number;
}

class RequestManager {
  private cache = new Map<string, CacheEntry>();
  private pendingRequests = new Map<string, PendingRequest>();
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;
  private maxConcurrentRequests = 6; // Increased for better throughput
  private activeRequests = 0;
  private rateLimitDelay = 50; // Reduced delay for faster responses
  private cleanupInterval: NodeJS.Timeout | null = null;
  private retryAttempts = new Map<string, number>();
  private failedRequests = new Set<string>();

  constructor() {
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Generate a unique key for the request
   */
  private generateKey(config: RequestConfig): string {
    const { url, method, params, body } = config;
    const paramsStr = params ? JSON.stringify(params) : '';
    const bodyStr = body ? JSON.stringify(body) : '';
    return `${method}:${url}:${paramsStr}:${bodyStr}`;
  }

  /**
   * Check if cached data is still valid
   */
  private isCacheValid(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp < entry.ttl;
  }

  /**
   * Get data from cache if valid
   */
  private getFromCache(key: string): any | null {
    const entry = this.cache.get(key);
    if (entry && this.isCacheValid(entry)) {
      return entry.data;
    }
    if (entry) {
      this.cache.delete(key); // Remove expired entry
    }
    return null;
  }

  /**
   * Store data in cache
   */
  private setCache(key: string, data: any, ttl: number = 5 * 60 * 1000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Process the request queue with optimized rate limiting
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0 && this.activeRequests < this.maxConcurrentRequests) {
      const request = this.requestQueue.shift();
      if (request) {
        this.activeRequests++;
        request()
          .finally(() => {
            this.activeRequests--;
            // Use requestAnimationFrame for smoother processing
            if (this.requestQueue.length > 0) {
              requestAnimationFrame(() => this.processQueue());
            }
          });
        
        // Minimal delay only if queue is large
        if (this.requestQueue.length > 10) {
          setTimeout(() => this.processQueue(), this.rateLimitDelay);
          break;
        }
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Add request to queue for rate-limited processing
   */
  private queueRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await requestFn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.processQueue();
    });
  }

  /**
   * Main request method with deduplication and caching
   * Enhanced with retry logic and slow connection handling
   */
  async request<T>(
    config: RequestConfig,
    options: {
      cache?: boolean;
      cacheTTL?: number;
      deduplicate?: boolean;
      priority?: 'high' | 'normal' | 'low';
      retries?: number;
    } = {}
  ): Promise<T> {
    const {
      cache = true,
      cacheTTL = 5 * 60 * 1000, // 5 minutes default
      deduplicate = true,
      priority = 'normal',
      retries = 2
    } = options;

    const key = this.generateKey(config);

    // Check cache first - more aggressive caching on slow connections
    if (cache) {
      const cachedData = this.getFromCache(key);
      if (cachedData !== null) {
        return cachedData;
      }
    }

    // Check for pending request (deduplication)
    if (deduplicate) {
      const pending = this.pendingRequests.get(key);
      if (pending) {
        // Clean up old pending requests (older than 30 seconds)
        if (Date.now() - pending.timestamp > 30000) {
          this.pendingRequests.delete(key);
        } else {
          return pending.promise;
        }
      }
    }

    // Create the actual request function with retry logic
    const makeRequest = async (attempt: number = 0): Promise<T> => {
      try {
        const { url, method, params, body, headers = {} } = config;
        
        const axiosConfig: any = {
          method: method.toLowerCase(),
          url,
          headers,
          timeout: 15000, // Increased timeout for slow connections
          params
        };

        if (body && method !== 'GET') {
          axiosConfig.data = body;
        }

        const response = await axiosInstance(axiosConfig);
        const data = response.data;

        // Cache successful responses
        if (cache && response.status >= 200 && response.status < 300) {
          this.setCache(key, data, cacheTTL);
        }

        // Clear retry count on success
        this.retryAttempts.delete(key);
        this.failedRequests.delete(key);

        return data;
      } catch (error: any) {
        // Handle retry logic for slow connections
        if (attempt < retries && this.shouldRetry(error)) {
          const currentAttempts = this.retryAttempts.get(key) || 0;
          this.retryAttempts.set(key, currentAttempts + 1);
          
          // Exponential backoff with jitter
          const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 1000, 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          return makeRequest(attempt + 1);
        }

        // Mark as failed after all retries
        this.failedRequests.add(key);
        this.retryAttempts.delete(key);
        throw error;
      } finally {
        // Clean up pending request
        this.pendingRequests.delete(key);
      }
    };

    // Create promise and store as pending
    const requestPromise = priority === 'high' 
      ? makeRequest() 
      : this.queueRequest(makeRequest);

    if (deduplicate) {
      this.pendingRequests.set(key, {
        promise: requestPromise,
        timestamp: Date.now()
      });
    }

    return requestPromise;
  }

  /**
   * Clear cache for specific pattern or all
   */
  clearCache(pattern?: string): void {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.match(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  /**
   * Cancel pending requests for a pattern
   */
  cancelPendingRequests(pattern?: string): void {
    if (pattern) {
      for (const key of this.pendingRequests.keys()) {
        if (key.match(pattern)) {
          this.pendingRequests.delete(key);
        }
      }
    } else {
      this.pendingRequests.clear();
    }
  }

  /**
   * Get cache and request statistics
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      pendingRequests: this.pendingRequests.size,
      queueLength: this.requestQueue.length,
      activeRequests: this.activeRequests
    };
  }

  /**
   * Check if error should trigger a retry
   */
  private shouldRetry(error: any): boolean {
    // Retry on network errors, timeouts, and 5xx server errors
    if (!error.response) return true; // Network error
    if (error.code === 'ECONNABORTED') return true; // Timeout
    if (error.response.status >= 500) return true; // Server error
    if (error.response.status === 429) return true; // Rate limit
    return false;
  }

  /**
   * Cleanup method to be called periodically
   */
  cleanup(): void {
    this.cleanupCache();
    
    // Clean up old pending requests
    const now = Date.now();
    for (const [key, pending] of this.pendingRequests.entries()) {
      if (now - pending.timestamp > 30000) {
        this.pendingRequests.delete(key);
      }
    }

    // Clean up old retry attempts
    this.retryAttempts.clear();
    
    // Clean up failed requests older than 5 minutes
    if (this.failedRequests.size > 100) {
      this.failedRequests.clear();
    }
  }

  /**
   * Destroy the request manager and clean up resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
    this.pendingRequests.clear();
    this.requestQueue = [];
  }
}

// Create singleton instance
export const requestManager = new RequestManager();

export default requestManager;
