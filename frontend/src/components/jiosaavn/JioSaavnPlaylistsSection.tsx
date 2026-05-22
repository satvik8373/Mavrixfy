import React, { useReducer, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { JioSaavnPlaylistCard } from './JioSaavnPlaylistCard';
import { JioSaavnPlaylist, jioSaavnService, PlaylistCategory } from '@/services/jioSaavnService';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { HorizontalScroll, ScrollItem } from '@/components/ui/horizontal-scroll';
import { SectionWrapper } from '@/components/ui/section-wrapper';
import { recentlyPlayedService } from '@/services/recentlyPlayedService';

interface JioSaavnPlaylistsSectionProps {
  title?: string;
  categoryId?: string;
  limit?: number;
  showViewAll?: boolean;
  playlistsOverride?: JioSaavnPlaylist[] | null;
  disableAutoFetch?: boolean;
}

type CachedPlaylistPayload = {
  data: JioSaavnPlaylist[];
  updatedAt: number;
  ctxSignature: string;
};

interface PlaylistsSectionState {
  playlists: JioSaavnPlaylist[];
  isLoading: boolean;
  error: string | null;
}

type PlaylistsSectionAction =
  | { type: 'sync'; playlists: JioSaavnPlaylist[]; isLoading?: boolean; error?: string | null }
  | { type: 'loading' }
  | { type: 'loaded'; playlists: JioSaavnPlaylist[] }
  | { type: 'failed' };

const playlistsSectionReducer = (
  state: PlaylistsSectionState,
  action: PlaylistsSectionAction
): PlaylistsSectionState => {
  switch (action.type) {
    case 'sync':
      return {
        ...state,
        playlists: action.playlists,
        isLoading: action.isLoading ?? state.isLoading,
        error: 'error' in action ? action.error ?? null : state.error,
      };
    case 'loading':
      return { ...state, isLoading: true, error: null };
    case 'loaded':
      return { ...state, playlists: action.playlists, isLoading: false, error: null };
    case 'failed':
      return { ...state, isLoading: false, error: 'Failed to load playlists' };
    default:
      return state;
  }
};

const CACHE_PREFIX = 'jiosaavn-cache-';

const CATEGORY_TTL_MS: Record<string, number> = {
  trending: 10 * 60 * 1000,         // 10 min (was 30) - show fresh content
  'most-viral': 12 * 60 * 1000,     // 12 min (was 45) - fresh viral content
  'most-played': 15 * 60 * 1000,    // 15 min (was 60) - regular refresh
  'top-dhurandhar': 15 * 60 * 1000, // 15 min (was 60)
  'new-arrivals': 12 * 60 * 1000,   // 12 min (was 45) - always fresh
  bollywood: 15 * 60 * 1000,        // 15 min (was 60)
  romantic: 15 * 60 * 1000,         // 15 min (was 60)
  punjabi: 15 * 60 * 1000,          // 15 min (was 60)
};

function getContextSignature(categoryId: string): string {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();

  const timeSlot =
    hour >= 5 && hour < 12 ? 'morning' :
    hour >= 12 && hour < 17 ? 'afternoon' :
    hour >= 17 && hour < 22 ? 'evening' : 'night';

  const isWeekend = day === 0 || day === 6;

  let locale = 'en';
  try {
    locale = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase();
  } catch {
    // Keep fallback locale.
  }

  let languageBias = 'english';
  if (isWeekend) {
    languageBias = 'punjabi';
  } else if (locale.startsWith('hi') || locale.startsWith('pa')) {
    languageBias = 'hindi';
  }

  // Match app signature style.
  return `${categoryId}|v5|${timeSlot}|${isWeekend ? 'weekend' : 'weekday'}|${languageBias}`;
}

function getCacheKey(categoryId: string): string {
  return `${CACHE_PREFIX}${categoryId}`;
}

function getTtlMs(categoryId: string): number {
  return CATEGORY_TTL_MS[categoryId] || (45 * 60 * 1000);
}

function readCachedPlaylists(categoryId: string): CachedPlaylistPayload | null {
  const key = getCacheKey(categoryId);
  const raw = localStorage.getItem(key);

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as CachedPlaylistPayload;
      if (
        Array.isArray(parsed?.data) &&
        typeof parsed?.updatedAt === 'number' &&
        typeof parsed?.ctxSignature === 'string'
      ) {
        return parsed;
      }
    } catch {
      // Fall back to legacy cache shape.
    }
  }

  // Backward compatibility with old cache format.
  const legacyData = localStorage.getItem(`jiosaavn-${categoryId}`);
  const legacyTime = localStorage.getItem(`jiosaavn-${categoryId}-time`);
  if (!legacyData || !legacyTime) return null;

  try {
    const parsedData = JSON.parse(legacyData) as JioSaavnPlaylist[];
    const updatedAt = Number.parseInt(legacyTime, 10);
    if (!Array.isArray(parsedData) || Number.isNaN(updatedAt)) {
      return null;
    }

    return {
      data: parsedData,
      updatedAt,
      ctxSignature: 'legacy',
    };
  } catch {
    return null;
  }
}

function writeCachedPlaylists(categoryId: string, payload: CachedPlaylistPayload): void {
  localStorage.setItem(getCacheKey(categoryId), JSON.stringify(payload));

  // Also keep legacy keys updated for backward compatibility with old readers.
  localStorage.setItem(`jiosaavn-${categoryId}`, JSON.stringify(payload.data));
  localStorage.setItem(`jiosaavn-${categoryId}-time`, String(payload.updatedAt));
}

function isStale(cache: CachedPlaylistPayload, categoryId: string, nextSignature: string): boolean {
  const ttlMs = getTtlMs(categoryId);
  const ageMs = Date.now() - cache.updatedAt;
  const signatureChanged = cache.ctxSignature !== nextSignature;
  return ageMs > ttlMs || signatureChanged;
}

export const JioSaavnPlaylistsSection: React.FC<JioSaavnPlaylistsSectionProps> = ({
  title,
  categoryId = 'trending',
  limit = 10,
  showViewAll = true,
  playlistsOverride = null,
  disableAutoFetch = false,
}) => {
  const category = jioSaavnService.getCategoryById(categoryId) || null;
  const [state, dispatchSection] = useReducer(playlistsSectionReducer, {
    playlists: (() => {
      if (Array.isArray(playlistsOverride)) {
        return playlistsOverride.slice(0, limit);
      }
      if (disableAutoFetch) {
        return [];
      }
      const cached = readCachedPlaylists(categoryId);
      return cached?.data?.slice(0, limit) || [];
    })() as JioSaavnPlaylist[],
    isLoading: false,
    error: null as string | null,
  });
  const { playlists, isLoading, error } = state;
  const navigate = useNavigate();
  const cardScrollWidth = 160;
  const cardItemWidth = 160;

  useEffect(() => {
    if (Array.isArray(playlistsOverride)) {
      dispatchSection({
        type: 'sync',
        playlists: playlistsOverride.slice(0, limit),
        isLoading: false,
        error: null,
      });
      return;
    }

    if (disableAutoFetch) {
      dispatchSection({
        type: 'sync',
        playlists: [],
        isLoading: false,
      });
      return;
    }

    const cached = readCachedPlaylists(categoryId);
    dispatchSection({
      type: 'sync',
      playlists: cached?.data?.length ? cached.data.slice(0, limit) : [],
    });

    const ctxSignature = getContextSignature(categoryId);
    fetchPlaylists({ forceRefresh: true, ctxSignature });
  }, [categoryId, disableAutoFetch, limit, playlistsOverride, fetchPlaylists]);

  const fetchPlaylists = React.useCallback(async (opts?: { forceRefresh?: boolean; ctxSignature?: string }) => {
    const forceRefresh = opts?.forceRefresh ?? false;
    const ctxSignature = opts?.ctxSignature ?? getContextSignature(categoryId);

    try {
      dispatchSection({ type: 'loading' });

      let data: JioSaavnPlaylist[];
      
      // Use optimized methods with timeout for better performance
      const fetchPromise = jioSaavnService.getFreshPlaylistsByCategory(categoryId, limit, true);

      // Add timeout to prevent slow loading
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), 10000)
      );

      try {
        data = await Promise.race([fetchPromise, timeoutPromise]);
      } catch (timeoutError) {
        // Timeout fetching playlists, using fallback
        // Fast fallback
        if (categoryId === 'trending') {
          data = await jioSaavnService.searchPlaylists('trending now', limit, true);
        } else {
          data = await jioSaavnService.searchPlaylists(categoryId, limit, true);
        }
      }
      
      // Always shuffle results for variety and randomness
      const shufflePlaylistsArray = (playlists: JioSaavnPlaylist[]): JioSaavnPlaylist[] => {
        const shuffled = [...playlists];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
      };
      
      data = shufflePlaylistsArray(data);
      
      // Limit the results if needed
      if (data.length > limit) {
        data = data.slice(0, limit);
      }
      
      dispatchSection({ type: 'loaded', playlists: data });
      
      writeCachedPlaylists(categoryId, {
        data,
        updatedAt: Date.now(),
        ctxSignature,
      });
    } catch (err) {
      dispatchSection({ type: 'failed' });
      toast.error('Failed to load playlists');
    }
  }, [categoryId, limit]);



  const handlePlaylistClick = (playlist: JioSaavnPlaylist) => {
    // Add to recently played
    recentlyPlayedService.addJioSaavnPlaylist(playlist);
    
    // Navigate to JioSaavn playlist page
    navigate(`/jiosaavn/playlist/${playlist.id}`, {
      state: { playlist }
    });
  };

  const handlePlayPlaylist = async (playlist: JioSaavnPlaylist) => {
    try {
      toast.loading('Loading playlist...', { id: 'jiosaavn-play' });

      // Fetch playlist details with songs
      const playlistDetails = await jioSaavnService.getPlaylistDetails(playlist.id);

      if (playlistDetails.songs && playlistDetails.songs.length > 0) {
        // Convert first song and play
        jioSaavnService.convertToAppSong(playlistDetails.songs[0]);

        // You can integrate with your player store here
        // For now, just show success
        toast.success(`Playing "${playlist.name}"`, { id: 'jiosaavn-play' });

        // Navigate to playlist page to show all songs
        navigate(`/jiosaavn/playlist/${playlist.id}`, {
          state: { playlist, autoPlay: true }
        });
      } else {
        toast.error('No songs found in playlist', { id: 'jiosaavn-play' });
      }
    } catch (error) {
      toast.error('Failed to play playlist', { id: 'jiosaavn-play' });
    }
  };

  const handleViewAll = () => {
    navigate('/jiosaavn/playlists', {
      state: { category: categoryId, title: getSectionTitle() }
    });
  };

  const handleRefresh = () => {
    // Clear ALL JioSaavn cache for a complete refresh
    const cacheKeys = Object.keys(localStorage).filter(
      (key) => key.startsWith('jiosaavn-') || key.startsWith(CACHE_PREFIX)
    );
    cacheKeys.forEach(key => {
      localStorage.removeItem(key);
    });
    
    // Force a fresh fetch with randomization
    dispatchSection({ type: 'sync', playlists: [] }); // Clear current playlists to show loading
    fetchPlaylists({ forceRefresh: true, ctxSignature: getContextSignature(categoryId) });
  };

  const getSectionTitle = () => {
    if (title) return title;
    if (category) return `${category.icon} ${category.name}`;
    return 'Mavrixfy Playlists';
  };

  const getSectionDescription = () => {
    if (category) return category.description;
    return 'Discover curated playlists from Mavrixfy';
  };

  if (error && playlists.length === 0) {
    return (
      <SectionWrapper
        title={getSectionTitle()}
        showViewAll={false}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1">
            <div className="bg-destructive/10 border border-destructive/20 text-destructive-foreground text-sm rounded-md px-4 py-3">
              {error}. Check your internet connection and try again.
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            className="text-muted-foreground hover:text-foreground ml-4"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </SectionWrapper>
    );
  }

  if (playlists.length === 0 && !isLoading) {
    return null;
  }

  return (
    <SectionWrapper
      title={getSectionTitle()}
      showViewAll={showViewAll}
      onViewAll={handleViewAll}
    >
      <HorizontalScroll
        itemWidth={cardScrollWidth}
        gap={10}
        showArrows={true}
        snapToItems={false}
        edgeToEdge={true}
      >
        {isLoading ? (
          // Loading skeleton
          Array.from({ length: 8 }).map((_, i) => (
            <ScrollItem key={i} width={cardItemWidth}>
              <div className="space-y-2 p-1">
                <div 
                  className="w-full aspect-square rounded-md bg-muted animate-pulse" 
                  style={{animationDelay: `${i * 0.1}s`}}
                />
                <div 
                  className="h-3 rounded bg-muted animate-pulse" 
                  style={{animationDelay: `${i * 0.1 + 0.1}s`}}
                />
                <div 
                  className="h-2 rounded bg-muted animate-pulse w-3/4" 
                  style={{animationDelay: `${i * 0.1 + 0.2}s`}}
                />
              </div>
            </ScrollItem>
          ))
        ) : (
          // Actual playlist cards
          playlists.map((playlist) => (
            <ScrollItem key={playlist.id} width={cardItemWidth}>
              <JioSaavnPlaylistCard
                playlist={playlist}
                onClick={handlePlaylistClick}
                onPlay={handlePlayPlaylist}
                showDescription={true}
              />
            </ScrollItem>
          ))
        )}
      </HorizontalScroll>
    </SectionWrapper>
  );
};
