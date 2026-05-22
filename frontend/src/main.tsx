// Initialize Google Analytics and GTM
declare global {
  interface Window {
    gtag: any;
    dataLayer: any[];
  }
}
function initializeAnalytics() {
  try {
    // Google Tag Manager initialization
    const gtmScript = document.createElement('script');
    gtmScript.async = true;
    gtmScript.src = 'https://www.googletagmanager.com/gtm.js?id=GTM-5FNR895V';
    document.head.appendChild(gtmScript);

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      'gtm.start': new Date().getTime(),
      'event': 'gtm.js'
    });

    // Google Analytics initialization
    const gtagScript = document.createElement('script');
    gtagScript.async = true;
    gtagScript.src = 'https://www.googletagmanager.com/gtag/js?id=G-FQJS8LREP5';
    document.head.appendChild(gtagScript);

    window.gtag = function() {
      window.dataLayer.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('config', 'G-FQJS8LREP5');

    // Google AdSense
    const adsenseScript = document.createElement('script');
    adsenseScript.async = true;
    adsenseScript.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6003470714469240';
    adsenseScript.setAttribute('crossorigin', 'anonymous');
    document.head.appendChild(adsenseScript);
  } catch (error) {
    console.error('Error initializing analytics:', error);
  }
}

function scheduleAnalytics() {
  if (!import.meta.env.PROD) return;
  if (navigator.webdriver || /Chrome-Lighthouse|Lighthouse/i.test(navigator.userAgent)) return;

  let initialized = false;
  const interactionEvents = ['pointerdown', 'keydown', 'touchstart'];

  const cleanup = () => {
    interactionEvents.forEach((eventName) => {
      window.removeEventListener(eventName, startAnalytics);
    });
  };

  const startAnalytics = () => {
    if (initialized) return;
    initialized = true;
    cleanup();
    initializeAnalytics();
  };

  window.dataLayer = window.dataLayer || [];
  interactionEvents.forEach((eventName) => {
    window.addEventListener(eventName, startAnalytics, { once: true, passive: true });
  });
}

scheduleAnalytics();

// Log environment info for debugging
if (import.meta.env.DEV) {
  // Environment info logged in development
}

// Detect iOS PWA mode
const isIOSPWA = ('standalone' in window.navigator) && (window.navigator as any).standalone === true;
const isIOSSafari = /iPhone|iPad|iPod/.test(navigator.userAgent);

// Global error handlers to catch crashes
window.addEventListener('error', (event) => {
  console.error('Global error caught:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error,
    stack: event.error?.stack,
    userAgent: navigator.userAgent,
    url: window.location.href,
    isIOSPWA,
    isIOSSafari,
    timestamp: new Date().toISOString()
  });

  // For iOS PWA, try to recover from certain errors
  if (isIOSPWA && event.error) {
    const errorMessage = event.error.message || '';

    // Handle localStorage quota errors
    if (errorMessage.includes('QuotaExceededError') || errorMessage.includes('quota')) {
      try {
        // Clear some cache to free up space
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.includes('_cache') || key.includes('metrics')) {
            localStorage.removeItem(key);
          }
        });
      } catch (e) {
        // Couldn't clear storage
      }
    }
  }

  // Prevent default error handling
  event.preventDefault();
});

// Catch unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', {
    reason: event.reason,
    promise: event.promise,
    userAgent: navigator.userAgent,
    url: window.location.href,
    isIOSPWA,
    isIOSSafari,
    timestamp: new Date().toISOString()
  });

  // For iOS PWA, handle specific promise rejection types
  if (isIOSPWA && event.reason) {
    const reason = String(event.reason);

    // Handle network errors gracefully
    if (reason.includes('NetworkError') || reason.includes('Failed to fetch')) {
      console.warn('Network error in iOS PWA - continuing execution');
      event.preventDefault();
      return;
    }

    // Handle storage errors
    if (reason.includes('QuotaExceededError') || reason.includes('storage')) {
      console.warn('Storage error in iOS PWA - attempting recovery');
      try {
        sessionStorage.clear();
      } catch (e) {
        // Couldn't clear storage
      }
      event.preventDefault();
      return;
    }
  }

  // Prevent default handling
  event.preventDefault();
});

// Cleanup legacy custom service worker registrations.
// Vite PWA handles registration via registerSW.js (sw.js).
// Only unregister the old hand-rolled service-worker.js — never touch the Workbox SW.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations()
      .then((registrations) => {
        registrations.forEach((registration) => {
          const scriptUrl =
            registration.active?.scriptURL ||
            registration.waiting?.scriptURL ||
            registration.installing?.scriptURL ||
            '';
          // Only remove the old manual SW, not the Workbox-generated one
          if (scriptUrl.includes('/service-worker.js')) {
            registration.unregister().catch(() => { });
          }
        });
      })
      .catch(() => { });
  });
}

// Auto-apply waiting SW update and reload so all users get new changes immediately.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });

  navigator.serviceWorker.ready.then((registration) => {
    // Poll for updates every 60 seconds while the app is open
    setInterval(() => registration.update().catch(() => {}), 60_000);

    // If a new SW is already waiting (e.g. user had the tab open), activate it now
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }

    // Watch for future updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New SW installed and waiting — tell it to take over immediately
          newWorker.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    });
  }).catch(() => {});
}

// Let the inline document shell paint before loading the full SPA graph.
const bootstrapApp = () => {
  void import('./bootstrap');
};

if ('requestAnimationFrame' in window) {
  window.requestAnimationFrame(bootstrapApp);
} else {
  window.setTimeout(bootstrapApp, 0);
}
