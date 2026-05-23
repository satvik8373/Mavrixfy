import { useEffect, useReducer, useState, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { usePlaylistStore } from '../../stores/usePlaylistStore';
import { usePlayerStore } from '../../stores/usePlayerStore';
import { useMusicStore } from '../../stores/useMusicStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useAlbumColors } from '../../hooks/useAlbumColors';
import { usePlayerSync } from '../../hooks/usePlayerSync';
import { Button } from '../../components/ui/button';
import { ShuffleButton } from '../../components/ShuffleButton';
import '../../styles/playlist-page.css';
import { InlineLoading } from '../../components/ui/loading';
import { recentlyPlayedService } from '@/services/recentlyPlayedService';
import {
  Play,
  Pencil,
  Share2,
  Clock,
  Plus,
  Search,
  Heart,
  Trash,
  Pause,
  Music2,
  Image as ImageIcon,
  ChevronLeft,
  ListPlus,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';
import { EditPlaylistDialog } from '../../components/playlist/EditPlaylistDialog';
import { formatTime } from '../../utils/formatTime';
import { SharePlaylist } from '../../components/SharePlaylist';
// import { SongMenu } from '../../components/SongMenu';
import { Song } from '../../types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { Input } from '../../components/ui/input';
import { ScrollArea } from '../../components/ui/scroll-area';
import { updatePlaylistCoverFromSongs } from '../../services/playlistService';
import { recommendationItemFromPlaylist, trackRecommendationEvent } from '@/services/recommendationService';
import { updateMetaTags } from '@/utils/metaTags';
import { artistPath, generateBreadcrumbSchema, generatePlaylistSEO, genrePath, SITE_URL } from '@/utils/seoHelpers';

const PLAYLIST_METRICS_KEY = 'playlist_metrics:v1';
const LIKED_PLAYLISTS_KEY = 'liked_playlists:v1';
const LIKED_PLAYLISTS_METADATA_KEY = 'liked_playlists_metadata:v1';
const USER_PLAYED_PLAYLISTS_KEY = 'user_played_playlists:v1';

const readJsonStorage = <T,>(key: string, fallback: T): T => {
  const saved = localStorage.getItem(key);
  return saved ? JSON.parse(saved) : fallback;
};

function ClientPlaylistDate({ value }: { value?: string | number | Date }) {
  const text = value 
    ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) 
    : '3 days ago';

  return <>{text}</>;
}

function AddSongsDialog({
  isOpen,
  onClose,
  playlistId,
}: {
  isOpen: boolean;
  onClose: () => void;
  playlistId: string;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  // Removed unused addSongToPlaylist
  const {
    indianSearchResults,
    searchIndianSongs,
    isIndianMusicLoading,
  } = useMusicStore();

  const handleSearch = () => {
    if (searchQuery.trim()) {
      setIsSearching(true);

      // Store the query for potential fallback use
      const query = searchQuery;

      searchIndianSongs(query)
        .then(() => {
          // Check if we got any results
          const results = useMusicStore.getState().indianSearchResults;
          if (results.length === 0) {
            // Create a fallback search result if no results found
            handleSearchFallback(query);
          }
        })
        .catch(() => {
          // Use fallback when search API fails
          handleSearchFallback(query);
        });
    }
  };

  // Provide fallback results when search fails
  const handleSearchFallback = (query: string) => {
    const fallbackResults = [
      {
        id: `fallback-${Date.now()}-1`,
        title: query,
        artist: 'Search Result',
        image: '/placeholder-song.jpg',
        url: '',
        duration: '180'
      }
    ];

    // Update the search results with fallback data
    useMusicStore.setState({
      indianSearchResults: fallbackResults,
      isIndianMusicLoading: false
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleAddSong = async (song: Song) => {
    try {
      await usePlaylistStore.getState().addSongToPlaylist(playlistId, song._id);

      // Force refresh the playlist to show the new song immediately
      setTimeout(async () => {
        await usePlaylistStore.getState().forceRefreshPlaylistById(playlistId);
      }, 100);
    } catch (error) {
      // Silent error handling
    }
  };

  const handleAddIndianSong = async (song: any) => {
    try {
      // Convert Indian song to app song format directly
      const convertedSong = useMusicStore.getState().convertIndianSongToAppSong(song);

      // Add converted song directly to playlist without validation notification
      await usePlaylistStore.getState().addSongToPlaylist(playlistId, convertedSong);

      // Force refresh the playlist to show the new song immediately
      setTimeout(async () => {
        await usePlaylistStore.getState().forceRefreshPlaylistById(playlistId);
      }, 100);
    } catch (error) {
      // Silent error handling
    }
  };

  const renderSongItem = (song: any, isIndian = false) => (
    <button
      type="button"
      key={song.id || song._id}
      className="flex w-full items-center gap-3 p-2 rounded-md hover:bg-accent transition-colors cursor-pointer group text-left"
      onClick={() => (isIndian ? handleAddIndianSong(song) : handleAddSong(song))}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (isIndian) {
            handleAddIndianSong(song);
          } else {
            handleAddSong(song);
          }
        }
      }}
    >
      <div className="h-12 w-12 overflow-hidden rounded-md">
        <img
          src={song.imageUrl || song.image}
          alt={song.title}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="flex-1 flex flex-col">
        <span className="font-medium truncate">{song.title}</span>
        <span className="text-xs text-muted-foreground truncate">{song.artist}</span>
      </div>
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-md opacity-0 transition-opacity group-hover:opacity-100">
        <Plus className="h-4 w-4" />
      </span>
    </button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Songs to Playlist</DialogTitle>
          <DialogDescription>
            Search for songs to add them to your playlist
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          <div className="relative">
            <Input
              placeholder="Search for songs..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pr-10"
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full"
              onClick={handleSearch}
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="h-[400px] pr-4 mt-4 thin-scroll">
            {isIndianMusicLoading ? (
              <div className="p-4"></div>
            ) : (
              <>
                {isSearching && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">Search Results</h3>
                    {indianSearchResults.length > 0 ? (
                      indianSearchResults.map(song => renderSongItem(song, true))
                    ) : (
                      <p className="text-sm text-muted-foreground py-2">No results found</p>
                    )}
                  </div>
                )}
              </>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Create a custom song context menu component that supports the "Find Audio" action
// Note: PlaylistSongMenu component is unused on this page and intentionally removed to reduce bundle size

interface PlaylistUiState {
  showEditDialog: boolean;
  showAddSongsDialog: boolean;
  isLiked: boolean;
  metrics: { likes: number; shares: number; plays: number };
  isEditMode: boolean;
  showStickyHeader: boolean;
  showRegenerateCoverDialog: boolean;
  isRegeneratingCover: boolean;
}

type PlaylistUiAction = Partial<PlaylistUiState> | ((state: PlaylistUiState) => PlaylistUiState);

const playlistUiReducer = (state: PlaylistUiState, action: PlaylistUiAction): PlaylistUiState => {
  if (typeof action === 'function') {
    return action(state);
  }
  return { ...state, ...action };
};

// eslint-disable-next-line react-doctor/no-giant-component
export function PlaylistPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userId, isAuthenticated } = useAuthStore();
  const { currentPlaylist, forceRefreshPlaylistById, deletePlaylist, isLoading, removeSongFromPlaylist } =
    usePlaylistStore();
  const { playAlbum } = usePlayerStore();
  const { isPlaying: playerIsPlaying, currentSong } = usePlayerSync();
  // Removed unused addSongToPlaylist from store
  const [{
    showEditDialog,
    showAddSongsDialog,
    isLiked,
    metrics,
    isEditMode,
    showStickyHeader,
    showRegenerateCoverDialog,
    isRegeneratingCover,
  }, dispatchPlaylistUi] = useReducer(playlistUiReducer, {
    showEditDialog: false,
    showAddSongsDialog: false,
    isLiked: false,
    metrics: { likes: 0, shares: 0, plays: 0 },
    isEditMode: false,
    showStickyHeader: false,
    showRegenerateCoverDialog: false,
    isRegeneratingCover: false,
  });
  const hasPlayedRef = useRef(false);
  const isPlayingRef = useRef(false);

  // Removed unused playingSongId state to avoid warnings

  // Removed scroll position tracking for toolbar behavior
  const containerRef = useRef<HTMLDivElement>(null);

  // Get colors from album cover
  const albumColors = useAlbumColors(currentPlaylist?.imageUrl);

  // Debug: Log the colors to see what we're getting
  useEffect(() => {
    if (currentPlaylist?.imageUrl) {
      // Album colors loaded
    }
  }, [albumColors, currentPlaylist?.imageUrl]);

  // Convert RGB color to RGBA with different opacity levels
  const getRgbaFromRgb = (rgbColor: string, opacity: number) => {
    // Always use a vibrant fallback for testing
    if (!rgbColor || rgbColor === 'rgb(64, 64, 64)' || !currentPlaylist?.imageUrl) {
      // Use a vibrant purple-blue gradient that will definitely be visible
      return `rgba(138, 43, 226, ${opacity})`;
    }

    const match = rgbColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      const [, r, g, b] = match;
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }

    // Fallback to vibrant purple
    return `rgba(138, 43, 226, ${opacity})`;
  };

  // Check if the current playlist is playing
  const isCurrentPlaylistPlaying = playerIsPlaying &&
    currentPlaylist?.songs.some(song => song._id === currentSong?._id);

  // Determine if we've scrolled enough to hide other buttons
  // Removed scroll-based UI changes for toolbar; keep state for potential future use

  // Add scroll listener for sticky header
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      // Show sticky header when scrolled past the main header (around 400px)
      dispatchPlaylistUi({ showStickyHeader: scrollPosition > 400 });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Hide mobile navigation when on playlist page
  useEffect(() => {
    // Add class to hide mobile nav
    document.body.classList.add('hide-mobile-nav');

    // Cleanup function to remove class when leaving page
    return () => {
      document.body.classList.remove('hide-mobile-nav');
    };
  }, []);

  useEffect(() => {
    if (id) {
      // Use forceRefreshPlaylistById to bypass cache and get fresh data
      forceRefreshPlaylistById(id);
      // Load metrics from localStorage
      try {
        const allMetrics = readJsonStorage<Record<string, typeof metrics>>(PLAYLIST_METRICS_KEY, {});
        const playlistMetrics = allMetrics[id] || { likes: 0, shares: 0, plays: 0 };

        // Check if user has liked this playlist
        const likedPlaylists = readJsonStorage<string[]>(LIKED_PLAYLISTS_KEY, []);
        dispatchPlaylistUi({
          metrics: playlistMetrics,
          isLiked: likedPlaylists.includes(id),
        });

        // Check if user has already played this playlist
        const playedPlaylists = readJsonStorage<string[]>(USER_PLAYED_PLAYLISTS_KEY, []);
        hasPlayedRef.current = playedPlaylists.includes(id);
      } catch (error) {
        // Silent error handling
      }
    }
  }, [id, forceRefreshPlaylistById]);

  // Add playlist to recently played when it's loaded
  useEffect(() => {
    if (currentPlaylist && currentPlaylist._id === id) {
      recentlyPlayedService.addPlaylist(currentPlaylist);
    }
  }, [currentPlaylist, id]);

  useEffect(() => {
    if (!currentPlaylist) return;

    const seo = generatePlaylistSEO(currentPlaylist);
    updateMetaTags({
      ...seo,
      schema: [
        seo.schema,
        generateBreadcrumbSchema([
          { name: 'Home', url: SITE_URL },
          { name: 'Playlists', url: `${SITE_URL}/playlists` },
          { name: currentPlaylist.name, url: seo.url },
        ]),
      ],
      alternates: [
        { hrefLang: 'en', href: seo.url },
        { hrefLang: 'hi', href: `${seo.url}?lang=hi` },
        { hrefLang: 'gu', href: `${seo.url}?lang=gu` },
        { hrefLang: 'x-default', href: seo.url },
      ],
    });
  }, [currentPlaylist]);

  const updateMetrics = (metric: 'likes' | 'shares' | 'plays') => {
    if (!id) return;

    try {
      const allMetrics = readJsonStorage<Record<string, typeof metrics>>(PLAYLIST_METRICS_KEY, {});

      allMetrics[id] = allMetrics[id] || { likes: 0, shares: 0, plays: 0 };

      // For plays, only count if user hasn't played this playlist before
      if (metric === 'plays') {
        const playedPlaylists = readJsonStorage<string[]>(USER_PLAYED_PLAYLISTS_KEY, []);
        if (playedPlaylists.includes(id)) {
          return; // Don't count if already played
        }

        // Add to played playlists
        playedPlaylists.push(id);
        localStorage.setItem(USER_PLAYED_PLAYLISTS_KEY, JSON.stringify(playedPlaylists));
        hasPlayedRef.current = true;
      }

      // For likes, we don't increment if it's an unlike action
      if (metric === 'likes' && isLiked) {
        return;
      }

      allMetrics[id][metric]++;
      localStorage.setItem(PLAYLIST_METRICS_KEY, JSON.stringify(allMetrics));

      dispatchPlaylistUi(prev => ({
        ...prev,
        metrics: {
          ...prev.metrics,
          [metric]: prev.metrics[metric] + 1,
        },
      }));
    } catch (error) {
      // Silent error handling
    }
  };

  const handleLike = (e?: React.MouseEvent) => {
    // Prevent event propagation if event exists
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }

    if (!isAuthenticated || !id) {
      return;
    }

    try {
      const likedPlaylists = readJsonStorage<string[]>(LIKED_PLAYLISTS_KEY, []);

      if (isLiked) {
        // Unlike - don't decrease the counter, just remove from liked list
        const updatedLikes = likedPlaylists.filter((playlistId: string) => playlistId !== id);
        localStorage.setItem(LIKED_PLAYLISTS_KEY, JSON.stringify(updatedLikes));

        // Remove metadata
        try {
          const metadata = readJsonStorage<Record<string, any>>(LIKED_PLAYLISTS_METADATA_KEY, {});
          delete metadata[id];
          localStorage.setItem(LIKED_PLAYLISTS_METADATA_KEY, JSON.stringify(metadata));
        } catch (e) { }

        dispatchPlaylistUi({ isLiked: false });
        try { document.dispatchEvent(new Event('likedPlaylistsUpdated')); } catch { }
      } else {
        // Like - only increment if not previously liked
        if (!likedPlaylists.includes(id)) {
          likedPlaylists.push(id);
          localStorage.setItem(LIKED_PLAYLISTS_KEY, JSON.stringify(likedPlaylists));

          // Persist lightweight metadata so sidebar/library can render favourites immediately.
          if (currentPlaylist) {
            const metadata = readJsonStorage<Record<string, any>>(LIKED_PLAYLISTS_METADATA_KEY, {});
            metadata[id] = {
              _id: currentPlaylist._id,
              name: currentPlaylist.name,
              imageUrl: currentPlaylist.imageUrl || '',
              createdBy: currentPlaylist.createdBy?.fullName
                ? { fullName: currentPlaylist.createdBy.fullName }
                : undefined,
              source: 'public',
              routePath: `/playlist/${id}`,
            };
            localStorage.setItem(LIKED_PLAYLISTS_METADATA_KEY, JSON.stringify(metadata));
          }

          dispatchPlaylistUi({ isLiked: true });
          updateMetrics('likes');
          const recommendationItem = recommendationItemFromPlaylist(currentPlaylist, 'catalog');
          if (recommendationItem) {
            void trackRecommendationEvent({
              eventType: 'playlist_save',
              item: recommendationItem,
              context: { surface: 'playlist_page' },
            });
          }
          try { document.dispatchEvent(new Event('likedPlaylistsUpdated')); } catch { }
        }
      }
    } catch (error) {
      // Silent error handling
    }
  };

  // SharePlaylist component will handle sharing functionality

  // Removed scroll listener; toolbar no longer depends on scroll

  // Add pause playlist functionality
  const handlePausePlaylist = () => {
    if (isPlayingRef.current) return;

    // Access the player store directly to toggle play state
    const playerStore = usePlayerStore.getState();
    if (playerStore.isPlaying) {
      playerStore.setIsPlaying(false);
    }
  };

  // Previous handle play functionality remains
  const handlePlayPlaylist = async (e?: React.MouseEvent) => {
    // Prevent event propagation if event exists
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }

    if (!currentPlaylist || currentPlaylist.songs.length === 0) {
      return;
    }

    // If already playing, just return
    if (isPlayingRef.current) return;

    try {
      isPlayingRef.current = true;

      // Update play count only if user hasn't played this playlist before
      if (!hasPlayedRef.current) {
        updateMetrics('plays');
      }

      // Make sure shuffle is off before playing in order
      const playerStore = usePlayerStore.getState();
      if (playerStore.shuffleMode !== 'off') {
        playerStore.setShuffleMode('off');
      }

      // Play the playlist from the beginning
      playAlbum(currentPlaylist.songs, 0);

      // Force playback to start
      usePlayerStore.getState().setUserInteracted();
      usePlayerStore.getState().setIsPlaying(true);

      // Reset isPlaying state after a delay
      setTimeout(() => {
        isPlayingRef.current = false;
      }, 300);
    } catch (error) {
      // Silent error handling
      isPlayingRef.current = false;
    }
  };

  // Removed unused handleShufflePlaylist

  const handlePlaySong = async (song: Song, index: number, e?: React.MouseEvent) => {
    // Prevent event propagation if event exists
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }

    if (!currentPlaylist) {
      return;
    }

    // Check if this is the currently playing song
    const playerStore = usePlayerStore.getState();
    const currentSongId = playerStore.currentSong?._id || (playerStore.currentSong as any)?.id;
    const songId = song._id || (song as any).id;
    const isThisSongPlaying = currentSongId && songId && currentSongId === songId && playerStore.isPlaying;

    // If this song is already playing, pause it instead of replaying
    if (isThisSongPlaying) {
      playerStore.setIsPlaying(false);
      return;
    }

    // Set loading state
    setIsPlaying(true);

    try {
      // If song has no audio URL, try to find it
      if (!song.audioUrl) {
        toast.loading("Finding audio for this song...");
        try {
          const searchQuery = `${song.title} ${song.artist}`.trim();
          await useMusicStore.getState().searchIndianSongs(searchQuery);

          const results = useMusicStore.getState().indianSearchResults;
          if (results && results.length > 0) {
            // Found a match, update the song with the audio URL
            const foundSong = results[0];
            const updatedSong = {
              ...song,
              audioUrl: foundSong.url || '',
              imageUrl: song.imageUrl || foundSong.image
            };

            // Update the song in the playlist
            const updatedSongs = currentPlaylist.songs.map((s, idx) =>
              idx === index ? updatedSong : s
            );

            // Play the updated song
            playAlbum(updatedSongs, index);
            toast.dismiss();

            // Force playback to start
            usePlayerStore.getState().setUserInteracted();
            usePlayerStore.getState().setIsPlaying(true);

            // Reset states
            setIsPlaying(false);
            return;
          } else {
            toast.dismiss();
            toast.error("Couldn't find audio for this song");
            setIsPlaying(false);
            return;
          }
        } catch (error) {
          toast.dismiss();
          toast.error("Error finding audio");
          setIsPlaying(false);
          return;
        }
      }

      // Disable shuffle to ensure we play the selected song
      if (playerStore.shuffleMode !== 'off') {
        playerStore.setShuffleMode('off');
      }

      // Play the selected song
      playAlbum(currentPlaylist.songs, index);

      // Start playback
      usePlayerStore.getState().setUserInteracted();
      usePlayerStore.getState().setIsPlaying(true);

      // Vibrate on mobile devices for tactile feedback (if supported)
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    } catch (error) {
      toast.error("Error playing song");
    } finally {
      // Always reset states
      setIsPlaying(false);
    }
  };

  const openAddSongsDialog = () => {
    dispatchPlaylistUi({ showAddSongsDialog: true });
  };

  // Add this function to the PlaylistPage component
  const handleFindAudio = async (song: Song, index: number, e?: React.MouseEvent) => {
    // Prevent event propagation if event exists
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }

    if (!currentPlaylist) {
      return;
    }

    try {
      // Search for the song to get its audio URL
      const searchQuery = `${song.title} ${song.artist}`.trim();
      await useMusicStore.getState().searchIndianSongs(searchQuery);

      const results = useMusicStore.getState().indianSearchResults;
      if (results && results.length > 0) {
        // Found a match, update the song with the audio URL
        const foundSong = results[0];
        const updatedSong = {
          ...song,
          audioUrl: foundSong.url || '',
          imageUrl: song.imageUrl || foundSong.image
        };

        // Update the song in the playlist
        const updatedSongs = currentPlaylist.songs.map((s, idx) =>
          idx === index ? updatedSong : s
        );

        // Update the playlist with the new songs array
        // This is a simplified approach - in a real app, you would want to
        // persist this change to your backend storage
        usePlaylistStore.setState({
          currentPlaylist: {
            ...currentPlaylist,
            songs: updatedSongs
          }
        });
      } else {
        // Silent error handling
      }
    } catch (error) {
      // Silent error handling
    }
  };

  // Add handleDeletePlaylist function
  const handleDeletePlaylist = async () => {
    if (confirm('Are you sure you want to delete this playlist?')) {
      try {
        await deletePlaylist(currentPlaylist!._id);
        navigate('/library');
      } catch (error) {
        // Silent error handling
      }
    }
  };

  // Add handleRemoveSong function
  const handleRemoveSong = async (songId: string, e?: React.MouseEvent) => {
    // Prevent event propagation if event exists
    if (e) e.stopPropagation();

    // Remove song directly without confirmation
    try {
      await removeSongFromPlaylist(currentPlaylist!._id, songId);
    } catch (error) {
      // Silent error handling
    }
  };

  // Add a function to handle regenerating the cover
  const handleRegenerateCover = async () => {
    if (!currentPlaylist || !currentPlaylist.songs || currentPlaylist.songs.length === 0) {
      toast.error('Playlist needs songs to generate a cover');
      return;
    }

    dispatchPlaylistUi({ isRegeneratingCover: true });
    try {
      const updatedPlaylist = await updatePlaylistCoverFromSongs(
        currentPlaylist._id,
        currentPlaylist.songs
      );

      // Update the playlist in the local state
      if (updatedPlaylist) {
        // Update the playlist in our store
        usePlaylistStore.getState().updatePlaylist(
          currentPlaylist._id,
          { imageUrl: updatedPlaylist.imageUrl }
        );

        // Fetch the updated playlist to refresh our local state
        if (id) {
          await usePlaylistStore.getState().forceRefreshPlaylistById(id);
        }

        toast.success('Playlist cover updated');
      }
    } catch (error) {
      // Error regenerating cover
      toast.error('Failed to update cover');
    } finally {
      dispatchPlaylistUi({
        isRegeneratingCover: false,
        showRegenerateCoverDialog: false,
      });
    }
  };

  if (isLoading) {
    return <div className="min-h-screen bg-[#121212]"></div>;
  }

  if (!currentPlaylist) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-semibold">Playlist not found</h1>
        <Button onClick={() => navigate('/library')}>Go to Library</Button>
      </div>
    );
  }

  const isOwner = userId === currentPlaylist.createdBy.uid;
  const totalDuration = currentPlaylist.songs.reduce((acc, song) => acc + song.duration, 0);
  const formattedTotalDuration = formatTime(totalDuration);
  const totalSongs = currentPlaylist.songs.length;
  const topArtists = Array.from(new Set(currentPlaylist.songs.flatMap(song => song.artist ? [song.artist] : []))).slice(0, 6);
  const playlistGenres = Array.from(new Set(currentPlaylist.songs.flatMap(song => {
    const genre = (song as any).genre || (song as any).language;
    return genre ? [genre] : [];
  }))).slice(0, 5);

  // Removed unused headerOpacity

  // Removed unused headerBgColor

  // Handle back button click
  const handleBackClick = () => {
    navigate(-1);
  };

  return (
    <div ref={containerRef} className="flex flex-col min-h-full bg-background text-foreground playlist-fullscreen">
      {/* Sticky header - shows when scrolling */}
      <div
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300 backdrop-blur-md",
          showStickyHeader
            ? "translate-y-0 opacity-100"
            : "-translate-y-full opacity-0"
        )}
        style={{
          background: `linear-gradient(90deg, ${getRgbaFromRgb(albumColors.primary, 0.9)} 0%, ${getRgbaFromRgb(albumColors.primary, 0.7)} 100%)`
        }}
      >
        <div className="flex items-center gap-4 px-4 sm:px-6 py-3">
          {/* Back button */}
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 rounded-full text-white hover:bg-white/20"
            onClick={handleBackClick}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          {/* Play button */}
          {isCurrentPlaylistPlaying ? (
            <Button
              size="icon"
              className="w-12 h-12 rounded-full bg-green-500 hover:bg-green-600 text-black transition-all hover:scale-105 shadow-lg"
              onClick={handlePausePlaylist}
            >
              <Pause className="h-5 w-5 fill-current" />
            </Button>
          ) : (
            <Button
              size="icon"
              className="w-12 h-12 rounded-full bg-green-500 hover:bg-green-600 text-black transition-all hover:scale-105 shadow-lg"
              onClick={handlePlayPlaylist}
              disabled={currentPlaylist.songs.length === 0}
            >
              <Play className="h-5 w-5 fill-current ml-0.5" />
            </Button>
          )}

          {/* Playlist name */}
          <h2 className="text-xl font-semibold text-white truncate playlist-text-shadow">
            {currentPlaylist.name}
          </h2>
        </div>
      </div>

      {/* Main content container - no internal scrolling */}
      <div className="flex-1 playlist-content">
        {/* Back button - visible only when not scrolled */}
        <div className={`absolute top-3 left-3 z-30`}>
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 rounded-full text-white"
            onClick={handleBackClick}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </div>

        {/* Extended Mavrixfy-style gradient background */}
        <div
          className="relative"
          style={{
            background: `linear-gradient(180deg, 
              ${getRgbaFromRgb(albumColors.primary, 1)} 0%, 
              ${getRgbaFromRgb(albumColors.primary, 0.85)} 15%, 
              ${getRgbaFromRgb(albumColors.primary, 0.65)} 30%, 
              ${getRgbaFromRgb(albumColors.primary, 0.45)} 45%, 
              ${getRgbaFromRgb(albumColors.primary, 0.25)} 60%, 
              ${getRgbaFromRgb(albumColors.primary, 0.1)} 75%, 
              hsl(var(--background)) 100%)`,
            minHeight: '60vh'
          }}
        >
          {/* Header content */}
          <div className="pt-12 pb-4 px-4 sm:px-6">
            <div className="flex flex-col md:flex-row items-start md:items-end gap-4 relative z-10 pb-2">
              {/* Playlist cover image - Mavrixfy-sized */}
              <div className="w-48 h-48 sm:w-56 sm:h-56 md:w-60 md:h-60 flex-shrink-0 mx-auto md:mx-0 relative group playlist-cover-shadow">
                <img
                  src={currentPlaylist.imageUrl || '/default-playlist.jpg'}
                  alt={currentPlaylist.name}
                  className="w-full h-full object-cover relative z-10 rounded"
                />

                {/* Regenerate cover overlay - only for playlist owners */}
                {isOwner && (
                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 rounded">
                    <Button
                      variant="ghost"
                      className="text-white hover:bg-white/20"
                      onClick={() => dispatchPlaylistUi({ showRegenerateCoverDialog: true })}
                    >
                      <ImageIcon className="mr-2 h-4 w-4" />
                      Update Cover
                    </Button>
                  </div>
                )}
              </div>

              {/* Playlist info with Mavrixfy-like sizing */}
              <div className="flex flex-col justify-end text-foreground text-center md:text-left w-full">
                <p className="text-xs uppercase font-medium mb-1 playlist-text-shadow">Public Playlist</p>
                <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold mb-2 tracking-tight playlist-text-shadow leading-tight">
                  {currentPlaylist.name}
                </h1>

                {/* Description - more compact */}
                {currentPlaylist.description && (
                  <p className="text-sm text-muted-foreground mb-2 max-w-xl mx-auto md:mx-0 truncate playlist-text-shadow">{currentPlaylist.description}</p>
                )}

                {/* Metadata without profile avatar */}
                <div className="flex items-center gap-1 text-sm text-muted-foreground justify-center md:justify-start flex-wrap playlist-text-shadow">
                  <span className="font-medium text-foreground">{currentPlaylist.createdBy.fullName}</span>
                  <span className="mx-1">•</span>
                  <span>{metrics.likes} saves</span>
                  <span className="mx-1">•</span>
                  <span>{totalSongs} songs,</span>
                  <span className="text-muted-foreground ml-1">about {formattedTotalDuration}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons - larger play button like before */}
          <div className="px-4 sm:px-6 pb-4 relative z-10">
            <div className="flex items-center gap-4">
              {/* Play/Pause button - back to larger size */}
              {isCurrentPlaylistPlaying ? (
                <Button
                  size="icon"
                  className="w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 text-black transition-all hover:scale-105 shadow-lg"
                  onClick={handlePausePlaylist}
                >
                  <Pause className="h-6 w-6 fill-current" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  className="w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 text-black transition-all hover:scale-105 shadow-lg"
                  onClick={handlePlayPlaylist}
                  disabled={currentPlaylist.songs.length === 0}
                >
                  <Play className="h-6 w-6 fill-current ml-0.5" />
                </Button>
              )}

              {/* Shuffle button - normal size */}
              <ShuffleButton />

              {/* Like button - normal size */}
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "w-10 h-10 rounded-full transition-all",
                  isLiked ? "text-green-500 hover:text-green-600 hover:bg-green-500/10" : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
                onClick={handleLike}
                title={isLiked ? "Remove from liked" : "Add to liked"}
              >
                <Heart className={cn("h-5 w-5", isLiked && "fill-current")} />
              </Button>

              {/* Share button - normal size */}
              <SharePlaylist
                playlist={currentPlaylist}
                trigger={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-10 h-10 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
                    title="Share playlist"
                  >
                    <Share2 className="h-5 w-5" />
                  </Button>
                }
                onShare={() => updateMetrics('shares')}
              />

              {/* More options button */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-10 h-10 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
                    title="More options"
                  >
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M3 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" />
                    </svg>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-popover text-popover-foreground border-border">
                  <DropdownMenuItem
                    onClick={openAddSongsDialog}
                    className="hover:bg-accent"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Songs
                  </DropdownMenuItem>

                  {isOwner && (
                    <>
                      <DropdownMenuItem
                        onClick={() => dispatchPlaylistUi({ showEditDialog: true })}
                        className="hover:bg-accent"
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit Playlist
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={() => dispatchPlaylistUi({ isEditMode: !isEditMode })}
                        className="hover:bg-accent"
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        {isEditMode ? 'Exit Edit Mode' : 'Edit Songs'}
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={handleDeletePlaylist}
                        className="hover:bg-accent text-red-500 hover:text-red-600"
                      >
                        <Trash className="h-4 w-4 mr-2" />
                        Delete Playlist
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Owner actions - normal size */}
              {isOwner && (
                <>
                  <div className="w-px h-8 bg-border/50 mx-2" />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-10 h-10 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
                    onClick={() => dispatchPlaylistUi({ showEditDialog: true })}
                    title="Edit playlist"
                  >
                    <Pencil className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-10 h-10 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
                    onClick={openAddSongsDialog}
                    title="Add songs"
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Songs list with better spacing */}
        <div className="px-4 sm:px-6 pb-32 md:pb-24 relative">
          {/* Add a subtle overlay to help with text readability over the gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/10 to-background pointer-events-none"></div>

          {currentPlaylist.songs.length > 0 ? (
            <div className="relative z-10">
              {/* Header row with better spacing */}
              <div className="grid grid-cols-[24px_4fr_minmax(120px,1fr)_48px] md:grid-cols-[24px_4fr_2fr_minmax(120px,1fr)_48px] playlist-border text-sm text-muted-foreground py-3 px-4 mb-2 border-b">
                <div className="flex items-center justify-center">#</div>
                <div className="font-medium">Title</div>
                <div className="hidden md:block font-medium">Album</div>
                <div className="flex justify-end font-medium">Date added</div>
                <div className="flex justify-end">
                  <Clock className="h-4 w-4" />
                </div>
              </div>

              {/* Songs list with proper spacing */}
              {currentPlaylist.songs.map((song, index) => {
                const currentSongId = currentSong?._id || (currentSong as any)?.id;
                const songId = song._id || (song as any).id;
                const isCurrentSong = currentSongId && songId && currentSongId === songId;
                const isThisSongPlaying = isCurrentSong && playerIsPlaying;

                return (
                  <div
                    key={song._id}
                    className="mx-[-16px]"
                  >
                    <div
                      className={cn(
                        'grid grid-cols-[40px_4fr_minmax(120px,1fr)_48px] md:grid-cols-[40px_4fr_2fr_minmax(120px,1fr)_48px] items-center py-2 px-4 rounded group playlist-song-row',
                        'md:transition-colors md:duration-200 active:bg-white/5',
                        isCurrentSong && 'bg-white/10',
                        !song.audioUrl && 'opacity-60'
                      )}
                    >
                      {/* Track number/play button - normal size */}
                      <div className="flex items-center justify-center">
                        {isThisSongPlaying ? (
                          <div className="w-8 h-8 flex items-center justify-center">
                            <div className="w-3 h-3 bg-green-500 rounded-sm animate-pulse"></div>
                          </div>
                        ) : (
                          <>
                            <span className="text-gray-400 md:group-hover:hidden hidden sm:flex items-center justify-center w-8">{index + 1}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white p-0 sm:hidden md:group-hover:flex"
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

                      {/* Song info with proper spacing */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                          "h-10 w-10 flex-shrink-0 overflow-hidden rounded",
                          isCurrentSong && "shadow-md"
                        )}>
                          <img
                            src={song.imageUrl || '/default-song.jpg'}
                            alt={song.title}
                            className="h-full w-full object-cover"
                            loading={index < 5 ? "eager" : "lazy"}
                            ref={index < 5 ? (el) => { if (el) (el as any).fetchPriority = 'high'; } : undefined}
                          />
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className={cn(
                            "font-medium truncate text-base",
                            isCurrentSong && "text-green-500"
                          )}>
                            {song.title}
                          </span>
                          <span className="text-sm text-muted-foreground truncate whitespace-nowrap overflow-hidden">
                            {song.artist}
                          </span>
                        </div>
                      </div>

                      {/* Album name (desktop only) */}
                      <div className="text-muted-foreground text-sm truncate hidden md:block">
                        {song.title}
                      </div>

                      {/* Date added (desktop only) */}
                      <div suppressHydrationWarning className="text-muted-foreground text-sm truncate hidden md:block">
                        <ClientPlaylistDate value={song.createdAt} />
                      </div>

                      {/* Actions column with normal sizes */}
                      <div className="flex items-center justify-end gap-2">
                        {/* Like button - normal size */}
                        <div className="hidden md:block md:opacity-0 md:group-hover:opacity-100 md:transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Add to liked songs logic here
                            }}
                            title="Save to your Liked Songs"
                          >
                            <Heart className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Duration */}
                        <span className="text-sm text-muted-foreground w-12 text-right">{formatTime(song.duration)}</span>

                        {/* More options - normal size */}
                        <div className="hidden md:block md:opacity-0 md:group-hover:opacity-100 md:transition-opacity">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                }}
                                title="More options"
                              >
                                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 16 16">
                                  <path d="M3 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" />
                                </svg>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="bg-popover text-popover-foreground border-border">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Add to queue functionality
                                  const { addToQueue } = usePlayerStore.getState();
                                  addToQueue(song);
                                  toast.success(`Added "${song.title}" to queue`);
                                }}
                                className="hover:bg-accent"
                              >
                                <ListPlus className="h-4 w-4 mr-2" />
                                Add to Queue
                              </DropdownMenuItem>

                              {!song.audioUrl && (
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleFindAudio(song, index, e);
                                  }}
                                  className="hover:bg-accent"
                                >
                                  <Search className="h-4 w-4 mr-2" />
                                  Find Audio
                                </DropdownMenuItem>
                              )}

                              {isOwner && (
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveSong(song._id, e);
                                  }}
                                  className="hover:bg-accent text-red-500 hover:text-red-600"
                                >
                                  <Trash className="h-4 w-4 mr-2" />
                                  Remove from Playlist
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {/* Owner edit actions */}
                        {isOwner && isEditMode && (
                          <div className="transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveSong(song._id, e);
                              }}
                              title="Remove song"
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </div>
                        )}

                        {!song.audioUrl && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 md:opacity-0 md:group-hover:opacity-100 md:transition-opacity text-muted-foreground hover:text-foreground p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFindAudio(song, index, e);
                            }}
                          >
                            <Search className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center relative z-10">
              <div className="mb-6 rounded-full bg-muted p-8">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-gray-400"
                >
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-foreground">It's pretty quiet here</h2>
              <p className="mt-3 text-muted-foreground max-w-md">
                Add some songs to your playlist by clicking the "Add songs" button.
              </p>
              <Button
                onClick={openAddSongsDialog}
                className="mt-6 bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
              >
                Add songs
              </Button>
            </div>
          )}

          <section className="relative z-10 mt-10 border-t border-border/60 px-1 py-8 text-sm text-muted-foreground">
            <nav className="mb-4" aria-label="Breadcrumb">
              <Link to="/home" className="hover:text-foreground">Home</Link>
              <span className="mx-2">/</span>
              <Link to="/playlists" className="hover:text-foreground">Playlists</Link>
              <span className="mx-2">/</span>
              <span className="text-foreground">{currentPlaylist.name}</span>
            </nav>
            <h2 className="mb-3 text-xl font-semibold text-foreground">About {currentPlaylist.name}</h2>
            <p className="max-w-3xl leading-6">
              {currentPlaylist.description || `${currentPlaylist.name} is a curated Mavrixfy playlist for discovering songs, artists and moods in one place.`}
              {' '}It currently includes {totalSongs} songs and runs for about {formattedTotalDuration}.
            </p>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              {topArtists.length > 0 && (
                <div>
                  <h3 className="mb-2 font-medium text-foreground">Top artists</h3>
                  <div className="flex flex-wrap gap-2">
                    {topArtists.map(artist => (
                      <Link key={artist} to={artistPath(artist)} className="rounded-full bg-muted px-3 py-1 hover:bg-muted/80">
                        {artist}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="mb-2 font-medium text-foreground">Related discovery</h3>
                <div className="flex flex-wrap gap-2">
                  {playlistGenres.map(genre => (
                    <Link key={genre} to={genrePath(genre)} className="rounded-full bg-muted px-3 py-1 hover:bg-muted/80">
                      {genre}
                    </Link>
                  ))}
                  <Link to="/trending" className="rounded-full bg-muted px-3 py-1 hover:bg-muted/80">Trending</Link>
                  <Link to={`/search?q=${encodeURIComponent(currentPlaylist.name)}`} className="rounded-full bg-muted px-3 py-1 hover:bg-muted/80">
                    Similar playlists
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Fixed position Add Songs button - only shown when playlist is empty */}
      {currentPlaylist && currentPlaylist.songs.length === 0 && (
        <div className="fixed bottom-20 right-6 z-30">
          <Button
            onClick={openAddSongsDialog}
            className="bg-green-500 text-black rounded-full shadow-lg flex items-center gap-2 px-4 sm:px-6 py-4 sm:py-6 h-auto hover:scale-105 transition-all hover:bg-green-400"
          >
            <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="text-sm sm:text-base">Add Songs</span>
          </Button>
        </div>
      )}

      {/* Dialogs */}
      {showEditDialog && (
        <EditPlaylistDialog
          playlist={currentPlaylist}
          isOpen={showEditDialog}
          onClose={() => dispatchPlaylistUi({ showEditDialog: false })}
        />
      )}

      {showAddSongsDialog && (
        <AddSongsDialog
          isOpen={showAddSongsDialog}
          onClose={() => dispatchPlaylistUi({ showAddSongsDialog: false })}
          playlistId={currentPlaylist._id}
        />
      )}

      {/* New dialog for regenerating cover image */}
      <Dialog open={showRegenerateCoverDialog} onOpenChange={(open) => dispatchPlaylistUi({ showRegenerateCoverDialog: open })}>
        <DialogContent className="bg-zinc-900 text-white border-zinc-800 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Cover Art</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Create a new cover art from your playlist's songs
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Preview of existing songs for the collage */}
              {currentPlaylist.songs.slice(0, 4).map((song, index) => (
                <div key={song._id || (song as any).id || index} className="aspect-square bg-zinc-800 rounded overflow-hidden">
                  <img
                    src={song.imageUrl || '/default-song.jpg'}
                    alt={song.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}

              {/* Fill empty slots with placeholder if needed */}
              {Array.from({ length: Math.max(0, 4 - currentPlaylist.songs.length) }).map((_, index) => (
                <div
                  key={`empty-${index}`}
                  className="aspect-square bg-zinc-800 rounded flex items-center justify-center"
                >
                  <Music2 className="h-8 w-8 text-zinc-600" />
                </div>
              ))}
            </div>

            <p className="text-sm text-zinc-400">
              {currentPlaylist.songs.length > 0
                ? 'This will create a 4-grid collage using your playlist songs as cover art.'
                : 'Add songs to your playlist first to generate a cover.'}
            </p>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => dispatchPlaylistUi({ showRegenerateCoverDialog: false })}
              className="bg-transparent border-zinc-700 text-white hover:bg-zinc-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRegenerateCover}
              disabled={isRegeneratingCover || currentPlaylist.songs.length === 0}
              className="bg-green-500 text-black hover:bg-green-600"
            >
              {isRegeneratingCover ? (
                <InlineLoading text="Processing..." />
              ) : (
                'Generate Cover'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
