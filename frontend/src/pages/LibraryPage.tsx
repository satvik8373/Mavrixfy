import { useEffect, useState, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Library,
  Heart,
  Music,
  ListMusic,
  Pin,
  PinOff,
  User,
  ArrowUp,
  LayoutGrid,
  Search,
  Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePlaylistStore } from '../stores/usePlaylistStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { CreatePlaylistDialog } from '../components/playlist/CreatePlaylistDialog';
import { cn } from '@/lib/utils';

type LikedPlaylistsData = {
  likedIds: string[];
  metadata: Record<string, any>;
};

const readLikedPlaylistsData = (): LikedPlaylistsData => {
  try {
    const likedIds: string[] = JSON.parse(localStorage.getItem('liked_playlists:v1') || '[]');
    const legacyJioLikedIds: string[] = JSON.parse(localStorage.getItem('liked_jiosaavn_playlists:v1') || '[]');
    const metadata: Record<string, any> = JSON.parse(localStorage.getItem('liked_playlists_metadata:v1') || '{}');

    const mergedLikedIds = Array.from(new Set([...likedIds, ...legacyJioLikedIds]));

    Object.keys(metadata).forEach((id) => {
      const item = metadata[id];
      if (!item) return;
      if (typeof item.name === 'string' && item.name.toLowerCase().includes('jiosaavn')) {
        item.name = item.name.replace(/jiosaavn/gi, 'Mavrixfy');
      }
      if (item?.createdBy?.fullName && String(item.createdBy.fullName).toLowerCase().includes('jiosaavn')) {
        item.createdBy.fullName = 'Mavrixfy';
      }
    });

    legacyJioLikedIds.forEach((id) => {
      if (!metadata[id]) {
        metadata[id] = {
          _id: id,
          id,
          name: 'Mavrixfy Playlist',
          imageUrl: '',
          createdBy: { fullName: 'Mavrixfy' },
          source: 'jiosaavn',
          routePath: `/jiosaavn/playlist/${id}`,
        };
      }
    });

    return {
      likedIds: mergedLikedIds,
      metadata,
    };
  } catch {
    return { likedIds: [], metadata: {} };
  }
};

let cachedLikedPlaylistsData: LikedPlaylistsData | null = null;

const getLikedPlaylistsSnapshot = (): LikedPlaylistsData => {
  if (!cachedLikedPlaylistsData) {
    cachedLikedPlaylistsData = readLikedPlaylistsData();
  }
  return cachedLikedPlaylistsData;
};

const subscribeToLikedPlaylists = (callback: () => void) => {
  const syncLikedPlaylists = () => {
    cachedLikedPlaylistsData = readLikedPlaylistsData();
    callback();
  };

  document.addEventListener('likedPlaylistsUpdated', syncLikedPlaylists);
  window.addEventListener('storage', syncLikedPlaylists);

  return () => {
    document.removeEventListener('likedPlaylistsUpdated', syncLikedPlaylists);
    window.removeEventListener('storage', syncLikedPlaylists);
  };
};

const getLikedPlaylistId = (playlist: any): string | null => {
  return playlist?._id || playlist?.id || null;
};

const getLikedPlaylistRoute = (playlist: any, playlistId: string): string => {
  if (typeof playlist?.routePath === 'string' && playlist.routePath.trim().length > 0) {
    return playlist.routePath;
  }
  if (playlist?.source === 'jiosaavn' || playlist?.type === 'jiosaavn-playlist') {
    return `/jiosaavn/playlist/${playlistId}`;
  }
  return `/playlist/${playlistId}`;
};

const getLikedPlaylistOwnerLabel = (playlist: any): string => {
  if (playlist?.source === 'jiosaavn' || playlist?.type === 'jiosaavn-playlist') {
    return 'Mavrixfy';
  }
  if (playlist?.createdBy?.fullName) {
    const owner = String(playlist.createdBy.fullName);
    if (owner.toLowerCase().includes('jiosaavn')) {
      return 'Mavrixfy';
    }
    return owner;
  }
  return 'Unknown';
};


interface PlaylistsSectionProps {
  items: any[];
  viewMode: 'grid' | 'list';
  compactLibraryLayout: boolean;
  navigateToPlaylist: (playlistId: string) => void;
  togglePinned: (playlistId: string, event: React.MouseEvent) => void;
}

const PinnedPlaylistsSection = ({
  items,
  viewMode,
  compactLibraryLayout,
  navigateToPlaylist,
  togglePinned,
}: PlaylistsSectionProps) => {
  if (items.length === 0) return null;
  return (
    <div className="mb-4">
      <div className="text-xs font-medium uppercase text-muted-foreground mb-2 px-2">
        Pinned
      </div>

      {viewMode === 'list' ? (
        <div className="space-y-1">
          {items.map(playlist => (
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.click(); } }}
              key={playlist._id}
              className={cn(
                "flex items-center hover:bg-accent rounded-md cursor-pointer group transition-colors",
                compactLibraryLayout ? "gap-2 p-1" : "gap-3 p-3"
              )}
              onClick={() => navigateToPlaylist(playlist._id)}
            >
              <img
                src={playlist.imageUrl || '/default-playlist.jpg'}
                alt={playlist.name}
                className={cn(
                  "object-cover rounded-md",
                  compactLibraryLayout ? "w-8 h-8" : "w-12 h-12"
                )}
                loading="lazy"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-foreground truncate">{playlist.name}</h3>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <ListMusic className="h-3 w-3" />
                  Playlist • <span className="flex items-center gap-1"><User className="h-3 w-3" /> {playlist.createdBy?.fullName || 'Unknown'}</span>
                </p>
              </div>
              <button type="button"
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground p-1.5 rounded-full hover:bg-accent transition-all"
                onClick={(e) => togglePinned(playlist._id, e)}
                title="Unpin"
              >
                <PinOff className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className={cn(
          "grid gap-4",
          compactLibraryLayout
            ? "grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7"
            : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
        )}>
          {items.map(playlist => (
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.click(); } }}
              key={playlist._id}
              className={cn(
                "bg-card border border-border rounded-lg hover:bg-accent transition-colors cursor-pointer group relative",
                compactLibraryLayout ? "p-3" : "p-4"
              )}
              onClick={() => navigateToPlaylist(playlist._id)}
            >
              <div className="aspect-square mb-3 rounded-md overflow-hidden shadow-md relative group-hover:shadow-lg transition-all">
                <img
                  src={playlist.imageUrl || '/default-playlist.jpg'}
                  alt={playlist.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                <button type="button"
                  className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 bg-background/80 text-foreground p-1.5 rounded-full hover:bg-background hover:scale-105 transition-all border border-border"
                  onClick={(e) => togglePinned(playlist._id, e)}
                  title="Unpin"
                >
                  <PinOff className="h-4 w-4" />
                </button>
              </div>
              <h3 className={cn("font-medium text-foreground truncate", compactLibraryLayout ? "text-sm" : "")}>{playlist.name}</h3>
              <p className={cn("text-muted-foreground truncate", compactLibraryLayout ? "text-xs mt-0.5" : "text-sm mt-1")}>
                Playlist • {playlist.createdBy?.fullName || 'Unknown'}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const AIMoodPlaylistsSection = ({
  items,
  viewMode,
  compactLibraryLayout,
  navigateToPlaylist,
  togglePinned,
}: PlaylistsSectionProps) => {
  if (items.length === 0) return null;
  return (
    <div className="mb-6">
      <div className="text-xs font-medium uppercase text-[#fdba74] bg-orange-500/10 inline-block px-2 py-1 rounded-md mb-2 mx-2">
        ✨ AI Generated Moods
      </div>

      {viewMode === 'list' ? (
        <div className="space-y-1">
          {items.map(playlist => (
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.click(); } }}
              key={playlist._id}
              className={cn(
                "flex items-center hover:bg-accent rounded-md cursor-pointer group transition-colors",
                compactLibraryLayout ? "gap-2 p-1" : "gap-3 p-3"
              )}
              onClick={() => navigateToPlaylist(playlist._id)}
            >
              <img
                src={playlist.imageUrl || '/default-playlist.jpg'}
                alt={playlist.name}
                className={cn(
                  "object-cover rounded-md border border-orange-500/20",
                  compactLibraryLayout ? "w-8 h-8" : "w-12 h-12"
                )}
                loading="lazy"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-foreground truncate">{playlist.name}</h3>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <ListMusic className="h-3 w-3 text-orange-400" />
                  AI Mood • {playlist.emotion || 'Mixed'}
                </p>
              </div>
              <button type="button"
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground p-1.5 rounded-full hover:bg-accent transition-all"
                onClick={(e) => togglePinned(playlist._id, e)}
                title="Pin"
              >
                <Pin className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className={cn(
          "grid gap-4",
          compactLibraryLayout
            ? "grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7"
            : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
        )}>
          {items.map(playlist => (
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.click(); } }}
              key={playlist._id}
              className={cn(
                "bg-card border border-orange-500/20 rounded-lg hover:border-orange-500/50 hover:bg-accent transition-colors cursor-pointer group relative",
                compactLibraryLayout ? "p-3" : "p-4"
              )}
              onClick={() => navigateToPlaylist(playlist._id)}
            >
              <div className="aspect-square mb-3 rounded-md overflow-hidden shadow-md relative group-hover:shadow-lg transition-all">
                <img
                  src={playlist.imageUrl || '/default-playlist.jpg'}
                  alt={playlist.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <h3 className={cn("font-medium text-foreground truncate", compactLibraryLayout ? "text-sm" : "")}>{playlist.name}</h3>
              <p className={cn("text-muted-foreground truncate", compactLibraryLayout ? "text-xs mt-0.5" : "text-sm mt-1")}>
                AI Mood • {playlist.emotion || 'Mixed'}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface RegularPlaylistsSectionProps extends PlaylistsSectionProps {
  showTitle: boolean;
}

const RegularPlaylistsSection = ({
  items,
  viewMode,
  compactLibraryLayout,
  navigateToPlaylist,
  togglePinned,
  showTitle,
}: RegularPlaylistsSectionProps) => {
  if (items.length === 0) return null;
  return (
    <div className="mb-4">
      {showTitle && (
        <div className="text-xs font-medium uppercase text-muted-foreground mb-2 px-2">
          Your Playlists
        </div>
      )}

      {viewMode === 'list' ? (
        <div className="space-y-1">
          {items.map(playlist => (
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.click(); } }}
              key={playlist._id}
              className={cn(
                "flex items-center hover:bg-accent rounded-md cursor-pointer group transition-colors",
                compactLibraryLayout ? "gap-2 p-1" : "gap-3 p-3"
              )}
              onClick={() => navigateToPlaylist(playlist._id)}
            >
              <img
                src={playlist.imageUrl || '/default-playlist.jpg'}
                alt={playlist.name}
                className={cn(
                  "object-cover rounded-md",
                  compactLibraryLayout ? "w-8 h-8" : "w-12 h-12"
                )}
                loading="lazy"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-foreground truncate">{playlist.name}</h3>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <ListMusic className="h-3 w-3" />
                  Playlist • <span className="flex items-center gap-1"><User className="h-3 w-3" /> {playlist.createdBy?.fullName || 'Unknown'}</span>
                </p>
              </div>
              <button type="button"
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground p-1.5 rounded-full hover:bg-accent transition-all"
                onClick={(e) => togglePinned(playlist._id, e)}
                title="Pin"
              >
                <Pin className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className={cn(
          "grid gap-4",
          compactLibraryLayout
            ? "grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7"
            : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
        )}>
          {items.map(playlist => (
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.click(); } }}
              key={playlist._id}
              className={cn(
                "bg-card border border-border rounded-lg hover:bg-accent transition-colors cursor-pointer group relative",
                compactLibraryLayout ? "p-3" : "p-4"
              )}
              onClick={() => navigateToPlaylist(playlist._id)}
            >
              <div className="aspect-square mb-3 rounded-md overflow-hidden shadow-md relative group-hover:shadow-lg transition-all">
                <img
                  src={playlist.imageUrl || '/default-playlist.jpg'}
                  alt={playlist.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <h3 className={cn("font-medium text-foreground truncate", compactLibraryLayout ? "text-sm" : "")}>{playlist.name}</h3>
              <p className={cn("text-muted-foreground truncate", compactLibraryLayout ? "text-xs mt-0.5" : "text-sm mt-1")}>
                Playlist • {playlist.createdBy?.fullName || 'Unknown'}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const LibraryPage = () => {
  const { isAuthenticated, loading, user } = useAuth();
  const navigate = useNavigate();
  const { compactLibraryLayout } = useSettingsStore();
  const { userPlaylists, fetchUserPlaylists } = usePlaylistStore();
  const [state, setState] = useState({
    isLibraryLoading: false,
    showCreateDialog: false,
    scrollPosition: 0,
    showScrollTop: false,
    viewMode: (() => {
      try {
        const savedViewMode = localStorage.getItem('mavrix-library-view-mode');
        return (savedViewMode === 'grid' || savedViewMode === 'list') ? (savedViewMode as 'grid' | 'list') : 'grid';
      } catch {
        return 'grid';
      }
    })(),
    pinnedPlaylists: (() => {
      try {
        const savedPinned = localStorage.getItem('mavrix-pinned-playlists:v1');
        return savedPinned ? JSON.parse(savedPinned) : [];
      } catch {
        return [];
      }
    })(),
  });
  const { isLibraryLoading, showCreateDialog, showScrollTop, viewMode, pinnedPlaylists } = state;

  // Save pinned playlists when they change
  useEffect(() => {
    localStorage.setItem('mavrix-pinned-playlists:v1', JSON.stringify(pinnedPlaylists));
  }, [pinnedPlaylists]);

  // Save view mode when it changes
  useEffect(() => {
    localStorage.setItem('mavrix-library-view-mode', viewMode);
  }, [viewMode]);

  // Scroll to top function - scroll the parent container
  const scrollToTop = () => {
    // Find the parent scrollable container
    const scrollContainer = document.querySelector('.custom-scrollbar-hide');
    if (scrollContainer) {
      scrollContainer.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  };

  // Listen for scroll events on parent container
  useEffect(() => {
    const scrollContainer = document.querySelector('.custom-scrollbar-hide');
    if (!scrollContainer) return;

    const handleScroll = () => {
      const currentPos = scrollContainer.scrollTop;
      setState(prev => ({ ...prev, scrollPosition: currentPos, showScrollTop: currentPos > 300 }));
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, []);

  // Filtered playlists
  const filteredPlaylists = userPlaylists;

  // Toggle pin status for a playlist
  const togglePinned = (playlistId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setState(prev => {
      const nextPinned = prev.pinnedPlaylists.includes(playlistId)
        ? prev.pinnedPlaylists.filter((id: string) => id !== playlistId)
        : [...prev.pinnedPlaylists, playlistId];
      return { ...prev, pinnedPlaylists: nextPinned };
    });
  };

  // Navigate to playlist
  const navigateToPlaylist = (playlistId: string) => {
    navigate(`/playlist/${playlistId}`);
  };

  // Separate playlists into pinned and unpinned, and then into regular vs AI generated
  const pinnedItems = filteredPlaylists.filter(playlist => pinnedPlaylists.includes(playlist._id));
  const unpinnedItems = filteredPlaylists.filter(playlist => !pinnedPlaylists.includes(playlist._id));

  const unpinnedRegular = unpinnedItems.filter(p => !p.moodGenerated);
  const unpinnedMood = unpinnedItems.filter(p => p.moodGenerated);

  // Load library data
  useEffect(() => {
    const loadData = async () => {
      // Show content immediately
      setState(prev => ({ ...prev, isLibraryLoading: false }));

      if (isAuthenticated) {
        try {
          // Check if we need to refresh data
          if (usePlaylistStore.getState().shouldRefresh()) {
            await usePlaylistStore.getState().refreshAllData();
          } else {
            await fetchUserPlaylists();
          }
        } catch (error) {
          // Error loading playlists
        }
      }
    };

    loadData();
  }, [isAuthenticated, fetchUserPlaylists, user]);

  // Debug logging
  useEffect(() => {
    // Auth state changed
  }, [isAuthenticated, loading, user]);

  // Debug playlist store state
  useEffect(() => {
    // Playlist store state changed
  }, [userPlaylists]);




  return (
    <main className="min-h-full px-[6px] text-foreground">
      <div className="p-2 sm:p-4 pt-4 pb-8">
        {isLibraryLoading || loading ? (
          <div className="h-64"></div>
        ) : !isAuthenticated ? (
          <div className="bg-card border border-border rounded-lg p-8 text-center">
            <Library className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Sign in to view your library</h2>
            <p className="text-muted-foreground mb-6">
              Create an account or sign in to save and access your favorite music
            </p>
            <Button
              onClick={() => navigate('/')}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Sign In
            </Button>
          </div>
        ) : userPlaylists.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
              <Music className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Create your first playlist</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              It's easy, we'll help you. Start building your collection of music you love.
            </p>
            <Button
              onClick={() => setState(prev => ({ ...prev, showCreateDialog: true }))}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Create Playlist
            </Button>
          </div>
        ) : (
          <div>
            {/* Tools - shown first, compact size */}
            <div className="mb-3 px-2 sm:px-4">
              <div className="flex items-center gap-2">
                <button type="button"
                  onClick={() => setState(prev => ({ ...prev, viewMode: prev.viewMode === 'grid' ? 'list' : 'grid' }))}
                  className="h-7 w-7 rounded-full bg-muted flex items-center justify-center hover:bg-accent transition-colors"
                  aria-label="Toggle grid/list"
                >
                  <LayoutGrid className="h-3.5 w-3.5 text-foreground" />
                </button>
                <button type="button"
                  onClick={() => navigate('/search')}
                  className="h-7 w-7 rounded-full bg-muted flex items-center justify-center hover:bg-accent transition-colors"
                  aria-label="Search"
                >
                  <Search className="h-3.5 w-3.5 text-foreground" />
                </button>
                <button type="button"
                  onClick={() => setState(prev => ({ ...prev, showCreateDialog: true }))}
                  className="bg-green-500 hover:bg-green-600 text-white px-2.5 py-1 rounded-full flex items-center gap-1.5 text-xs font-medium transition-colors"
                  aria-label="Create playlist"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create</span>
                </button>
              </div>
            </div>

            {/* Liked Songs Card - Always at top */}
            <div className="mb-4">
              <div
                role="button"
                tabIndex={0}
                onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.click(); } }}
                className={cn(
                  "flex items-center hover:bg-accent rounded-md cursor-pointer transition-colors",
                  compactLibraryLayout ? "gap-2 p-1" : "gap-3 p-3"
                )}
                onClick={() => navigate('/liked-songs')}
              >
                <div className={cn(
                  "bg-gradient-to-br from-indigo-600 to-blue-400 rounded-md flex items-center justify-center",
                  compactLibraryLayout ? "w-8 h-8" : "w-12 h-12"
                )}>
                  <Heart className={compactLibraryLayout ? "h-4 w-4 text-white" : "h-6 w-6 text-white"} fill="white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-foreground truncate">Liked Songs</h3>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Pin className="h-3 w-3" /> Playlist
                  </p>
                </div>
              </div>
            </div>

            {/* Favourite Playlists Section */}
            <LikedPlaylistsSection />

            <PinnedPlaylistsSection
              items={pinnedItems}
              viewMode={viewMode}
              compactLibraryLayout={compactLibraryLayout}
              navigateToPlaylist={navigateToPlaylist}
              togglePinned={togglePinned}
            />
            <AIMoodPlaylistsSection
              items={unpinnedMood}
              viewMode={viewMode}
              compactLibraryLayout={compactLibraryLayout}
              navigateToPlaylist={navigateToPlaylist}
              togglePinned={togglePinned}
            />
            <RegularPlaylistsSection
              items={unpinnedRegular}
              viewMode={viewMode}
              compactLibraryLayout={compactLibraryLayout}
              navigateToPlaylist={navigateToPlaylist}
              togglePinned={togglePinned}
              showTitle={pinnedItems.length > 0 || unpinnedMood.length > 0}
            />
          </div>
        )}
      </div>

      {/* Scroll to top button */}
      {showScrollTop && (
        <button type="button"
          onClick={scrollToTop}
          className="fixed bottom-24 right-6 bg-card/80 hover:bg-accent text-foreground p-3 rounded-full shadow-lg transition-all z-50 backdrop-blur-sm border border-border"
          aria-label="Scroll to top"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      )}

      <CreatePlaylistDialog isOpen={showCreateDialog} onClose={() => setState(prev => ({ ...prev, showCreateDialog: false }))} />
    </main>
  );
};

// Liked Playlists Section Component
function LikedPlaylistsSection() {
  const likedData = useSyncExternalStore(subscribeToLikedPlaylists, getLikedPlaylistsSnapshot);
  const playlists = usePlaylistStore(state => state.playlists);
  const { compactLibraryLayout } = useSettingsStore();
  const navigate = useNavigate();

  const allLikedPlaylists = likedData.likedIds.flatMap(id => {
    const metadataItem = likedData.metadata[id];
    if (metadataItem?.source === 'jiosaavn' || metadataItem?.routePath?.startsWith('/jiosaavn/')) {
      return metadataItem ? [metadataItem] : [];
    }

    const dbPlaylist = playlists.find(p => p._id === id);
    if (dbPlaylist) return [dbPlaylist];
    if (metadataItem) return [metadataItem];
    return [];
  }) as any[];

  const favs = allLikedPlaylists.slice(0, 6);

  if (favs.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="text-xs font-medium uppercase text-muted-foreground mb-2 px-2">
        Favourite Playlists
      </div>
      <div className="space-y-1">
        {favs.map((playlist) => {
          const playlistId = getLikedPlaylistId(playlist);
          if (!playlistId) return null;

          const playlistRoute = getLikedPlaylistRoute(playlist, playlistId);
          const ownerLabel = getLikedPlaylistOwnerLabel(playlist);

          return (
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.click(); } }}
            key={`fav-${playlistId}`}
            className={cn(
              "flex items-center hover:bg-accent rounded-md cursor-pointer group transition-colors",
              compactLibraryLayout ? "gap-2 p-1" : "gap-3 p-3"
            )}
            onClick={() => navigate(playlistRoute)}
          >
            <img
              src={playlist.imageUrl || '/default-playlist.jpg'}
              alt={playlist.name}
              className={cn(
                "object-cover rounded-md",
                compactLibraryLayout ? "w-8 h-8" : "w-12 h-12"
              )}
              loading="lazy"
            />
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-foreground truncate">{playlist.name}</h3>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Heart className="h-3 w-3" />
                Favourite • {ownerLabel}
              </p>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}

export default LibraryPage;

