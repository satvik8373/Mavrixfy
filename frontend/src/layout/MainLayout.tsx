import { Suspense, lazy, useEffect, useReducer, useRef, useCallback, memo } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import MobileNav from './components/MobileNav';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { useSidebarStore, COLLAPSED_WIDTH } from '@/stores/useSidebarStore';
import { useBackgroundRefresh } from '@/hooks/useBackgroundRefresh';
import { CustomScrollbar } from '@/components/ui/CustomScrollbar';
import { useAlbumColors } from '@/hooks/useAlbumColors';

const LeftSidebar = lazy(() => import('./components/LeftSidebar'));
const PlaybackControls = lazy(() => import('./components/PlaybackControls'));
const Header = lazy(() => import('@/components/Header'));
const QueuePanel = lazy(() => import('@/components/QueuePanel'));
const DesktopFooter = lazy(() => import('@/components/DesktopFooter'));

// Memoized components to prevent unnecessary re-renders
const MemoizedMobileNav = memo(MobileNav);

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

const MainLayout = () => {
  const [{ isMobile, showQueue, isDocumentFullscreen }, dispatchLayoutUi] = useReducer(layoutUiReducer, {
    isMobile: window.innerWidth < 768,
    showQueue: false,
    isDocumentFullscreen: false,
  });
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
  const COLLAPSE_THRESHOLD = 120;

  useBackgroundRefresh();

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
    return () => {
      if (playbackTitleActiveRef.current) {
        document.title = previousDocumentTitleRef.current || 'Mavrixfy';
      }
    };
  }, []);

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

  // Optimized mobile detection with debouncing
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const checkMobile = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        dispatchLayoutUi({ type: 'mobile', value: window.innerWidth < 768 });
      }, 100);
    };

    window.addEventListener('resize', checkMobile, { passive: true });
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  // Route-aware measurements for mobile header/nav spacing
  const MOBILE_HEADER_PX = 40;
  const MOBILE_NAV_BASE_PX = 48; // Reduced from 56px to 48px
  const MOBILE_PLAYER_PADDING_PX = 44; // paddingTop when song is active
  const MOBILE_SAFE_TOP = 'env(safe-area-inset-top, 0px)';
  const isMobileHeaderRoute = isMobile && (
    pathname === '/home' ||
    pathname.startsWith('/search') ||
    pathname.startsWith('/library')
  );

  // Routes that need safe-area top margin but have no mobile header
  const isMobileSafeAreaRoute = isMobile && !isMobileHeaderRoute;

  const showMobilePlayer = hasActiveSong;
  const hideDesktopFooter = (
    pathname.startsWith('/playlist/') ||
    pathname.startsWith('/jiosaavn/playlist/') ||
    pathname === '/jiosaavn/playlists' ||
    pathname === '/mood-playlist'
  );

  const mobileBottomSubtractPx = MOBILE_NAV_BASE_PX + (showMobilePlayer ? MOBILE_PLAYER_PADDING_PX : 0);
  // Use 100dvh (dynamic viewport height) so the layout accounts for browser chrome on mobile.
  // Fall back to the JS-measured --vh variable for browsers that don't support dvh yet.
  const dvh = 'calc(var(--vh, 1dvh) * 100)';
  const mobileHeight = isMobile
    ? isMobileHeaderRoute
      ? `calc(${dvh} - ${mobileBottomSubtractPx}px - ${MOBILE_HEADER_PX}px - ${MOBILE_SAFE_TOP})`
      : isMobileSafeAreaRoute
        ? `calc(${dvh} - ${mobileBottomSubtractPx}px - ${MOBILE_SAFE_TOP})`
        : `calc(${dvh} - ${mobileBottomSubtractPx}px)`
    : 'auto';
  const mobileTopOffset = isMobileHeaderRoute
    ? `calc(${MOBILE_HEADER_PX}px + ${MOBILE_SAFE_TOP})`
    : isMobileSafeAreaRoute
      ? MOBILE_SAFE_TOP
      : '0px';

  // Handle resize functionality
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizing.current = true;
    Object.assign(document.body.style, {
      cursor: 'grabbing',
      userSelect: 'none'
    });

    const startX = e.clientX;
    const startWidth = isCollapsed ? COLLAPSED_WIDTH : width;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;

      const deltaX = e.clientX - startX;
      const newWidth = startWidth + deltaX;

      // If dragging left past threshold, collapse
      if (newWidth < COLLAPSE_THRESHOLD && !isCollapsed) {
        setCollapsed(true);
      }
      // If dragging right from collapsed state, expand
      else if (isCollapsed && newWidth > COLLAPSED_WIDTH + 30) {
        setCollapsed(false);
        // Restore previous width or use a reasonable default
        const expandedWidth = Math.max(COLLAPSE_THRESHOLD, Math.min(newWidth, 400));
        setWidth(expandedWidth);
      }
      // Normal resize when expanded
      else if (!isCollapsed && newWidth >= COLLAPSE_THRESHOLD) {
        setWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      Object.assign(document.body.style, {
        cursor: '',
        userSelect: ''
      });
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [setWidth, isCollapsed, width, setCollapsed]);

  const handleCloseQueuePanel = useCallback(() => {
    dispatchLayoutUi({ type: 'queue', value: false });
  }, []);

  const sidebarWidth = isCollapsed ? COLLAPSED_WIDTH : width;

  return (
    <div className="bg-transparent text-foreground flex flex-col overflow-hidden max-w-full relative"
      style={{ height: 'calc(var(--vh, 1dvh) * 100)' }}
    >
      {/* Header with login - hidden on mobile */}
      <div className="hidden md:block flex-shrink-0 relative z-[100]">
        <Suspense fallback={null}>
          <Header />
        </Suspense>
      </div>

      {/* Main content area */}
      <div
        className="flex-1 flex overflow-hidden md:pl-2 md:gap-2 relative z-0 bg-transparent"
        style={{
          height: mobileHeight,
          marginTop: mobileTopOffset,
        }}
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
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.click(); } }}
              onMouseDown={handleMouseDown}
              className="absolute right-0 top-0 bottom-0 w-2 cursor-grab active:cursor-grabbing z-10 flex items-center justify-center group/resize"
            >
              <div className="w-0.5 h-16 bg-white/0 group-hover/resize:bg-white/40 rounded-full transition-colors" />
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 h-full overflow-hidden">
          <CustomScrollbar className="h-full mobile-scroll-fix bg-transparent md:rounded-lg">
            <Outlet />
            {!isMobile && !hideDesktopFooter && (
              <Suspense fallback={null}>
                <DesktopFooter />
              </Suspense>
            )}
          </CustomScrollbar>
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
