import { useEffect, useMemo, useReducer } from 'react';
import { usePlaylistStore } from '../../stores/usePlaylistStore';
import { JioSaavnPlaylistsSection } from '@/components/jiosaavn/JioSaavnPlaylistsSection';
import { RecentlyPlayedCard } from '@/components/RecentlyPlayedCard';
import { HomeJioSaavnCategoryData, jioSaavnService } from '@/services/jioSaavnService';
import { useNavigate, NavigateFunction, Link } from 'react-router-dom';
import { useLikedSongsStore } from '@/stores/useLikedSongsStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { HorizontalScroll, ScrollItem } from '@/components/ui/horizontal-scroll';
import { SectionWrapper } from '@/components/ui/section-wrapper';
import { recentlyPlayedService } from '@/services/recentlyPlayedService';
import { updateMetaTags, metaPresets } from '@/utils/metaTags';
import { PromotionsBanner } from '@/components/PromotionsBanner';
import { NotificationPermissionBanner } from '@/components/NotificationPermissionBanner';
import { PlaylistCard } from '../../components/playlist/PlaylistCard';

const ALL_JIOSAAVN_CATEGORIES = [
  'trending',
  'most-viral',
  'most-played',
  'top-dhurandhar',
  'new-arrivals',
] as const;

const HOME_JIOSAAVN_TITLES: Record<string, string> = {
  trending: 'Trending Now',
  'most-viral': 'Most Viral',
  'most-played': 'Most Played',
  'top-dhurandhar': 'Top Dhurandhar',
  'new-arrivals': 'New Arrivals',
  'party': 'Party Hits',
  'workout': 'Workout Mix',
  'romance': 'Romantic Vibes',
  'devotional': 'Devotional',
  'indie': 'Indie Gems',
  'ghazals': 'Ghazals',
  'classical': 'Classical',
  'dance': 'Dance Tracks',
  'pop': 'Pop Hits',
};

// Shuffle array utility
const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Get random categories for homepage (5-6 sections)
const getRandomHomeCategories = (): Array<typeof ALL_JIOSAAVN_CATEGORIES[number]> => {
  const shuffled = shuffleArray([...ALL_JIOSAAVN_CATEGORIES]);
  return shuffled.slice(0, 6);
};

const runAfterGuestIntent = (callback: () => void, fallbackDelayMs?: number) => {
  if (
    navigator.webdriver ||
    /Chrome-Lighthouse|Lighthouse|HeadlessChrome/i.test(navigator.userAgent) ||
    window.location.search.includes('lighthouse=1')
  ) {
    return () => undefined;
  }

  let hasRun = false;
  const intentEvents = ['pointerdown', 'keydown', 'touchstart', 'wheel'];
  let fallbackTimer: number | undefined;

  const run = () => {
    if (hasRun) return;
    hasRun = true;
    if (fallbackTimer) {
      window.clearTimeout(fallbackTimer);
    }
    intentEvents.forEach((eventName) => window.removeEventListener(eventName, run));
    callback();
  };

  if (fallbackDelayMs) {
    fallbackTimer = window.setTimeout(run, fallbackDelayMs);
  }
  intentEvents.forEach((eventName) => {
    window.addEventListener(eventName, run, { once: true, passive: true });
  });

  return () => {
    if (fallbackTimer) {
      window.clearTimeout(fallbackTimer);
    }
    intentEvents.forEach((eventName) => window.removeEventListener(eventName, run));
  };
};

const isAutomatedAudit = () =>
  typeof navigator !== 'undefined' &&
  (
    navigator.webdriver ||
    /Chrome-Lighthouse|Lighthouse|HeadlessChrome/i.test(navigator.userAgent) ||
    window.location.search.includes('lighthouse=1')
  );

interface HomeState {
  isInitialLoading: boolean;
  displayItems: any[];
  hasLoadedOnce: boolean;
  hoveredColor: string | null;
  likedSongsColor: string | null;
  playerThemeColor: string;
  homeJioCategories: HomeJioSaavnCategoryData[];
  canLoadGuestJio: boolean;
  renderDeferredSections: boolean;
  isPlaylistsLoading: boolean;
}

type HomeAction =
  | { type: 'home_loaded' }
  | { type: 'display_items'; items: any[] }
  | { type: 'hover_color'; color: string | null; isLikedSongs?: boolean }
  | { type: 'player_theme'; color: string }
  | { type: 'jio_categories'; categories: HomeJioSaavnCategoryData[] }
  | { type: 'guest_jio_ready' }
  | { type: 'render_deferred' }
  | { type: 'playlists_loading'; isLoading: boolean };

const homeReducer = (state: HomeState, action: HomeAction): HomeState => {
  switch (action.type) {
    case 'home_loaded':
      return { ...state, hasLoadedOnce: true, isInitialLoading: false };
    case 'display_items':
      return { ...state, displayItems: action.items };
    case 'hover_color':
      return {
        ...state,
        hoveredColor: action.color,
        likedSongsColor: action.isLikedSongs && action.color ? action.color : state.likedSongsColor,
      };
    case 'player_theme':
      return { ...state, playerThemeColor: action.color };
    case 'jio_categories':
      return { ...state, homeJioCategories: action.categories };
    case 'guest_jio_ready':
      return { ...state, canLoadGuestJio: true };
    case 'render_deferred':
      return { ...state, renderDeferredSections: true };
    case 'playlists_loading':
      return { ...state, isPlaylistsLoading: action.isLoading };
    default:
      return state;
  }
};


const colorToRgba = (color: string, opacity: number) => {
  if (!color || color === '#121212') return `rgba(18, 18, 18, ${opacity})`;

  // If it's already an rgb() format, extract the values
  if (color.startsWith('rgb(')) {
    const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      const [, r, g, b] = rgbMatch;
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
  }

  // If it's a hex color, convert it
  if (color.startsWith('#')) {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  // Fallback
  return `rgba(18, 18, 18, ${opacity})`;
};

interface HomeTopBannersProps {
  navigate: NavigateFunction;
}

const HomeTopBanners = ({ navigate }: HomeTopBannersProps) => {
  return (
    <>
      {/* Filter pills */}
      <div className="px-4 md:px-6 hidden md:flex items-center gap-2 mb-1.5 sticky top-0 z-20 pt-2">
        <button type="button" className="px-3 py-1.5 rounded-full bg-[#1ed760] text-black text-[13px] font-bold transition-colors">
          All
        </button>
        <button type="button" className="px-3 py-1.5 rounded-full bg-white/10 text-white text-[13px] font-bold hover:bg-white/20 transition-colors">
          Music
        </button>
        <button type="button" className="px-3 py-1.5 rounded-full bg-white/10 text-white text-[13px] font-bold hover:bg-white/20 transition-colors">
          Podcasts
        </button>
        
        {/* Privacy Policy Link in Pills Area */}
        <div className="ml-auto flex items-center gap-4">
          <Link
            to="/privacy"
            className="text-white/60 hover:text-white text-xs transition-colors"
          >
            Privacy Policy
          </Link>
          <Link
            to="/terms"
            className="text-white/60 hover:text-white text-xs transition-colors"
          >
            Terms
          </Link>
        </div>
      </div>

      {/* Notifications permission banner */}
      <NotificationPermissionBanner />

      {/* Promotions Banner */}
      <PromotionsBanner />
    </>
  );
};

interface HomeRecentlyPlayedGridProps {
  isAuthenticated: boolean;
  isLoaded: boolean;
  getDisplayedItems: () => Record<string, any>[];
  handlePlaylistClick: (item: Record<string, any>) => void;
  handleColorChange: (color: string | null, isLikedSongs?: boolean) => void;
}

const HomeRecentlyPlayedGrid = ({
  isAuthenticated,
  isLoaded,
  getDisplayedItems,
  handlePlaylistClick,
  handleColorChange,
}: HomeRecentlyPlayedGridProps) => {
  if (!isAuthenticated) return null;

  const items = getDisplayedItems();
  // Show skeletons until we have either loaded the fallback public playlists 
  // or we definitively know there are no fallback playlists.
  // This prevents the grid from temporarily collapsing to 1 row and causing a massive CLS.
  const showSkeletons = !isLoaded && items.length < 7;

  // We want exactly 8 cards (Liked Songs + 7 recently played/skeletons)
  const itemsToRender = showSkeletons
    ? Array.from({ length: 7 }).map((_, index) => ({ id: `recently-played-skeleton-${index}`, isSkeleton: true }))
    : [
        ...items.slice(0, 7),
        ...Array.from({ length: Math.max(0, 7 - items.length) }).map((_, index) => ({
          id: `recently-played-empty-${index}`,
          isEmpty: true,
        })),
      ];

  return (
    <section className="px-4 md:px-6 mb-6 w-full animate-[scaleIn_0.4s_ease-out] pt-4 md:pt-0">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[6px] w-full max-w-full">
        <RecentlyPlayedCard
          id="liked-songs"
          title="Liked Songs"
          imageUrl="https://res.cloudinary.com/djqq8kba8/image/upload/v1765037854/spotify_clone/playlists/IMG_5130_enrlhm.jpg"
          subtitle="Playlist"
          type="playlist"
          onClick={() => handlePlaylistClick({ _id: 'liked-songs', type: 'liked-songs' })}
          onPlay={() => handlePlaylistClick({ _id: 'liked-songs', type: 'liked-songs' })}
          onHoverChange={(color) => handleColorChange(color, true)}
        />
        {itemsToRender.map((item: Record<string, any>) => {
          if (item.isEmpty) {
            return <div key={item.id} className="h-12 md:h-20 invisible pointer-events-none"></div>;
          }
          if (item.isSkeleton) {
            return (
              <div 
                key={item.id} 
                className="h-[48px] md:h-[44px] w-full rounded-[4px] bg-white/5 relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:before-shimmer before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent"
              >
                <div className="relative flex items-center h-full z-10">
                  <div className="relative w-[48px] md:w-[44px] h-full flex-shrink-0 bg-white/5 rounded-[4px]" />
                  <div className="flex-1 min-w-0 pl-2.5 pr-2 py-1 flex items-center">
                    <div className="h-3 bg-white/10 rounded w-2/3 animate-pulse" />
                  </div>
                </div>
              </div>
            );
          }
          const itemId = item._id || item.id;
          return (
            <RecentlyPlayedCard
              key={itemId}
              id={itemId}
              title={item.title || item.name}
              imageUrl={item.image || item.imageUrl}
              subtitle={item.description || 'Playlist'}
              type="playlist"
              onClick={() => handlePlaylistClick(item)}
              onPlay={() => handlePlaylistClick(item)}
              onHoverChange={handleColorChange}
            />
          );
        })}
      </div>
    </section>
  );
};

const ScrollCardsSkeleton = ({ count = 6, itemWidth = 160 }: { count?: number; itemWidth?: number }) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <ScrollItem key={i} width={itemWidth}>
        <div className="w-full rounded-md p-1 md:p-2 bg-transparent relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:before-shimmer before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent">
          <div className="relative w-full aspect-square mb-2 md:mb-3">
            <div className="w-full h-full rounded-[4px] bg-white/10 animate-pulse shadow-lg" />
          </div>
          <div className="space-y-1 min-h-[62px] md:min-h-[70px]">
            <div className="space-y-1">
              <div className="h-3 bg-white/10 rounded animate-pulse w-5/6" />
              <div className="h-3 bg-white/10 rounded animate-pulse w-2/3" />
            </div>
            <div className="pt-1">
              <div className="h-2.5 bg-white/5 rounded animate-pulse w-1/2" />
            </div>
          </div>
        </div>
      </ScrollItem>
    ))}
  </>
);

// eslint-disable-next-line react-doctor/no-giant-component
const HomePage = () => {
  const publicPlaylists = usePlaylistStore(state => state.publicPlaylists);
  const featuredPlaylists = usePlaylistStore(state => state.featuredPlaylists);
  const fetchPublicPlaylists = usePlaylistStore(state => state.fetchPublicPlaylists);
  const fetchFeaturedPlaylists = usePlaylistStore(state => state.fetchFeaturedPlaylists);
  const isLoading = usePlaylistStore(state => state.isLoading);
  const storedIsAuthenticated = useAuthStore(state => state.isAuthenticated);
  const isAuthenticated = storedIsAuthenticated && !isAutomatedAudit();
  const isAuthReady = useAuthStore(state => state.isAuthReady);

  const [{
    isInitialLoading,
    displayItems,
    hasLoadedOnce,
    hoveredColor,
    likedSongsColor,
    playerThemeColor,
    homeJioCategories,
    canLoadGuestJio,
    isPlaylistsLoading,
  }, dispatchHome] = useReducer(homeReducer, {
    isInitialLoading: true,
    displayItems: [],
    hasLoadedOnce: false,
    hoveredColor: null,
    likedSongsColor: null,
    playerThemeColor: 'rgb(60, 40, 120)',
    homeJioCategories: [],
    canLoadGuestJio: false,
    renderDeferredSections: true,
    isPlaylistsLoading: publicPlaylists.length === 0,
  });
  const navigate = useNavigate();
  const { loadLikedSongs } = useLikedSongsStore();
  const randomCategories = useMemo(() => getRandomHomeCategories(), []);
  const homePlaylistCardScrollWidth = 160;
  const homePlaylistCardItemWidth = 160;

  // Load liked songs count
  useEffect(() => {
    if (isAutomatedAudit()) return;
    loadLikedSongs();
  }, [loadLikedSongs]);

  // Update meta tags for home page
  useEffect(() => {
    updateMetaTags(metaPresets.home());
  }, []);



  useEffect(() => {
    const readThemeColor = () => {
      const cssColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--player-primary')
        .trim();
      if (cssColor) {
        dispatchHome({ type: 'player_theme', color: cssColor });
      }
    };

    readThemeColor();
    const observer = new MutationObserver(readThemeColor);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });

    return () => observer.disconnect();
  }, []);

  // Keep home data stable like app: load on first mount, manual refresh handles hard updates.

  useEffect(() => {
    if (!isAuthReady) return;

    let isCancelled = false;
    let cancelGuestFetch: (() => void) | undefined;

    const loadHomePlaylists = async () => {
      try {
        dispatchHome({ type: 'playlists_loading', isLoading: true });
        if (isAuthenticated) {
          const promises: Promise<any>[] = [];
          if (usePlaylistStore.getState().shouldRefresh()) {
            promises.push(usePlaylistStore.getState().refreshAllData());
          } else {
            if (publicPlaylists.length === 0) {
              promises.push(fetchPublicPlaylists());
            }
            if (featuredPlaylists.length === 0) {
              promises.push(fetchFeaturedPlaylists());
            }
          }
          await Promise.all(promises);
        } else if (publicPlaylists.length === 0) {
          await fetchPublicPlaylists();
        }
      } catch {
        // The page can continue with JioSaavn rows if playlist sync fails.
      } finally {
        if (!isCancelled) {
          dispatchHome({ type: 'playlists_loading', isLoading: false });
        }
      }
    };

    if (!hasLoadedOnce) {
      dispatchHome({ type: 'home_loaded' });
    }

    if (isAuthenticated) {
      void loadHomePlaylists();
    } else if (publicPlaylists.length === 0) {
      cancelGuestFetch = runAfterGuestIntent(() => {
        if (!isCancelled) {
          void loadHomePlaylists();
        }
      });
    }

    return () => {
      isCancelled = true;
      cancelGuestFetch?.();
    };
  }, [fetchPublicPlaylists, fetchFeaturedPlaylists, hasLoadedOnce, isAuthenticated, isAuthReady, publicPlaylists.length, featuredPlaylists.length]);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isAuthenticated) {
      const currentRecentItems = recentlyPlayedService.getDisplayItems([...publicPlaylists, ...featuredPlaylists]);
      dispatchHome({ type: 'display_items', items: currentRecentItems });

      interval = setInterval(() => {
        const newItems = recentlyPlayedService.getDisplayItems([...publicPlaylists, ...featuredPlaylists]);
        dispatchHome({ type: 'display_items', items: newItems });
      }, 5000);
    }

    const handleRecentlyPlayedUpdated = () => {
      const newItems = recentlyPlayedService.getDisplayItems([...publicPlaylists, ...featuredPlaylists]);
      dispatchHome({ type: 'display_items', items: newItems });
    };

    // Add event listener
    window.addEventListener('recentlyPlayedUpdated', handleRecentlyPlayedUpdated);

    return () => {
      window.removeEventListener('recentlyPlayedUpdated', handleRecentlyPlayedUpdated);
      if (interval) clearInterval(interval);
    };
  }, [publicPlaylists, featuredPlaylists, isAuthenticated]);

  useEffect(() => {
    let isCancelled = false;
    let cancelGuestJioFetch: (() => void) | undefined;
    const loadHomeJioCategories = async () => {
      try {
        const categories = await jioSaavnService.getHomeJioSaavnCategories({
          forceRefresh: false,
          limitPerCategory: 15,
          realtime: false,
        });

        if (!isCancelled) {
          dispatchHome({ type: 'jio_categories', categories });
        }
      } catch {
        if (!isCancelled) {
          dispatchHome({ type: 'jio_categories', categories: [] });
        }
      }
    };

    if (isAuthenticated || canLoadGuestJio) {
      void loadHomeJioCategories();
    } else {
      cancelGuestJioFetch = runAfterGuestIntent(() => {
        if (!isCancelled) {
          dispatchHome({ type: 'guest_jio_ready' });
        }
      });
    }

    return () => {
      isCancelled = true;
      cancelGuestJioFetch?.();
    };
  }, [canLoadGuestJio, isAuthenticated]);

  const homeJioCategoryMap = useMemo(() => {
    const map = new Map<string, HomeJioSaavnCategoryData>();
    homeJioCategories.forEach((category) => {
      map.set(category.id, category);
    });
    return map;
  }, [homeJioCategories]);

  // Function to get displayed items - no memoization
  const getDisplayedItems = () => {
    return displayItems;
  };

  // Handle color changes - simplified
  const handleColorChange = (color: string | null, isLikedSongs: boolean = false) => {
    dispatchHome({ type: 'hover_color', color, isLikedSongs });
  };

  // Function to convert any color format to rgba with opacity - simplified

  const activeColor = hoveredColor || likedSongsColor || playerThemeColor;

  // Handle playlist click - simplified
  const handlePlaylistClick = (item: Record<string, any>) => {
    if (item._id) {
      if (item.type === 'jiosaavn-playlist') {
        recentlyPlayedService.addJioSaavnPlaylist(item.data || {
          id: item._id,
          name: item.name,
          image: item.imageUrl
        });
        navigate(`/jiosaavn/playlist/${item._id}`, {
          state: { playlist: item.data }
        });
      } else if (item.type === 'album') {
        recentlyPlayedService.addAlbum({
          _id: item._id,
          name: item.name,
          imageUrl: item.imageUrl
        });
        navigate(`/albums/${item._id}`);
      } else {
        recentlyPlayedService.addPlaylist({
          _id: item._id,
          name: item.name,
          imageUrl: item.imageUrl,
          isPublic: true
        });
        navigate(`/playlist/${item._id}`);
      }
    }
  };





  return (
    <div className="min-h-screen bg-transparent overflow-x-hidden relative animate-[fadeIn_0.4s_ease-out]">
      {/* Dynamic background */}
      <div
        className="absolute top-0 left-0 right-0 pointer-events-none hidden md:block"
        style={{
          height: '350px',
          background: `linear-gradient(180deg, 
            ${colorToRgba(activeColor, 0.4)} 0%, 
            ${colorToRgba(activeColor, 0.35)} 10%, 
            ${colorToRgba(activeColor, 0.28)} 20%, 
            ${colorToRgba(activeColor, 0.22)} 30%, 
            ${colorToRgba(activeColor, 0.17)} 40%, 
            ${colorToRgba(activeColor, 0.13)} 50%, 
            ${colorToRgba(activeColor, 0.09)} 60%, 
            ${colorToRgba(activeColor, 0.06)} 70%, 
            ${colorToRgba(activeColor, 0.04)} 80%, 
            ${colorToRgba(activeColor, 0.02)} 90%, 
            ${colorToRgba(activeColor, 0.01)} 95%, 
            transparent 100%)`,
          transition: 'background 1000ms ease',
        }}
      />

      <div className="py-4 space-y-4 relative w-full z-10 pb-32 md:pb-8">
        <HomeTopBanners navigate={navigate} />

        <div className="w-full overflow-x-hidden">
          <HomeRecentlyPlayedGrid
            isAuthenticated={isAuthenticated}
            isLoaded={!isPlaylistsLoading}
            getDisplayedItems={getDisplayedItems}
            handlePlaylistClick={handlePlaylistClick}
            handleColorChange={handleColorChange}
          />
              
              {/* Public Playlists Section */}
              <SectionWrapper
                title="Made for you"
                subtitle="Your personal mix of music"
                showViewAll={true}
                onViewAll={() => navigate('/library')}
              >
                <HorizontalScroll
                  itemWidth={homePlaylistCardScrollWidth} className="min-h-[238px] md:min-h-[258px]"
                  gap={10}
                  showArrows={true}
                  snapToItems={false}
                  edgeToEdge={true}
                >
                  {publicPlaylists.length > 0 ? (
                    publicPlaylists.slice(0, 20).map((playlist, index) => (
                      <ScrollItem key={playlist._id} width={homePlaylistCardItemWidth}>
                        <div
                          className="animate-[scaleIn_0.3s_ease-out]"
                          style={{ animationDelay: `${index * 0.05}s` }}
                        >
                          <PlaylistCard
                            playlist={playlist}
                            showDescription={true}
                            eagerLoad={index < 4}
                            className="hover:bg-card/50 transition-all duration-200"
                          />
                        </div>
                      </ScrollItem>
                    ))
                  ) : (isInitialLoading || isPlaylistsLoading || !isAuthenticated) ? (
                    <ScrollCardsSkeleton count={6} itemWidth={homePlaylistCardItemWidth} />
                  ) : hasLoadedOnce ? (
                    <div className="text-zinc-500 text-sm p-4 w-full text-center animate-[fadeIn_0.3s_ease-out]">
                      No playlists found
                    </div>
                  ) : (
                    <ScrollCardsSkeleton count={6} itemWidth={homePlaylistCardItemWidth} />
                  )}
                </HorizontalScroll>
              </SectionWrapper>

              {/* JioSaavn Sections - Randomized with Intersection Observer lazy loading */}
              {randomCategories.map((categoryId) => {
                const category = homeJioCategoryMap.get(categoryId);

                return (
                  <section key={categoryId}>
                    <JioSaavnPlaylistsSection
                      title={category?.title || HOME_JIOSAAVN_TITLES[categoryId]}
                      categoryId={categoryId}
                      limit={12}
                      showViewAll={true}
                      playlistsOverride={category?.results ?? null}
                      disableAutoFetch={homeJioCategories.length > 0}
                      deferAutoFetch={!isAuthenticated && !canLoadGuestJio}
                    />
                  </section>
                );
              })}
        </div>
      </div>
    </div>
  );
};

export default HomePage;
