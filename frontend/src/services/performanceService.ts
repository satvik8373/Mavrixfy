// Performance optimization service
export class PerformanceService {
  private static instance: PerformanceService;
  private preloadedImages: Set<string> = new Set();
  private preloadedResources: Set<string> = new Set();

  static getInstance(): PerformanceService {
    if (!PerformanceService.instance) {
      PerformanceService.instance = new PerformanceService();
    }
    return PerformanceService.instance;
  }

  /**
   * Preload critical images for better performance
   */
  preloadImage(src: string, priority: 'high' | 'low' = 'low'): Promise<void> {
    if (this.preloadedImages.has(src)) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        this.preloadedImages.add(src);
        resolve();
      };
      
      img.onerror = () => {
        reject(new Error(`Failed to preload image: ${src}`));
      };

      // Set priority for high-priority images
      if (priority === 'high') {
        img.fetchPriority = 'high';
      }

      img.src = src;
    });
  }

  /**
   * Preload multiple images
   */
  async preloadImages(images: Array<{ src: string; priority?: 'high' | 'low' }>): Promise<void> {
    const promises = images.map(({ src, priority = 'low' }) => 
      this.preloadImage(src, priority).catch(() => {
        // Silently fail for non-critical images
      })
    );

    await Promise.all(promises);
  }

  /**
   * Add resource hints for better performance
   */
  addResourceHints(): void {
    // DNS prefetch for external domains
    const domains = [
      'res.cloudinary.com',
      'firebase.googleapis.com',
      'fonts.googleapis.com',
      'fonts.gstatic.com'
    ];

    domains.forEach(domain => {
      const link = document.createElement('link');
      link.rel = 'dns-prefetch';
      link.href = `//${domain}`;
      document.head.appendChild(link);
    });

    // Preconnect to critical domains
    const criticalDomains = [
      'https://res.cloudinary.com',
      'https://firebase.googleapis.com'
    ];

    criticalDomains.forEach(domain => {
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = domain;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    });
  }

  /**
   * Optimize images for different screen sizes
   */
  getResponsiveImageSrc(src: string, sizes: { sm?: number; md?: number; lg?: number } = {}): string {
    if (!src || !src.includes('cloudinary.com')) {
      return src;
    }

    // Extract public ID from Cloudinary URL
    const match = src.match(/\/([^/]+)\/?([^/]+)\/([^/]+)$/);
    if (!match) return src;

    const publicId = match[3].split('.')[0];
    const cloudName = match[1];

    // Generate responsive srcset
    const srcset = [];
    
    if (sizes.sm) {
      srcset.push(`https://res.cloudinary.com/${cloudName}/image/upload/w_${sizes.sm},f_auto,q_80/${publicId} ${sizes.sm}w`);
    }
    
    if (sizes.md) {
      srcset.push(`https://res.cloudinary.com/${cloudName}/image/upload/w_${sizes.md},f_auto,q_80/${publicId} ${sizes.md}w`);
    }
    
    if (sizes.lg) {
      srcset.push(`https://res.cloudinary.com/${cloudName}/image/upload/w_${sizes.lg},f_auto,q_80/${publicId} ${sizes.lg}w`);
    }

    return srcset.join(', ');
  }

  /**
   * Debounce function for performance
   */
  debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  /**
   * Throttle function for performance
   */
  throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }

  /**
   * Measure performance metrics
   */
  measurePerformance(): void {
    if ('performance' in window) {
      // Measure Core Web Vitals
      if ('web-vital' in window) {
        // This would require the web-vitals library
      }

      // Measure custom metrics
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          // Performance entry logged
        }
      });

      observer.observe({ entryTypes: ['measure', 'navigation'] });
    }
  }

  /**
   * Optimize scroll performance
   */
  optimizeScroll(element: HTMLElement): void {
    Object.assign(element.style, { willChange: 'transform', transform: 'translateZ(0)' }); //
// Force hardware acceleration
  }

  /**
   * Clean up performance optimizations
   */
  cleanup(): void {
    this.preloadedImages.clear();
    this.preloadedResources.clear();
  }
}

// Export singleton instance
export const performanceService = PerformanceService.getInstance();
