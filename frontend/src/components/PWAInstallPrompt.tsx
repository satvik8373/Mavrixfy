import { useEffect, useReducer, useRef, useState } from 'react';
import { X, Download, Smartphone } from 'lucide-react';
import { PLAY_STORE_URL } from '@/config/appLinks';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'pwa-prompt-dismissed-at';
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const wasRecentlyDismissed = () => {
  const ts = localStorage.getItem(DISMISS_KEY);
  return ts ? Date.now() - Number(ts) < DISMISS_COOLDOWN_MS : false;
};

const isIOSDevice = () => {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream;
};

const isAndroidDevice = () => /Android/i.test(navigator.userAgent);

const PWAInstallPrompt = () => {
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [visible, dispatchVisible] = useReducer((_visible: boolean, nextVisible: boolean) => nextVisible, false);
  const [isIOS] = useState(isIOSDevice);
  const [isAndroid] = useState(isAndroidDevice);

  useEffect(() => {
    // Already installed or recently dismissed — do nothing
    if (isStandalone() || wasRecentlyDismissed()) return;

    if (isIOS) {
      // iOS doesn't fire beforeinstallprompt — show manual instructions after a delay
      const t = window.setTimeout(() => dispatchVisible(true), 8000);
      return () => window.clearTimeout(t);
    }

    const androidTimer = isAndroid
      ? window.setTimeout(() => dispatchVisible(true), 8000)
      : undefined;

    const handler = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      dispatchVisible(true);
    };

    const handleInstalled = () => dispatchVisible(false);

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', handleInstalled);
      if (androidTimer) window.clearTimeout(androidTimer);
    };
  }, [isAndroid, isIOS]);

  const handleInstall = async () => {
    if (!deferredPromptRef.current) return;
    await deferredPromptRef.current.prompt();
    const { outcome } = await deferredPromptRef.current.userChoice;
    if (outcome === 'accepted') {
      dispatchVisible(false);
    }
    deferredPromptRef.current = null;
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    dispatchVisible(false);
  };

  if (!visible) return null;

  return (
    <dialog
      open
      aria-label="Install Mavrixfy"
      className="fixed bottom-0 left-0 right-0 z-[200] px-4 pb-safe border-none bg-transparent p-0 max-w-none outline-none"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
    >
      <div className="bg-zinc-900 border border-white/10 rounded-2xl p-4 flex flex-wrap items-center gap-3 shadow-2xl max-w-md mx-auto">
        <img
          src="/mavrixfy-icons/mavrixfy-icon-maskable-192.png"
          alt="Mavrixfy"
          className="w-12 h-12 rounded-xl flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-tight">Install Mavrixfy</p>
          {isIOS ? (
            <p className="text-xs text-white/60 mt-0.5 leading-snug">
              Tap <span className="font-medium text-white/80">Share</span> then{' '}
              <span className="font-medium text-white/80">Add to Home Screen</span>
            </p>
          ) : isAndroid ? (
            <p className="text-xs text-white/60 mt-0.5">Android app is available on Google Play</p>
          ) : (
            <p className="text-xs text-white/60 mt-0.5">Add to your home screen for the best experience</p>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {isAndroid && (
            <a
              href={PLAY_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-white text-black text-xs font-semibold px-3 py-2 rounded-lg flex-shrink-0"
              aria-label="Open Mavrixfy on Google Play"
            >
              <Smartphone size={14} />
              Play Store
            </a>
          )}
          {!isIOS && deferredPromptRef.current && (
            <button type="button"
              onClick={handleInstall}
              className="flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-semibold px-3 py-2 rounded-lg flex-shrink-0"
              aria-label="Install web app"
            >
              <Download size={14} />
              {isAndroid ? 'Web app' : 'Install'}
            </button>
          )}
          <button type="button"
            onClick={handleDismiss}
            className="p-1.5 text-white/40 hover:text-white/80 flex-shrink-0"
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </dialog>
  );
};

export default PWAInstallPrompt;
