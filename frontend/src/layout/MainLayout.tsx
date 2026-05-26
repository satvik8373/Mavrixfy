import { Suspense, lazy, useEffect, useReducer, useRef, useCallback, memo } from 'react';
import type { ErrorInfo } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import MobileNav from './components/MobileNav';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { useSidebarStore, COLLAPSED_WIDTH, MAX_WIDTH, MIN_WIDTH } from '@/stores/useSidebarStore';
import { useBackgroundRefresh } from '@/hooks/useBackgroundRefresh';
import { useAlbumColors } from '@/hooks/useAlbumColors';
import ErrorBoundary from '@/components/ErrorBoundary';

const LeftSidebar = lazy(() => import('./components/LeftSidebar'));
const PlaybackControls = lazy(() => import('./components/PlaybackControls'));
const Header = lazy(() => import('@/components/Header'));
const QueuePanel = lazy(() => import('@/components/QueuePanel'));
const DesktopFooter = lazy(() => import('@/components/DesktopFooter'));

// Memoized components to prevent unnecessary re-renders
const MemoizedMobileNav = memo(MobileNav);

const RouteErrorFallback = (error: Error, errorInfo: ErrorInfo) => (
  <div className="flex min-h-[420px] w-full items-center justify-center p-6">
    <div className="w-full max-w-3xl rounded-lg border border-red-500/30 bg-red-950/20 p-5 text-left text-red-100">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-300">Route render error</p>
      <h1 className="mt-2 text-2xl font-semibold text-white">This page failed to render</h1>
      <p className="mt-2 text-sm text-red-100/80">
        The app caught an error while loading this route. This panel is shown so production does not fail silently.
      </p>

      <details className="mt-4 rounded-md bg-black/30 p-3" open>
        <summary className="cursor-pointer text-sm font-medium text-red-200">Error details</summary>
        <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-red-100">
          {error.message}
          {'\n\n'}
          {error.stack}
          {'\n\nComponent stack:\n'}
          {errorInfo.componentStack}
        </pre>
      </details>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90"
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
        <button
          type="button"
          className="rounded-md border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
          onClick={() => {
            sessionStorage.removeItem('chunk_reload_attempt');
            window.location.reload();
          }}
        >
          Clear Route Retry
        </button>
      </div>
    </div>
  </div>
);

interface LayoutUiState {
  isMobile: boolean;
  showQueue: boolean;
  isDocumentFullscreen: boolean;
}

type LayoutUiAction =
  | { type: 'mobile'; value: boolean }
  | { type: 'toggle_queue' }
  | { type: 'queue'; value: boolean }
  | { type: 'fullscreen'; value: boolean };

const layoutUiReducer = (state: LayoutUiState, action: LayoutUiAction): LayoutUiState => {
  switch (action.type) {
    case 'mobile':
      if (state.isMobile === action.value) return state;
      return { ...state, isMobile: action.value };
    case 'toggle_queue':
      return { ...state, showQueue: !state.showQueue };
    case 'queue':
      return { ...state, showQueue: action.value };
    case 'fullscreen':
      return {
        ...state,
        isDocumentFullscreen: action.value,
        showQueue: action.value ? false : state.showQueue,
      };
    default:
      return state;
  }
};

// eslint-disable-next-line react-doctor/no-giant-component
const MainLayout = () => {
  const [{ isMobile, showQueue, isDocumentFullscreen }, dispatchLayoutUi] = useReducer(layoutUiReducer, {
    isMobile: window.innerWidth < 768,
    showQueue: false,
    isDocumentFullscreen: false,
  });
  const isMobileRef = useRef(isMobile);
  useEffect(() => {
    isMobileRef.current = isMobile;
  }, [isMobile]);
  const currentSong = usePlayerStore(state => state.currentSong); // Selective subscription
  const isPlaying = usePlayerStore(state => state.isPlaying);
  const hasActiveSong = !!currentSong;
  const albumColors = useAlbumColors(currentSong?.imageUrl);
  const location = useLocation();
  const pathname = location.pathname;
  const { width, isCollapsed, setWidth, toggleCollapse, setCollapsed } = useSidebarStore();
  const isResizing = useRef(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const previousDocumentTitleRef = useRef(document.title);
  const playbackTitleActiveRef = useRef(false);
  const COLLAPSE_THRESHOLD = 140;
  const MIN_MAIN_CONTENT_WIDTH = 360;

  useBackgroundRefresh();

  const restoreBrowserTitle = useCallback(() => {
    if (playbackTitleActiveRef.current) {
      document.title = previousDocumentTitleRef.current || 'Mavrixfy';
    }
  }, []);

  // Show current playing track in browser title while playback is active.
  useEffect(() => {
    const fallbackTitle = previousDocumentTitleRef.current || 'Mavrixfy';

    if (!isPlaying || !currentSong) {
      if (playbackTitleActiveRef.current) {
        document.title = fallbackTitle;
        playbackTitleActiveRef.current = false;
      } else {
        previousDocumentTitleRef.current = document.title;
      }
      return;
    }

    if (!playbackTitleActiveRef.current) {
      previousDocumentTitleRef.current = document.title;
      playbackTitleActiveRef.current = true;
    }

    const songTitle = currentSong.title || 'Unknown Title';
    const songArtist = currentSong.artist || 'Unknown Artist';
    const playbackTitle = `${songTitle} - ${songArtist} | Mavrixfy`;

    if (document.title !== playbackTitle) {
      document.title = playbackTitle;
    }
  }, [isPlaying, currentSong, pathname]);

  useEffect(() => {
    return restoreBrowserTitle;
  }, [restoreBrowserTitle]);

  // Expose current-song palette globally so all sections can inherit the same live theme.
  useEffect(() => {
    const root = document.documentElement;

    if (!currentSong) {
      root.style.setProperty('--player-primary', 'rgb(56, 87, 168)');
      root.style.setProperty('--player-secondary', 'rgb(22, 34, 74)');
      root.style.setProperty('--player-text', '#f5fbff');
      return;
    }

    const textColor = albumColors.text === 'black' ? '#0b141a' : '#f5fbff';

    root.style.setProperty('--player-primary', albumColors.primary || 'rgb(56, 87, 168)');
    root.style.setProperty('--player-secondary', albumColors.secondary || 'rgb(22, 34, 74)');
    root.style.setProperty('--player-text', textColor);
  }, [albumColors.primary, albumColors.secondary, albumColors.text, currentSong]);

  // Listen for queue toggle events (optimized)
  useEffect(() => {
    const handleToggleQueue = () => dispatchLayoutUi({ type: 'toggle_queue' });
    const handleOpenQueue = () => dispatchLayoutUi({ type: 'queue', value: true });
    const handleCloseQueue = () => dispatchLayoutUi({ type: 'queue', value: false });

    window.addEventListener('toggleQueue', handleToggleQueue, { passive: true });
    window.addEventListener('openQueue', handleOpenQueue, { passive: true });
    window.addEventListener('closeQueue', handleCloseQueue, { passive: true });

    return () => {
      window.removeEventListener('toggleQueue', handleToggleQueue);
      window.removeEventListener('openQueue', handleOpenQueue);
      window.removeEventListener('closeQueue', handleCloseQueue);
    };
  }, []);

  useEffect(() => {
    const syncFullscreenState = () => {
      const doc = document as any;
      dispatchLayoutUi({
        type: 'fullscreen',
        value: Boolean(document.fullscreenElement || doc.webkitFullscreenElement),
      });
    };

    syncFullscreenState();
    document.addEventListener('fullscreenchange', syncFullscreenState);
    document.addEventListener('webkitfullscreenchange', syncFullscreenState as EventListener);

    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState);
      document.removeEventListener('webkitfullscreenchange', syncFullscreenState as EventListener);
    };
  }, []);

  // Instantly synchronize mobile detection on mount and resize events without debounce,
  // using a ref guard to completely eliminate Cumulative Layout Shifts (CLS) during browser viewport changes.
  useEffect(() => {
    const checkMobile = () => {
      const isMobileNow = window.innerWidth < 768;
      if (isMobileNow !== isMobileRef.current) {
        dispatchLayoutUi({ type: 'mobile', value: isMobileNow });
      }
    };

    window.addEventListener('resize', checkMobile, { passive: true });
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  // Route-aware measurements for mobile header/nav spacing
  const isHeaderRoute =
    pathname === '/home' ||
    pathname.startsWith('/search') ||
    pathname.startsWith('/library');

  const isNavRoute =
    pathname === '/home' ||
    pathname.startsWith('/search') ||
    pathname.startsWith('/library') ||
    pathname.startsWith('/playlist/') ||
    pathname.startsWith('/artist/') ||
    pathname.startsWith('/album/') ||
    pathname.startsWith('/genre/') ||
    pathname.startsWith('/jiosaavn/playlist/');

  const hideDesktopFooter = (
    pathname.startsWith('/playlist/') ||
    pathname.startsWith('/jiosaavn/playlist/') ||
    pathname === '/jiosaavn/playlists' ||
    pathname === '/mood-playlist'
  );

  const getMaxSidebarWidth = useCallback(() => {
    const queueWidth = showQueue && !isDocumentFullscreen ? 280 : 0;
    const layoutGaps = 32;
    return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, window.innerWidth - queueWidth - MIN_MAIN_CONTENT_WIDTH - layoutGaps));
  }, [isDocumentFullscreen, showQueue]);

  const resizeSidebar = useCallback((nextWidth: number) => {
    const maxSidebarWidth = getMaxSidebarWidth();

    if (nextWidth < COLLAPSE_THRESHOLD) {
      setCollapsed(true);
      return;
    }

    setCollapsed(false);
    setWidth(Math.max(MIN_WIDTH, Math.min(maxSidebarWidth, nextWidth)));
  }, [getMaxSidebarWidth, setCollapsed, setWidth]);

  // Handle resize functionality
  const handleResizePointerDown = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    isResizing.current = true;
    Object.assign(document.body.style, {
      cursor: 'col-resize',
      userSelect: 'none'
    });

    const startX = event.clientX;
    const startWidth = isCollapsed ? COLLAPSED_WIDTH : width;

    const handlePointerMove = (event: PointerEvent) => {
      if (!isResizing.current) return;
      resizeSidebar(startWidth + event.clientX - startX);
    };

    const handlePointerUp = () => {
      isResizing.current = false;
      Object.assign(document.body.style, {
        cursor: '',
        userSelect: ''
      });
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
    window.addEventListener('pointercancel', handlePointerUp, { once: true });
  }, [isCollapsed, resizeSidebar, width]);

  const handleResizeKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleCollapse();
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      resizeSidebar((isCollapsed ? COLLAPSED_WIDTH : width) - 24);
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      resizeSidebar((isCollapsed ? MIN_WIDTH : width) + 24);
    }
  }, [isCollapsed, resizeSidebar, toggleCollapse, width]);

  const handleCloseQueuePanel = useCallback(() => {
    dispatchLayoutUi({ type: 'queue', value: false });
  }, []);

  const sidebarWidth = isCollapsed ? COLLAPSED_WIDTH : Math.min(width, getMaxSidebarWidth());

  return (
    <div className="bg-transparent text-foreground flex flex-col overflow-hidden max-w-full relative"
      style={{ height: 'calc(var(--vh, 1dvh) * 100)' }}
    >
      {/* Header with login - hidden on mobile */}
      {!isMobile && (
        <div className="hidden md:block flex-shrink-0 relative z-[100]">
          <Suspense fallback={null}>
            <Header />
          </Suspense>
        </div>
      )}

      {/* Main content area */}
      <div
        className="flex-1 flex min-w-0 overflow-hidden md:pl-2 md:gap-2 relative z-0 bg-transparent main-content-layout"
        data-route-header={isHeaderRoute}
        data-route-nav={isNavRoute}
        data-active-song={hasActiveSong}
      >
        {/* Left sidebar - hidden on mobile */}
        {!isMobile && (
          <div
            ref={sidebarRef}
            className="h-full flex-shrink-0 relative group"
            style={{ width: `${sidebarWidth}px`, minWidth: `${sidebarWidth}px` }}
          >
            <div className="h-full bg-[#121212] rounded-lg overflow-hidden">
              <Suspense fallback={null}>
                <LeftSidebar isCollapsed={isCollapsed} onToggleCollapse={toggleCollapse} />
              </Suspense>
            </div>
            {/* Resize handle */}
            <button
              type="button"
              aria-label={isCollapsed ? 'Expand sidebar' : 'Resize sidebar'}
              tabIndex={0}
              onKeyDown={handleResizeKeyDown}
              onPointerDown={handleResizePointerDown}
              className="absolute -right-1 top-0 bottom-0 w-3 cursor-col-resize z-10 flex items-center justify-center group/resize border-0 bg-transparent p-0 touch-none"
            >
              <div className="w-0.5 h-16 bg-white/0 group-hover/resize:bg-white/40 rounded-full transition-colors" />
            </button>
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 min-w-0 h-full overflow-hidden">
          <div className="h-full overflow-y-auto overflow-x-hidden mobile-scroll-fix bg-transparent md:rounded-lg">
            <main id="main-content" className="min-h-full flex flex-col">
              <div className="flex-1 w-full">
                <ErrorBoundary key={pathname} fallback={RouteErrorFallback}>
                  <Outlet />
                </ErrorBoundary>
              </div>
              {!isMobile && !hideDesktopFooter && (
                <Suspense fallback={null}>
                  <DesktopFooter />
                </Suspense>
              )}
            </main>
          </div>
        </div>

        {/* Queue Panel - Desktop only */}
        {!isMobile && showQueue && !isDocumentFullscreen && (
          <div className="w-[280px] min-w-[280px] h-full flex-shrink-0">
            <div className="h-full bg-[#121212] rounded-lg overflow-hidden">
              <Suspense fallback={null}>
                <QueuePanel onClose={handleCloseQueuePanel} />
              </Suspense>
            </div>
          </div>
        )}
      </div>

      {/* Playback controls - visible on desktop only when there's a song */}
      {currentSong && !isMobile && (
        <Suspense fallback={null}>
          <PlaybackControls />
        </Suspense>
      )}

      {/* Mobile Navigation */}
      <MemoizedMobileNav />
    </div>
  );
};

export default MainLayout;
