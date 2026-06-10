import * as React from 'react';
import { Suspense, lazy, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Search, Library, Heart, LogIn, User, Play, Pause, ListMusic, Bell, Bluetooth, Smartphone, Car, Tv, Headphones, Speaker, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayerSync } from '@/hooks/usePlayerSync';
import { shallow } from 'zustand/shallow';

import { useAlbumColors } from '@/hooks/useAlbumColors';
import ProfileDropdown from '@/components/ProfileDropdown';
import { PingPongScroll } from '@/components/PingPongScroll';
import { useAudioOutputDevice } from '@/hooks/useAudioOutputDevice';
import type { AudioOutputDeviceType } from '@/lib/audioOutputDevice';
import { PLAY_STORE_URL } from '@/config/appLinks';

const SongDetailsView = lazy(() => import('@/components/SongDetailsView'));
const QueueDrawer = lazy(() => import('@/components/QueueDrawer'));
const AudioOutputPicker = lazy(() => import('@/components/AudioOutputPicker'));
const WhatsNewDialog = lazy(() =>
  import('@/components/WhatsNewDialog').then((module) => ({ default: module.WhatsNewDialog }))
);


const MOOD_ICON_MASK_STYLE = {
  WebkitMaskImage: "url('https://res.cloudinary.com/djqq8kba8/image/upload/v1773035583/Mood-icon_asax7o.svg')",
  WebkitMaskRepeat: 'no-repeat',
  WebkitMaskPosition: 'center',
  WebkitMaskSize: 'contain',
  maskImage: "url('https://res.cloudinary.com/djqq8kba8/image/upload/v1773035583/Mood-icon_asax7o.svg')",
  maskRepeat: 'no-repeat',
  maskPosition: 'center',
  maskSize: 'contain',
} as const;

/**
 * Mobile Navigation with Profile Menu and Lockscreen Controls
 * 
 * Features:
 * - Profile dropdown with logout functionality
 * - Integration with the centralized audio manager for lockscreen controls
 * 
 * Note: For full lockscreen controls to work properly on mobile devices:
 * - iOS: Activate video to fullscreen mode, then swipe up to home screen
 * - Android: Enable background play in browser settings (Menu > Settings > Media > Background play)
 */

type NavItem = {
  label: string;
  icon: typeof Home;
  path: string;
  position: 'left' | 'right';
};

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Home',
    icon: Home,
    path: '/home',
    position: 'left'
  },
  {
    label: 'Search',
    icon: Search,
    path: '/search',
    position: 'left'
  },
  {
    label: 'Library',
    icon: Library,
    path: '/library',
    position: 'right'
  },
  {
    label: 'Liked',
    icon: Heart,
    path: '/liked-songs',
    position: 'right'
  },
];

const LEFT_NAV_ITEMS = NAV_ITEMS.filter((item) => item.position === 'left');
const RIGHT_NAV_ITEMS = NAV_ITEMS.filter((item) => item.position === 'right');

const MobilePlayStoreLink = () => (
  <a
    href={PLAY_STORE_URL}
    target="_blank"
    rel="noopener noreferrer"
    className="w-7 h-7 rounded-full bg-emerald-400/10 border border-emerald-400/30 flex items-center justify-center text-emerald-300 transition-colors hover:bg-emerald-400/20"
    aria-label="Open Mavrixfy Android app on Google Play"
    title="Android app available on Google Play"
  >
    <Smartphone className="h-4 w-4" />
  </a>
);

const getDropdownPosition = () => {
  if (typeof window === 'undefined') return 'right-0';
  return window.innerWidth < 400 ? 'left-0' : 'right-0';
};

const getDropdownStyles = () => {
  const position = getDropdownPosition();
  return {
    className: `absolute top-full mt-1 w-36 bg-popover/95 backdrop-blur-sm rounded-md shadow-xl overflow-hidden z-50 border border-border ${position}`,
    style: {
      minWidth: '144px',
      maxWidth: '320px',
    }
  };
};

const MobileProgressBar = React.memo(() => {
  const { currentTime, duration } = usePlayerStore(
    (state) => ({
      currentTime: state.currentTime,
      duration: state.duration,
    }),
    shallow
  );

  const progress = React.useMemo(() => {
    if (!duration || !Number.isFinite(duration) || duration <= 0) return 0;
    if (!Number.isFinite(currentTime) || currentTime <= 0) return 0;

    return Math.max(0, Math.min(100, (currentTime / duration) * 100));
  }, [currentTime, duration]);

  return (
    <div className="relative h-[2px] bg-white/5 w-full overflow-hidden">
      <div
        className="h-full bg-white absolute top-0 left-0 transition-all duration-100 ease-linear rounded-r-full shadow-[0_0_8px_rgba(255,255,255,0.8)]"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
});

MobileProgressBar.displayName = 'MobileProgressBar';

// Standalone output icon component to prevent inline render warnings
const OutputIcon = ({ type }: { type: AudioOutputDeviceType }) => {
  switch (type) {
    case 'car':
      return <Car className="h-4 w-4" />;
    case 'tv':
      return <Tv className="h-4 w-4" />;
    case 'headphones':
      return <Headphones className="h-4 w-4" />;
    case 'speaker':
      return <Speaker className="h-4 w-4" />;
    case 'bluetooth':
      return <Bluetooth className="h-4 w-4" />;
    case 'browser':
      return <Monitor className="h-4 w-4" />;
    default:
      return <Smartphone className="h-4 w-4" />;
  }
};


interface MobileTopHeaderProps {
  user: any;
  onProfileClick: (e: React.MouseEvent) => void;
  onProfileClose: () => void;
  onLogout: (e: React.MouseEvent) => void;
  onLogin: () => void;
  onWhatsNewOpen: () => void;
  dropdownClassName: string;
  dropdownStyle: React.CSSProperties;
  routeState: MobileTopHeaderState;
}


type MobileTopHeaderState = {
  showMobileTopHeader: boolean;
  isLikedRoute: boolean;
  isLibraryRoute: boolean;
  isSearchRoute: boolean;
  isAuthenticated: boolean;
  showProfileMenu: boolean;
};

const MobileTopHeader = ({  routeState: { showMobileTopHeader, isLikedRoute, isLibraryRoute, isSearchRoute, isAuthenticated, showProfileMenu },

  user,
  onProfileClick,
  onProfileClose,
  onLogout,
  onLogin,
  onWhatsNewOpen,
  dropdownClassName,
  dropdownStyle,
}: MobileTopHeaderProps) => {
  if (!showMobileTopHeader || isLikedRoute) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-30 bg-[#121212] dark:bg-[#121212] md:hidden pt-[env(safe-area-inset-top,0px)]">
      {isLibraryRoute ? (
        <div className="flex items-center justify-between px-4 h-10">
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <div className="relative">
                <button type="button"
                  onClick={onProfileClick}
                  aria-label="Profile"
                  className="p-0.5"
                >
                  {user?.picture ? (
                    <img
                      src={(user.picture || '').replace(/^http:\/\//, 'https://')}
                      alt={user.name || 'User'}
                      loading="lazy"
                      decoding="async"
                      width="26"
                      height="26"
                      className="rounded-full object-cover h-[26px] w-[26px]"
                    />
                  ) : (
                    <User className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>
                <ProfileDropdown
                  isOpen={showProfileMenu}
                  onClose={onProfileClose}
                  onLogout={onLogout}
                  className={dropdownClassName}
                  style={dropdownStyle}
                />
              </div>
            ) : (
              <button type="button"
                onClick={onLogin}
                aria-label="Sign in"
                className="p-1"
              >
                <LogIn className="h-5 w-5 text-foreground" />
              </button>
            )}
            <h2 className="text-sm font-semibold text-foreground">Your Library</h2>
          </div>
          <div className="flex items-center gap-2">
            <MobilePlayStoreLink />
          </div>
        </div>
      ) : isSearchRoute ? (
        <div className="flex items-center justify-between px-4 h-10">
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <div className="relative">
                <button type="button"
                  onClick={onProfileClick}
                  aria-label="Profile"
                  className="p-0.5"
                >
                  {user?.picture ? (
                    <img
                      src={(user.picture || '').replace(/^http:\/\//, 'https://')}
                      alt={user.name || 'User'}
                      loading="lazy"
                      decoding="async"
                      width="26"
                      height="26"
                      className="rounded-full object-cover h-[26px] w-[26px]"
                    />
                  ) : (
                    <User className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>
                <ProfileDropdown
                  isOpen={showProfileMenu}
                  onClose={onProfileClose}
                  onLogout={onLogout}
                  className={dropdownClassName}
                  style={dropdownStyle}
                />
              </div>
            ) : (
              <button type="button"
                onClick={onLogin}
                aria-label="Sign in"
                className="p-1"
              >
                <LogIn className="h-5 w-5 text-foreground" />
              </button>
            )}
            <h2 className="text-sm font-semibold text-foreground">Search</h2>
          </div>
          <div className="flex items-center gap-2">
            <MobilePlayStoreLink />
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between px-4 h-10">
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <div className="relative">
                <button type="button"
                  onClick={onProfileClick}
                  aria-label="Profile"
                  className="p-0.5"
                >
                  {user?.picture ? (
                    <img
                      src={(user.picture || '').replace(/^http:\/\//, 'https://')}
                      alt={user.name || 'User'}
                      loading="lazy"
                      decoding="async"
                      width="26"
                      height="26"
                      className="rounded-full object-cover h-[26px] w-[26px]"
                    />
                  ) : (
                    <User className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>
                <ProfileDropdown
                  isOpen={showProfileMenu}
                  onClose={onProfileClose}
                  onLogout={onLogout}
                  className={dropdownClassName}
                  style={dropdownStyle}
                />
              </div>
            ) : (
              <button type="button"
                onClick={onLogin}
                aria-label="Sign in"
                className="p-0.5"
              >
                <LogIn className="h-5 w-5 text-foreground" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <MobilePlayStoreLink />
            <button type="button"
              onClick={onWhatsNewOpen}
              className="w-7 h-7 rounded-full hover:bg-[#1f1f1f] flex items-center justify-center transition-colors"
              aria-label="What's New"
            >
              <Bell size={18} className="text-white transition-colors" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

interface BottomPlayerNavProps {
  hasActiveSong: boolean;
  currentSong: any;
  isPlaying: boolean;
  albumColors: any;
  deviceLabel: string;
  deviceType: AudioOutputDeviceType;
  togglePlay: () => void;
  onSongTap: () => void;
  onShowOutputPicker: () => void;
  onShowQueue: () => void;
  leftNavItems: NavItem[];
  rightNavItems: NavItem[];
  isActive: (path: string) => boolean;
  moodIconMaskStyle: React.CSSProperties;
}

const BottomPlayerNav = ({
  hasActiveSong,
  currentSong,
  isPlaying,
  albumColors,
  deviceLabel,
  deviceType,
  togglePlay,
  onSongTap,
  onShowOutputPicker,
  onShowQueue,
  leftNavItems,
  rightNavItems,
  isActive,
  moodIconMaskStyle,
}: BottomPlayerNavProps) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 flex flex-col justify-end pointer-events-none md:hidden pb-2">
      {/* Floating Navigation Pill */}
      <div className="w-full flex justify-center pointer-events-auto">
        <div className="nav-container">
          {/* Background Layer */}
          <div className="nav-background"></div>

          {/* Combined Mobile Player Segment */}
          {hasActiveSong && currentSong && (
            <div className="relative z-20 w-full border-b border-white/5 bg-[#101522]/45">
              {/* Album Color Tint */}
              <div
                className="absolute inset-0 opacity-30 mix-blend-screen"
                style={{
                  background: `linear-gradient(90deg, ${albumColors.primary || 'transparent'} 0%, transparent 72%)`,
                  transition: 'background 320ms ease',
                }}
              />

              {/* Player Content */}
              <div className="relative px-3 flex items-center justify-between w-full h-[48px]">
                {/* Left: Album Art + Song Info */}
                <button
                  type="button"
                  className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer touch-manipulation appearance-none border-0 bg-transparent p-0 text-left"
                  onClick={onSongTap}
                  aria-label={`Open details for ${currentSong.title}`}
                >
                  <div className="h-full w-[42px] -ml-3 flex-shrink-0 overflow-hidden rounded-none shadow-none">
                    <img
                      src={(currentSong.imageUrl || '').replace(/^http:\/\//, 'https://')}
                      alt={currentSong.title}
                      className="w-full h-full object-cover"
                      loading="eager"
                      decoding="async"
                      width="42"
                      height="42"
                    />
                  </div>
                  <div className="flex-1 min-w-0 overflow-hidden mr-2">
                    <div className="w-full overflow-hidden mb-0" style={{ color: albumColors.text || '#ffffff' }}>
                      <PingPongScroll
                        text={currentSong.title}
                        className="text-[11px] font-bold leading-tight py-0.5"
                        velocity={15}
                      />
                    </div>
                    <div className="mt-0" style={{ color: 'color-mix(in srgb, ' + (albumColors.text || '#ffffff') + ', transparent 35%)' }}>
                      <PingPongScroll
                        text={currentSong.artist}
                        className="text-[9px] font-medium leading-tight"
                        velocity={12}
                      />
                    </div>
                  </div>
                </button>

                {/* Right: Controls */}
                <div className="flex items-center gap-1" style={{ color: albumColors.text || '#ffffff', transition: 'color 300ms ease' }}>
                  <button type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePlay();
                    }}
                    className="p-2 transition-transform duration-200 active:scale-90 touch-manipulation"
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? (
                      <Pause className="h-4.5 w-4.5" fill="currentColor" />
                    ) : (
                      <Play className="h-4.5 w-4.5 ml-0.5" fill="currentColor" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onShowOutputPicker();
                    }}
                    className="p-1.5 transition-transform duration-200 active:scale-90 opacity-90 touch-manipulation"
                    aria-label={`Open output devices. Current output: ${deviceLabel}`}
                    title={deviceLabel}
                  >
                    <OutputIcon type={deviceType} />
                  </button>
                  <button type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onShowQueue();
                    }}
                    className="p-2 transition-transform duration-200 active:scale-90 opacity-90 touch-manipulation"
                    aria-label="Open queue"
                  >
                    <ListMusic className="h-4.5 w-4.5" />
                  </button>
                </div>
              </div>

              {/* Progress Bar Divider */}
              <MobileProgressBar />
            </div>
          )}

          {/* Nav Items Inline */}
          <nav className="nav-content w-full flex justify-between">
            {/* Left Side */}
            <div className="flex flex-1 justify-evenly items-center">
              {leftNavItems.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex flex-col items-center justify-center gap-0.5 transition-all duration-300 flex-1 touch-manipulation select-none',
                    isActive(item.path) ? 'text-white' : 'text-[#888] hover:text-white'
                  )}
                >
                  <item.icon
                    className={cn('h-[17px] w-[17px] transition-transform duration-300', isActive(item.path) && 'scale-110')}
                    strokeWidth={isActive(item.path) ? 2.5 : 2}
                  />
                  <span className="text-[7.5px] font-medium tracking-wide">
                    {item.label}
                  </span>
                </Link>
              ))}
            </div>

            {/* Central AI Button - Icon-only gradient glow */}
            <Link
              to="/mood-playlist"
              aria-label="AI Mood"
              className="flex items-center justify-center group flex-shrink-0 transition-transform duration-300 active:scale-95 px-1.5 touch-manipulation select-none"
            >
              <span className="relative flex items-center justify-center w-[40px] h-[40px] sm:w-[42px] sm:h-[42px]">
                <span
                  className="relative z-10 w-[32px] h-[32px] sm:w-[34px] sm:h-[34px] bg-gradient-to-br from-[#ff7de8] via-[#b792ff] to-[#72c8ff] transition-transform duration-300 group-hover:scale-110 drop-shadow-[0_0_8px_rgba(255,132,232,0.52)]"
                  style={moodIconMaskStyle}
                />
              </span>
            </Link>

            {/* Right Side */}
            <div className="flex flex-1 justify-evenly items-center">
              {rightNavItems.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex flex-col items-center justify-center gap-0.5 transition-all duration-300 flex-1 touch-manipulation select-none',
                    isActive(item.path) ? 'text-white' : 'text-[#888] hover:text-white'
                  )}
                >
                  <item.icon
                    className={cn('h-[17px] w-[17px] transition-transform duration-300', isActive(item.path) && 'scale-110')}
                    strokeWidth={isActive(item.path) ? 2.5 : 2}
                  />
                  <span className="text-[7.5px] font-medium tracking-wide">
                    {item.label}
                  </span>
                </Link>
              ))}
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
};

const MobileNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const { isPlaying, currentSong } = usePlayerSync();
  const { isAuthenticated, user } = useAuth();
  const [state, setState] = useState({
    showSongDetails: false,
    showProfileMenu: false,
    showQueue: false,
    showOutputPicker: false,
    showWhatsNew: false,
  });
  const { showSongDetails, showProfileMenu, showQueue, showOutputPicker, showWhatsNew } = state;
  const albumColors = useAlbumColors(currentSong?.imageUrl);
  const { deviceLabel, deviceType } = useAudioOutputDevice(!!currentSong && isPlaying);

  // Check if we have an active song to add padding to the bottom nav
  const hasActiveSong = !!currentSong;

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (showProfileMenu) {
        setState(prev => ({ ...prev, showProfileMenu: false }));
      }
    };

    // Add event listener only when profile menu is open
    if (showProfileMenu) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showProfileMenu]);

  const pathname = location.pathname;

  const isActive = React.useCallback((path: string) => {
    if (path === '/home' && pathname === '/home') return true;
    if (path !== '/home' && pathname.startsWith(path)) return true;
    return false;
  }, [pathname]);

  // Show compact top header on specific routes
  const isLibraryRoute = pathname.startsWith('/library');
  const isSearchRoute = pathname.startsWith('/search');
  const isLikedRoute = pathname.startsWith('/liked-songs');
  const showMobileTopHeader = (
    pathname === '/home' ||
    pathname === '/' ||
    isLibraryRoute ||
    isSearchRoute
  );



  // Handle user login
  const handleLogin = () => {
    navigate('/login');
  };

  // Handle logout
  const handleLogout = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      // Navigate to welcome page first for faster perceived performance
      setState(prev => ({ ...prev, showProfileMenu: false }));
      navigate('/', { replace: true });

      // Then perform the actual logout
      const { signOut } = await import('@/services/hybridAuthService');
      const result = await signOut();
      if (!result.success) {
        // Error during logout
      }
    } catch (error) {
      // Still close the menu and reset auth store
      setState(prev => ({ ...prev, showProfileMenu: false }));
    }
  };

  // (removed unused search click handler)



  // Handle song tap to open song details view
  const handleSongTap = () => {
    if (currentSong) {
      setState(prev => ({ ...prev, showSongDetails: true }));
    }
  };



  // Handle profile click
  const handleProfileClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setState(prev => ({ ...prev, showProfileMenu: !prev.showProfileMenu }));
  };

  return (
    <>
      {showWhatsNew && (
        <Suspense fallback={null}>
          <WhatsNewDialog open={showWhatsNew} onOpenChange={(val) => setState(prev => ({ ...prev, showWhatsNew: val }))} />
        </Suspense>
      )}

      {showSongDetails && (
        <Suspense fallback={null}>
          <SongDetailsView
            isOpen={showSongDetails}
            onClose={() => setState(prev => ({ ...prev, showSongDetails: false }))}
          />
        </Suspense>
      )}

      {showQueue && (
        <Suspense fallback={null}>
          <QueueDrawer
            isOpen={showQueue}
            onClose={() => setState(prev => ({ ...prev, showQueue: false }))}
          />
        </Suspense>
      )}
      {showOutputPicker && (
        <Suspense fallback={null}>
          <AudioOutputPicker
            isOpen={showOutputPicker}
            onClose={() => setState(prev => ({ ...prev, showOutputPicker: false }))}
          />
        </Suspense>
      )}

      <style>{`
        /* Floating Nav & Player Custom CSS */
        .nav-container {
          position: relative;
          width: 96%;
          max-width: 480px;
          margin: 0 auto 4px auto;
          display: flex;
          flex-direction: column;
          border-radius: 12px 12px 32px 32px;
          overflow: hidden;
          box-shadow: 0 8px 24px rgba(0,0,0,0.5);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .nav-background {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background:
            linear-gradient(180deg,
              color-mix(in srgb, var(--player-primary, #3857a8) 20%, rgba(10, 14, 22, 0.94)) 0%,
              rgba(11, 15, 24, 0.96) 65%,
              rgba(8, 10, 16, 0.98) 100%);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          z-index: 10;
        }

        .nav-content {
          position: relative;
          z-index: 20;
          display: flex;
          justify-content: space-evenly;
          align-items: center;
          height: 48px;
          padding: 0 4px;
        }
      `}</style>

      {/* Mobile Header - Mavrixfy style */}
      <MobileTopHeader
        user={user}
        onProfileClick={handleProfileClick}
        onProfileClose={() => setState(prev => ({ ...prev, showProfileMenu: false }))}
        onLogout={handleLogout}
        onLogin={handleLogin}
        onWhatsNewOpen={() => setState(prev => ({ ...prev, showWhatsNew: true }))}
        dropdownClassName={getDropdownStyles().className}
        dropdownStyle={getDropdownStyles().style}
        routeState={{ showMobileTopHeader: showMobileTopHeader, isLikedRoute: isLikedRoute, isLibraryRoute: isLibraryRoute, isSearchRoute: isSearchRoute, isAuthenticated: isAuthenticated, showProfileMenu: showProfileMenu }}
      />

      {/* Bottom Navigation Wrapper */}
      <BottomPlayerNav
        hasActiveSong={hasActiveSong}
        currentSong={currentSong}
        isPlaying={isPlaying}
        albumColors={albumColors}
        deviceLabel={deviceLabel}
        deviceType={deviceType}
        togglePlay={togglePlay}
        onSongTap={handleSongTap}
        onShowOutputPicker={() => setState(prev => ({ ...prev, showOutputPicker: true }))}
        onShowQueue={() => setState(prev => ({ ...prev, showQueue: true }))}
        leftNavItems={LEFT_NAV_ITEMS}
        rightNavItems={RIGHT_NAV_ITEMS}
        isActive={isActive}
        moodIconMaskStyle={MOOD_ICON_MASK_STYLE}
      />
    </>
  );
};

export default MobileNav;
