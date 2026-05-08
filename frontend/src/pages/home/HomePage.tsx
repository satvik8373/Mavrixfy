import { useEffect, useMemo, useState } from 'react';
import { usePlaylistStore } from '../../stores/usePlaylistStore';
import { PlaylistCard } from '../../components/playlist/PlaylistCard';
import { JioSaavnPlaylistsSection } from '@/components/jiosaavn/JioSaavnPlaylistsSection';
import { RecentlyPlayedCard } from '@/components/RecentlyPlayedCard';
import { HomeJioSaavnCategoryData, jioSaavnService } from '@/services/jioSaavnService';
import { useNavigate, Link } from 'react-router-dom';
import { useLikedSongsStore } from '@/stores/useLikedSongsStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { HorizontalScroll, ScrollItem } from '@/components/ui/horizontal-scroll';
import { SectionWrapper } from '@/components/ui/section-wrapper';
import { recentlyPlayedService } from '@/services/recentlyPlayedService';
import HomeSkeleton from '@/components/skeletons/HomeSkeleton';
import { updateMetaTags, metaPresets } from '@/utils/metaTags';
import { PromotionsBanner } from '@/components/PromotionsBanner';
import { NotificationPermissionBanner } from '@/components/NotificationPermissionBanner';

const ALL_JIOSAAVN_CATEGORIES = [
  'trending',
  'most-viral',
  'most-played',
  'top-dhurandhar',
  'new-arrivals',
  'party',
  'workout',
  'romance',
  'devotional',
  'indie',
  'ghazals',
  'classical',
  'dance',
  'pop',
] as const;

const HOME_JIOSAAVN_TITLES: Record<(typeof ALL_JIOSAAVN_CATEGORIES)[number], string> = {
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
const getRandomHomeCategories = (): typeof ALL_JIOSAAVN_CATEGORIES => {
  const shuffled = shuffleArray([...ALL_JIOSAAVN_CATEGORIES]);
  return shuffled.slice(0, 6) as typeof ALL_JIOSAAVN_CATEGORIES;
};

const HomePage = () => {
  const publicPlaylists = usePlaylistStore(state => state.publicPlaylists);
  const fetchPublicPlaylists = usePlaylistStore(state => state.fetchPublicPlaylists);
  const isLoading = usePlaylistStore(state => state.isLoading);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);

  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [displayItems, setDisplayItems] = useState<any[]>([]);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const navigate = useNavigate();
  const { loadLikedSongs } = useLikedSongsStore();
  const [hoveredColor, setHoveredColor] = useState<string | null>(null);
  const [likedSongsColor, setLikedSongsColor] = useState<string | null>(null);
  const [playerThemeColor, setPlayerThemeColor] = useState<string>('rgb(60, 40, 120)');
  const [homeJioCategories, setHomeJioCategories] = useState<HomeJioSaavnCategoryData[]>([]);
  const [randomCategories, setRandomCategories] = useState<typeof ALL_JIOSAAVN_CATEGORIES | null>(null);
  const homePlaylistCardScrollWidth = 160;
  const homePlaylistCardItemWidth = 160;

  // Load liked songs count
  useEffect(() => {
    loadLikedSongs();
  }, [loadLikedSongs]);

  // Generate random categories on mount
  useEffect(() => {
    setRandomCategories(getRandomHomeCategories());
  }, []);

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
        setPlayerThemeColor(cssColor);
      }
    };

    readThemeColor();
    const observer = new MutationObserver(readThemeColor);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });

    return () => observer.disconnect();
  }, []);

  // Keep home data stable like app: load on first mount, manual refresh handles hard updates.

  useEffect(() => {
    const initializeHomePage = async () => {
      try {
        // Load all content properly without restrictions
        if (usePlaylistStore.getState().shouldRefresh()) {
          await usePlaylistStore.getState().refreshAllData().catch(() => { });
        } else if (publicPlaylists.length === 0) {
          await fetchPublicPlaylists().catch(() => { });
        }
        setHasLoadedOnce(true);
        setIsInitialLoading(false);
      } catch (error) {
        // Error initializing homepage - show content anyway
        setHasLoadedOnce(true);
        setIsInitialLoading(false);
      }
    };

    // Only initialize if we haven't loaded once
    if (!hasLoadedOnce) {
      initializeHomePage();
    } else {
      // If we've loaded before, show content immediately
      setIsInitialLoading(false);
    }
  }, [fetchPublicPlaylists, hasLoadedOnce]);

  useEffect(() => {
    // Calculate recent items inside the effect to avoid dependency issues
    const currentRecentItems = recentlyPlayedService.getDisplayItems(publicPlaylists);
    setDisplayItems(currentRecentItems);

    // Listen for updates to recently played
    const handleRecentlyPlayedUpdated = () => {
      const newItems = recentlyPlayedService.getDisplayItems(publicPlaylists);
      setDisplayItems(newItems);
    };

    // Add event listener
    window.addEventListener('recentlyPlayedUpdated', handleRecentlyPlayedUpdated);

    return () => {
      window.removeEventListener('recentlyPlayedUpdated', handleRecentlyPlayedUpdated);
    };
  }, [publicPlaylists]); // Only depend on publicPlaylists, not recentItems

  useEffect(() => {
    let isCancelled = false;
    const loadHomeJioCategories = async () => {
      try {
        const categories = await jioSaavnService.getHomeJioSaavnCategories({
          forceRefresh: false,
          limitPerCategory: 15,
          realtime: false,
        });

        if (!isCancelled) {
          setHomeJioCategories(categories);
        }
      } catch {
        if (!isCancelled) {
          setHomeJioCategories([]);
        }
      }
    };

    loadHomeJioCategories();

    return () => {
      isCancelled = true;
    };
  }, []);

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
    setHoveredColor(color);
    // If this is the Liked Songs card, save its color as default
    if (isLikedSongs && color) {
      setLikedSongsColor(color);
    }
  };

  // Function to convert any color format to rgba with opacity - simplified
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

  const activeColor = hoveredColor || likedSongsColor || playerThemeColor;

  // Handle playlist click - simplified
  const handlePlaylistClick = (item: any) => {
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

  if (isInitialLoading && !hasLoadedOnce) {
    return (
      <div className="min-h-screen bg-transparent py-4 space-y-6 relative w-full z-10 pb-32 md:pb-8 animate-[fadeIn_0.3s_ease-out]">
        {isAuthenticated && (
          <div className="px-4 md:px-6 mb-6 w-full">
            <HomeSkeleton count={4} type="recently-played" className="" />
          </div>
        )}

        {/* Made for you section skeleton */}
        <div className="px-4 md:px-6">
          <div className="mb-4 space-y-2">
            <div className="h-6 bg-white/10 rounded-full w-32 animate-pulse" />
            <div className="h-4 bg-white/8 rounded-full w-48 animate-pulse" />
          </div>
          <HomeSkeleton count={6} type="card" className="" />
        </div>

        {/* Additional sections skeleton */}
        <div className="px-4 md:px-6">
          <div className="mb-4 space-y-2">
            <div className="h-6 bg-white/10 rounded-full w-28 animate-pulse" />
            <div className="h-4 bg-white/8 rounded-full w-40 animate-pulse" />
          </div>
          <HomeSkeleton count={5} type="card" className="" />
        </div>
      </div>
    );
  }



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
          willChange: 'background'
        }}
      />

      <div className="py-4 space-y-4 relative w-full z-10 pb-32 md:pb-8">
        {/* Filter pills */}
        <div className="px-4 md:px-6 hidden md:flex items-center gap-2 mb-1.5 sticky top-0 z-20 pt-2">
          <button className="px-3 py-1.5 rounded-full bg-[#1ed760] text-black text-[13px] font-bold transition-colors">
            All
          </button>
          <button className="px-3 py-1.5 rounded-full bg-white/10 text-white text-[13px] font-bold hover:bg-white/20 transition-colors">
            Music
          </button>
          <button className="px-3 py-1.5 rounded-full bg-white/10 text-white text-[13px] font-bold hover:bg-white/20 transition-colors">
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

        <div className="w-full overflow-x-hidden">
          {isAuthenticated && (
            <section className="px-4 md:px-6 mb-6 w-full animate-[scaleIn_0.4s_ease-out] pt-4 md:pt-0">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-[6px] w-full max-w-full">
                <RecentlyPlayedCard
                  id="liked-songs"
                  title="Liked Songs"
                  imageUrl="https://res.cloudinary.com/djqq8kba8/image/upload/v1765037854/spotify_clone/playlists/IMG_5130_enrlhm.jpg"
                  subtitle="Playlist"
                  type="playlist"
                  onClick={() => navigate('/liked-songs')}
                  onPlay={() => navigate('/liked-songs')}
                  onHoverChange={(color) => handleColorChange(color, true)}
                />

                {getDisplayedItems().slice(0, 7).map((item: any) => {
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
          )}
          {/* Public Playlists Section */}
          <SectionWrapper
            title="Made for you"
            subtitle="Your personal mix of music"
            showViewAll={true}
            onViewAll={() => navigate('/library')}
          >
            <HorizontalScroll
              itemWidth={homePlaylistCardScrollWidth}
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
                        className="hover:bg-card/50 transition-all duration-200"
                      />
                    </div>
                  </ScrollItem>
                ))
              ) : (isInitialLoading || isLoading) ? (
                <HomeSkeleton count={6} type="card" className="" />
              ) : hasLoadedOnce ? (
                <div className="text-zinc-500 text-sm p-4 w-full text-center animate-[fadeIn_0.3s_ease-out]">
                  No playlists found
                </div>
              ) : (
                <HomeSkeleton count={6} type="card" className="" />
              )}
            </HorizontalScroll>
          </SectionWrapper>

          {/* JioSaavn Sections - Randomized */}
          {(randomCategories || getRandomHomeCategories()).map((categoryId) => {
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
