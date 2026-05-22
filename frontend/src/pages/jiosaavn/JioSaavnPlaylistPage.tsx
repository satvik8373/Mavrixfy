import React, { useReducer, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { 
  Play, 
  Pause, 
  Music, 
  Clock, 
  MoreHorizontal, 
  ListPlus, 
  Download, 
  ChevronLeft, 
  Heart, 
  Share2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ShuffleButton } from '@/components/ShuffleButton';
import { JioSaavnPlaylist, JioSaavnSong, jioSaavnService } from '@/services/jioSaavnService';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { usePlayerSync } from '@/hooks/usePlayerSync';
import { useAlbumColors } from '@/hooks/useAlbumColors';
import { cn } from '@/lib/utils';
import { formatTime } from '@/utils/formatTime';
import { getHighestQualityAudioUrl } from '@/utils/jiosaavnAudio';
import '../../styles/playlist-page.css';
import toast from 'react-hot-toast';
import { recentlyPlayedService } from '@/services/recentlyPlayedService';
import { recommendationItemFromPlaylist, trackRecommendationEvent } from '@/services/recommendationService';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const JIOSAAVN_METRICS_KEY = 'jiosaavn_playlist_metrics:v1';
const LIKED_PLAYLISTS_KEY = 'liked_playlists:v1';
const LEGACY_LIKED_PLAYLISTS_KEY = 'liked_jiosaavn_playlists:v1';
const LIKED_PLAYLISTS_METADATA_KEY = 'liked_playlists_metadata:v1';
const PLAYED_JIOSAAVN_PLAYLISTS_KEY = 'user_played_jiosaavn_playlists:v1';

const readJsonStorage = <T,>(key: string, fallback: T): T => {
  const saved = localStorage.getItem(key);
  return saved ? JSON.parse(saved) : fallback;
};

interface JioSaavnPlaylistState {
  playlist: JioSaavnPlaylist | null;
  songs: JioSaavnSong[];
  isFetchingSongs: boolean;
  error: string | null;
  isLiked: boolean;
  metrics: { likes: number; shares: number; plays: number };
  hasPlayed: boolean;
}

type JioSaavnPlaylistAction =
  | { type: 'loading' }
  | { type: 'loaded'; playlist: JioSaavnPlaylist | null; songs: JioSaavnSong[] }
  | { type: 'failed' }
  | { type: 'hydrate_local'; metrics: JioSaavnPlaylistState['metrics']; isLiked: boolean; hasPlayed: boolean }
  | { type: 'liked'; value: boolean }
  | { type: 'played' }
  | { type: 'metric'; metric: 'likes' | 'shares' | 'plays' };

const jioSaavnPlaylistReducer = (
  state: JioSaavnPlaylistState,
  action: JioSaavnPlaylistAction
): JioSaavnPlaylistState => {
  switch (action.type) {
    case 'loading':
      return { ...state, isFetchingSongs: true, error: null };
    case 'loaded':
      return {
        ...state,
        playlist: action.playlist,
        songs: action.songs,
        isFetchingSongs: false,
        error: null,
      };
    case 'failed':
      return { ...state, isFetchingSongs: false, error: 'Failed to load playlist details' };
    case 'hydrate_local':
      return {
        ...state,
        metrics: action.metrics,
        isLiked: action.isLiked,
        hasPlayed: action.hasPlayed,
      };
    case 'liked':
      return { ...state, isLiked: action.value };
    case 'played':
      return { ...state, hasPlayed: true };
    case 'metric':
      return {
        ...state,
        metrics: {
          ...state.metrics,
          [action.metric]: state.metrics[action.metric] + 1,
        },
      };
    default:
      return state;
  }
};


interface JioSaavnPlaylistHeaderProps {
  playlist: JioSaavnPlaylist | null;
  imageUrl: string;
  metrics: { likes: number; shares: number; plays: number };
  totalSongs: number;
  formattedTotalDuration: string;
  albumColors: { primary: string; secondary: string };
}

const JioSaavnPlaylistHeader = ({
  playlist,
  imageUrl,
  metrics,
  totalSongs,
  formattedTotalDuration,
  albumColors,
}: JioSaavnPlaylistHeaderProps) => {
  return (
    <div
      className="relative pt-12 pb-6 px-4 sm:px-6" 
      style={{
        background: `linear-gradient(180deg, ${albumColors.primary} 0%, hsl(var(--background) / 0.85) 90%)`,
      }}
    >
      <div className="flex flex-col md:flex-row items-start md:items-end gap-6 relative z-10 pb-4">
        {/* Playlist cover image */}
        <div className="w-64 h-64 sm:w-72 sm:h-72 md:w-80 md:h-80 flex-shrink-0 shadow-xl mx-auto md:mx-0 relative">
          <div className="absolute inset-0 shadow-[0_8px_24px_rgba(0,0,0,0.5)] rounded"></div>
          <img
            src={imageUrl}
            alt={playlist?.name || 'Playlist'}
            className="w-full h-full object-cover relative z-10"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/placeholder-playlist.jpg';
            }}
          />
        </div>

        {/* Playlist info */}
        <div className="flex flex-col justify-end text-foreground text-center md:text-left w-full">
          <p className="text-xs sm:text-sm uppercase font-medium mt-2">Public Playlist</p>
          <h1 className="text-3xl sm:text-5xl md:text-7xl font-semibold mt-2 mb-2 sm:mb-4 drop-shadow-md tracking-tight">
            {playlist?.name || 'Loading...'}
          </h1>
          
          <div className="flex items-center gap-1 text-sm text-muted-foreground justify-center md:justify-start flex-wrap">
            <span>{metrics.likes} likes</span>
            <span className="mx-1">•</span>
            <span>{totalSongs} songs,</span>
            <span className="text-muted-foreground ml-1">{formattedTotalDuration}</span>
            {playlist?.language && (
              <>
                <span className="mx-1">•</span>
                <span className="capitalize">{playlist.language}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface JioSaavnPlaylistActionsProps {
  isLiked: boolean;
  totalSongs: number;
  isFetchingSongs: boolean;
  isCurrentPlaylistPlaying: boolean;
  handleShare: () => void;
  handleLike: (e?: React.MouseEvent) => void;
  handlePausePlaylist: () => void;
  handlePlayAll: () => void;
}

const JioSaavnPlaylistActions = ({
  isLiked,
  totalSongs,
  isFetchingSongs,
  isCurrentPlaylistPlaying,
  handleShare,
  handleLike,
  handlePausePlaylist,
  handlePlayAll,
}: JioSaavnPlaylistActionsProps) => {
  return (
    <div className="sticky top-0 z-20 transition-colors duration-300 px-4 sm:px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Left side tools */}
        <div className="flex items-center gap-3 sm:gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="w-12 h-12 rounded-full text-muted-foreground hover:text-foreground transition-colors"
              >
                <MoreHorizontal className="h-6 w-6" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-popover text-popover-foreground border-border">
              <DropdownMenuItem onClick={handleShare} className="hover:bg-accent">
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Right side play button */}
        <div className="flex items-center gap-3 sm:gap-5">
          {/* Heart button */}
          <Button
            variant="ghost"
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full text-muted-foreground hover:text-foreground transition-all duration-300 flex items-center justify-center"
            onClick={handleLike}
          >
            <Heart 
              className="h-6 w-6 sm:h-7 sm:w-7" 
              fill={isLiked ? 'currentColor' : 'none'} 
              stroke={isLiked ? 'none' : 'currentColor'}
              color={isLiked ? '#1DB954' : 'currentColor'} 
            />
          </Button>

          {/* Shuffle button */}
          <ShuffleButton 
            size="lg"
            className="transition-all duration-300"
          />

          {/* Play/Pause button */}
          <Button
            onClick={isCurrentPlaylistPlaying ? handlePausePlaylist : handlePlayAll}
            disabled={totalSongs === 0 || isFetchingSongs}
            className={cn(
              "w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-all shadow-lg",
              "bg-green-500 text-black hover:scale-105 hover:bg-green-400 disabled:opacity-70"
            )}
            variant="default"
          >
            {isCurrentPlaylistPlaying ? (
              <Pause className="h-7 w-7 sm:h-8 sm:w-8" />
            ) : (
              <Play className="h-7 w-7 sm:h-8 sm:w-8 ml-1" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

interface JioSaavnSongsListProps {
  songs: JioSaavnSong[];
  currentSong: any;
  playerIsPlaying: boolean;
  isFetchingSongs: boolean;
  error: string | null;
  handlePlaySong: (song: JioSaavnSong, index: number) => void;
  handleAddToQueue: (song: JioSaavnSong) => void;
}

const JioSaavnSongsList = ({
  songs,
  currentSong,
  playerIsPlaying,
  isFetchingSongs,
  error,
  handlePlaySong,
  handleAddToQueue,
}: JioSaavnSongsListProps) => {
  if (isFetchingSongs) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white/60">Loading songs&hellip;</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-600 text-red-200 text-sm rounded-md px-4 py-3 mb-6">
        {error}
      </div>
    );
  }

  if (songs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Music className="h-16 w-16 text-white/40 mb-4" />
        <h3 className="text-xl font-semibold mb-2">No songs found</h3>
        <p className="text-white/60">This playlist appears to be empty</p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      {/* Mavrixfy-style header row */}
      <div className="grid grid-cols-[24px_4fr_minmax(120px,1fr)_48px] md:grid-cols-[24px_4fr_2fr_minmax(120px,1fr)_48px] border-b border-border text-sm text-muted-foreground py-2 px-4 mb-2">
        <div className="flex items-center justify-center">#</div>
        <div>Title</div>
        <div className="hidden md:block">Album</div>
        <div className="flex justify-end">
          <Clock className="h-4 w-4" />
        </div>
        <div></div>
      </div>

      {/* Songs list */}
      {songs.map((song, index) => {
        const isCurrentSong = currentSong?._id === `jiosaavn_${song.id}`;
        const isThisSongPlaying = isCurrentSong && playerIsPlaying;
        
        return (
          <div
            key={song.id}
            className="mx-[-16px]"
          >
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.click(); } }}
              className={cn(
                'grid grid-cols-[40px_4fr_minmax(120px,1fr)_48px] md:grid-cols-[40px_4fr_2fr_minmax(120px,1fr)_48px] items-center py-2 px-4 rounded-md group',
                'hover:bg-white/10 transition-colors duration-200 cursor-pointer',
                isCurrentSong && 'bg-white/10'
              )}
              onClick={() => handlePlaySong(song, index)}
            >
              {/* Track number/play button */}
              <div className="flex items-center justify-center">
                {isThisSongPlaying ? (
                  <div className="w-8 h-8 flex items-center justify-center">
                    <div className="w-3 h-3 bg-green-500 rounded-sm animate-pulse"></div>
                  </div>
                ) : (
                  <>
                    <span className="text-gray-400 group-hover:hidden flex items-center justify-center w-8">{index + 1}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white p-0 hidden group-hover:flex"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlaySong(song, index);
                      }}
                    >
                      <Play className="h-4 w-4 ml-0.5" />
                    </Button>
                  </>
                )}
              </div>
              
              {/* Song info with image */}
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn(
                  "h-10 w-10 flex-shrink-0 overflow-hidden rounded",
                  isCurrentSong && "shadow-md"
                )}>
                  <img
                    src={jioSaavnService.getBestImageUrl(song.image)}
                    alt={song.name}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/placeholder-song.jpg';
                    }}
                  />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className={cn(
                    "font-medium truncate text-base",
                    isCurrentSong && "text-green-500"
                  )}>
                    {song.name}
                  </span>
                  <span className="text-sm text-muted-foreground truncate">
                    {song.artists.primary[0]?.name || 'Unknown Artist'}
                  </span>
                </div>
              </div>
              
              {/* Album (desktop only) */}
              <div className="text-muted-foreground text-sm truncate hidden md:block">
                {song.album.name}
              </div>
              
              {/* Duration and actions */}
              <div className="flex items-center justify-end text-muted-foreground">
                <span className="text-sm">{formatTime(song.duration)}</span>
              </div>
              
              {/* Actions column */}
              <div className="flex items-center justify-end gap-2">
                {/* Add to Queue button - visible on desktop */}
                <div className="hidden md:block opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddToQueue(song);
                    }}
                    title="Add to queue"
                  >
                    <ListPlus className="h-4 w-4" />
                  </Button>
                </div>

                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground p-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddToQueue(song);
                        }}
                      >
                        <ListPlus className="h-4 w-4 mr-2" />
                        Add to Queue
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          const downloadUrl = getHighestQualityAudioUrl(song.downloadUrl);
                          if (downloadUrl) {
                            window.open(downloadUrl, '_blank');
                          } else {
                            toast.error('Download not available');
                          }
                        }}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const JioSaavnPlaylistPage: React.FC = () => {
  const { playlistId } = useParams<{ playlistId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [{
    playlist,
    songs,
    isFetchingSongs,
    error,
    isLiked,
    metrics,
    hasPlayed,
  }, dispatchPlaylist] = useReducer(jioSaavnPlaylistReducer, {
    playlist: location.state?.playlist || null,
    songs: [],
    isFetchingSongs: false,
    error: null,
    isLiked: false,
    metrics: { likes: 0, shares: 0, plays: 0 },
    hasPlayed: false,
  });
  const { isAuthenticated } = useAuthStore();

  const { playAlbum, setIsPlaying: setPlayerIsPlaying, setUserInteracted } = usePlayerStore();
  const { currentSong, isPlaying: playerIsPlaying } = usePlayerSync();
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Get colors from album cover
  const albumColors = useAlbumColors(playlist?.image ? jioSaavnService.getBestImageUrl(playlist.image) : undefined);

  // Check if the current playlist is playing
  const isCurrentPlaylistPlaying = playerIsPlaying && 
    songs.some(song => currentSong?._id === `jiosaavn_${song.id}`);


  // Hide mobile navigation when on playlist page
  useEffect(() => {
    document.body.classList.add('hide-mobile-nav');
    
    return () => {
      document.body.classList.remove('hide-mobile-nav');
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      // Remove mobile-specific resize handler
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (playlistId) {
      fetchPlaylistDetails();
      
      // Load metrics from localStorage
      try {
        const allMetrics = readJsonStorage<Record<string, typeof metrics>>(JIOSAAVN_METRICS_KEY, {});
        const playlistMetrics = allMetrics[playlistId] || { likes: 0, shares: 0, plays: 0 };

        // Use shared liked playlists key so JioSaavn favourites appear in sidebar/library.
        const likedPlaylists = readJsonStorage<string[]>(LIKED_PLAYLISTS_KEY, []);
        const legacyLikedPlaylists = readJsonStorage<string[]>(LEGACY_LIKED_PLAYLISTS_KEY, []);

        // Backward compatibility: migrate legacy likes into shared key.
        if (legacyLikedPlaylists.includes(playlistId) && !likedPlaylists.includes(playlistId)) {
          const migrated = [...likedPlaylists, playlistId];
          localStorage.setItem(LIKED_PLAYLISTS_KEY, JSON.stringify(migrated));

          const metadata = readJsonStorage<Record<string, any>>(LIKED_PLAYLISTS_METADATA_KEY, {});
          if (!metadata[playlistId]) {
            metadata[playlistId] = {
              _id: playlistId,
              id: playlistId,
              name: playlist?.name || 'Mavrixfy Playlist',
              imageUrl: playlist?.image ? jioSaavnService.getBestImageUrl(playlist.image) : '',
              createdBy: { fullName: 'Mavrixfy' },
              source: 'jiosaavn',
              routePath: `/jiosaavn/playlist/${playlistId}`,
            };
            localStorage.setItem(LIKED_PLAYLISTS_METADATA_KEY, JSON.stringify(metadata));
          }

          dispatchPlaylist({
            type: 'hydrate_local',
            metrics: playlistMetrics,
            isLiked: true,
            hasPlayed: readJsonStorage<string[]>(PLAYED_JIOSAAVN_PLAYLISTS_KEY, []).includes(playlistId),
          });
          try { document.dispatchEvent(new Event('likedPlaylistsUpdated')); } catch { }
        } else {
          dispatchPlaylist({
            type: 'hydrate_local',
            metrics: playlistMetrics,
            isLiked: likedPlaylists.includes(playlistId),
            hasPlayed: readJsonStorage<string[]>(PLAYED_JIOSAAVN_PLAYLISTS_KEY, []).includes(playlistId),
          });
        }
      } catch (error) {
        // Error loading playlist metrics
      }
    }
  }, [playlistId]);

  const fetchPlaylistDetails = async () => {
    if (!playlistId) return;

    try {
      dispatchPlaylist({ type: 'loading' });
      
      const playlistDetails = await jioSaavnService.getPlaylistDetails(playlistId);
      let nextPlaylist = playlist;
      
      // Update playlist info if not available from state
      if (!playlist) {
        const playlistData = {
          id: playlistDetails.id,
          name: playlistDetails.name,
          type: playlistDetails.type,
          image: playlistDetails.image,
          url: playlistDetails.url,
          songCount: playlistDetails.songCount,
          language: playlistDetails.language,
          explicitContent: playlistDetails.explicitContent,
        };
        nextPlaylist = playlistData;
        
        // Add to recently played when playlist details are loaded
        recentlyPlayedService.addJioSaavnPlaylist(playlistData);
      } else {
        // Add to recently played if playlist was passed from state
        recentlyPlayedService.addJioSaavnPlaylist(playlist);
      }
      
      dispatchPlaylist({
        type: 'loaded',
        playlist: nextPlaylist,
        songs: playlistDetails.songs || [],
      });
      
      // Don't auto-play - let user decide when to play
      // if (location.state?.autoPlay && playlistDetails.songs?.length > 0) {
      //   handlePlaySong(playlistDetails.songs[0], 0);
      // }
    } catch (err) {
      dispatchPlaylist({ type: 'failed' });
      toast.error('Failed to load playlist');
    }
  };

  const updateMetrics = (metric: 'likes' | 'shares' | 'plays') => {
    if (!playlistId) return;

    try {
      const allMetrics = readJsonStorage<Record<string, typeof metrics>>(JIOSAAVN_METRICS_KEY, {});

      allMetrics[playlistId] = allMetrics[playlistId] || { likes: 0, shares: 0, plays: 0 };

      if (metric === 'plays') {
        const playedPlaylists = readJsonStorage<string[]>(PLAYED_JIOSAAVN_PLAYLISTS_KEY, []);
        if (playedPlaylists.includes(playlistId)) {
          return;
        }

        playedPlaylists.push(playlistId);
        localStorage.setItem(PLAYED_JIOSAAVN_PLAYLISTS_KEY, JSON.stringify(playedPlaylists));
        dispatchPlaylist({ type: 'played' });
      }

      if (metric === 'likes' && isLiked) {
        return;
      }

      allMetrics[playlistId][metric]++;
      localStorage.setItem(JIOSAAVN_METRICS_KEY, JSON.stringify(allMetrics));

      dispatchPlaylist({ type: 'metric', metric });
    } catch (error) {
      // Error updating metrics
    }
  };

  const handleLike = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }

    if (!isAuthenticated || !playlistId) {
      return;
    }

    try {
      const likedPlaylists = readJsonStorage<string[]>(LIKED_PLAYLISTS_KEY, []);
      const legacyLikedPlaylists = readJsonStorage<string[]>(LEGACY_LIKED_PLAYLISTS_KEY, []);

      if (isLiked) {
        const updatedLikes = likedPlaylists.filter((id: string) => id !== playlistId);
        localStorage.setItem(LIKED_PLAYLISTS_KEY, JSON.stringify(updatedLikes));

        // Keep legacy key in sync for backward compatibility.
        const updatedLegacyLikes = legacyLikedPlaylists.filter((id: string) => id !== playlistId);
        localStorage.setItem(LEGACY_LIKED_PLAYLISTS_KEY, JSON.stringify(updatedLegacyLikes));

        // Remove metadata.
        const metadata = readJsonStorage<Record<string, any>>(LIKED_PLAYLISTS_METADATA_KEY, {});
        delete metadata[playlistId];
        localStorage.setItem(LIKED_PLAYLISTS_METADATA_KEY, JSON.stringify(metadata));

        dispatchPlaylist({ type: 'liked', value: false });
        try { document.dispatchEvent(new Event('likedPlaylistsUpdated')); } catch { }
      } else {
        if (!likedPlaylists.includes(playlistId)) {
          likedPlaylists.push(playlistId);
          localStorage.setItem(LIKED_PLAYLISTS_KEY, JSON.stringify(likedPlaylists));

          // Keep legacy key in sync for backward compatibility.
          if (!legacyLikedPlaylists.includes(playlistId)) {
            legacyLikedPlaylists.push(playlistId);
            localStorage.setItem(LEGACY_LIKED_PLAYLISTS_KEY, JSON.stringify(legacyLikedPlaylists));
          }

          // Persist metadata so sidebar/library can render immediately.
          const metadata = readJsonStorage<Record<string, any>>(LIKED_PLAYLISTS_METADATA_KEY, {});
          metadata[playlistId] = {
            _id: playlistId,
            id: playlistId,
            name: playlist?.name || 'Mavrixfy Playlist',
            imageUrl: playlist?.image ? jioSaavnService.getBestImageUrl(playlist.image) : '',
            createdBy: { fullName: 'Mavrixfy' },
            source: 'jiosaavn',
            routePath: `/jiosaavn/playlist/${playlistId}`,
          };
          localStorage.setItem(LIKED_PLAYLISTS_METADATA_KEY, JSON.stringify(metadata));

          dispatchPlaylist({ type: 'liked', value: true });
          updateMetrics('likes');
          const recommendationItem = recommendationItemFromPlaylist(metadata[playlistId], 'jiosaavn');
          if (recommendationItem) {
            void trackRecommendationEvent({
              eventType: 'playlist_save',
              item: recommendationItem,
              context: { surface: 'jiosaavn_playlist_page' },
            });
          }
          try { document.dispatchEvent(new Event('likedPlaylistsUpdated')); } catch { }
        }
      }
    } catch (error) {
      // Error handling like
    }
  };

  const handlePlaySong = (_song: JioSaavnSong, index: number) => {
    const convertedSongs = songs.map(s => jioSaavnService.convertToAppSong(s));
    
    playAlbum(convertedSongs, index);
    setTimeout(() => {
      setPlayerIsPlaying(true);
      setUserInteracted();
    }, 50);
  };

  const handlePlayAll = () => {
    if (songs.length > 0) {
      if (!hasPlayed) {
        updateMetrics('plays');
      }
      handlePlaySong(songs[0], 0);
    }
  };

  const handlePausePlaylist = () => {
    const playerStore = usePlayerStore.getState();
    if (playerStore.isPlaying) {
      playerStore.setIsPlaying(false);
    }
  };

  const handleAddToQueue = (song: JioSaavnSong) => {
    const convertedSong = jioSaavnService.convertToAppSong(song);
    const { addToQueue } = usePlayerStore.getState();
    addToQueue(convertedSong);
    toast.success(`Added "${song.name}" to queue`, {
      duration: 2000,
    });
  };

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/jiosaavn/playlist/${playlistId}`;
    const shareText = `Check out "${playlist?.name}" playlist on Mavrixfy!`;
    
    if (navigator.share) {
      navigator.share({
        title: playlist?.name,
        text: shareText,
        url: shareUrl,
      });
    } else {
      navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
      toast.success('Link copied to clipboard!');
    }
    
    updateMetrics('shares');
  };

  // Handle back button click
  const handleBackClick = () => {
    navigate(-1);
  };



  if (!playlist && !isFetchingSongs) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-semibold">Playlist not found</h1>
        <Button onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  const imageUrl = playlist ? jioSaavnService.getBestImageUrl(playlist.image) : '';
  const totalDuration = songs.reduce((acc, song) => acc + song.duration, 0);
  const formattedTotalDuration = formatTime(totalDuration);
  const totalSongs = songs.length;

  return (
    <div className="flex flex-col h-full bg-background text-foreground playlist-fullscreen">
      {/* Main scrollable container */}
      <div ref={containerRef} className="h-full overflow-y-auto playlist-content smooth-scroll">
        {/* Back button */}
        <div className="absolute top-3 left-3 z-30">
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 rounded-full text-white"
            onClick={handleBackClick}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </div>
        
        <JioSaavnPlaylistHeader
          playlist={playlist}
          imageUrl={imageUrl}
          metrics={metrics}
          totalSongs={totalSongs}
          formattedTotalDuration={formattedTotalDuration}
          albumColors={albumColors}
        />

        <JioSaavnPlaylistActions
          isLiked={isLiked}
          totalSongs={totalSongs}
          isFetchingSongs={isFetchingSongs}
          isCurrentPlaylistPlaying={isCurrentPlaylistPlaying}
          handleShare={handleShare}
          handleLike={handleLike}
          handlePausePlaylist={handlePausePlaylist}
          handlePlayAll={handlePlayAll}
        />

        {/* Songs list */}
        <div className="px-4 sm:px-6 pb-32 md:pb-24">
          <JioSaavnSongsList
            songs={songs}
            currentSong={currentSong}
            playerIsPlaying={playerIsPlaying}
            isFetchingSongs={isFetchingSongs}
            error={error}
            handlePlaySong={handlePlaySong}
            handleAddToQueue={handleAddToQueue}
          />
        </div>
      </div>
    </div>
  );
};

export default JioSaavnPlaylistPage;

