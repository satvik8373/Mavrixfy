import { useReducer, useEffect, useSyncExternalStore } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
    Search,
    Heart,
    ArrowUpRight,
    List,
    LayoutGrid,
    Plus,
    ChevronRight,
    ChevronLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '../../contexts/AuthContext';
import { usePlaylistStore } from '@/stores/usePlaylistStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { CreatePlaylistDialog } from '../../components/playlist/CreatePlaylistDialog';
import { getLikedSongsCount } from '@/services/likedSongsService';
import { CustomScrollbar } from '@/components/ui/CustomScrollbar';
// Removed Mavrixfy section per request

interface LeftSidebarProps {
    isCollapsed?: boolean;
    onToggleCollapse?: () => void;
}

type LikedPlaylistsData = {
    likedIds: string[];
    metadata: Record<string, any>;
};

const readLikedPlaylistsData = (): LikedPlaylistsData => {
    try {
        const likedIds: string[] = JSON.parse(localStorage.getItem('liked_playlists:v1') || '[]');
        const legacyJioLikedIds: string[] = JSON.parse(localStorage.getItem('liked_jiosaavn_playlists') || '[]');
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
    return 'Favourite';
};

export const LeftSidebar = ({ isCollapsed = false, onToggleCollapse }: LeftSidebarProps) => {
    const { isAuthenticated } = useAuth();
    const storeIsAuthenticated = useAuthStore(state => state.isAuthenticated);
    const isActuallyAuthenticated = isAuthenticated || storeIsAuthenticated;
    const [sidebarState, dispatchSidebar] = useReducer(
        (state: { showCreateDialog: boolean; likedSongsCount: number; isSidebarLoading: boolean }, action: { type: 'dialog'; open: boolean } | { type: 'liked_count'; count: number } | { type: 'loading'; value: boolean }) => {
            switch (action.type) {
                case 'dialog':
                    return { ...state, showCreateDialog: action.open };
                case 'liked_count':
                    return { ...state, likedSongsCount: action.count };
                case 'loading':
                    return { ...state, isSidebarLoading: action.value };
                default:
                    return state;
            }
        },
        {
            showCreateDialog: false,
            likedSongsCount: 0,
            isSidebarLoading: false,
        }
    );
    const { showCreateDialog, likedSongsCount, isSidebarLoading } = sidebarState;
    const userPlaylists = usePlaylistStore(state => state.userPlaylists);
    const fetchUserPlaylists = usePlaylistStore(state => state.fetchUserPlaylists);
    const fetchPublicPlaylists = usePlaylistStore(state => state.fetchPublicPlaylists);
    const location = useLocation();
    const navigate = useNavigate();

    // Check if we're on the mood playlist page
    const isMoodPlaylistPage = location.pathname === '/mood-playlist';

    useEffect(() => {
        let isCancelled = false;

        const loadSidebarData = async () => {
            dispatchSidebar({ type: 'loading', value: true });

            if (isActuallyAuthenticated) {
                await Promise.allSettled([
                    fetchUserPlaylists(),
                    fetchPublicPlaylists(),
                ]);
                if (!isCancelled) {
                    await loadLikedSongsCount();
                }
            } else {
                await fetchPublicPlaylists();
                if (!isCancelled) {
                    dispatchSidebar({ type: 'liked_count', count: 0 });
                }
            }

            if (!isCancelled) {
                dispatchSidebar({ type: 'loading', value: false });
            }
        };

        loadSidebarData();

        return () => {
            isCancelled = true;
        };
    }, [isActuallyAuthenticated, fetchUserPlaylists, fetchPublicPlaylists]);

    useEffect(() => {
        if (!isActuallyAuthenticated || userPlaylists.length > 0) {
            return;
        }

        // Retry once if the first auth-time fetch resolves before token/user profile settles.
        const retryTimer = window.setTimeout(() => {
            fetchUserPlaylists().catch(() => { });
        }, 1500);

        return () => {
            window.clearTimeout(retryTimer);
        };
    }, [isActuallyAuthenticated, userPlaylists.length, fetchUserPlaylists]);

    // Listen for liked songs updates
    useEffect(() => {
        const handleLikedSongsUpdated = () => {
            loadLikedSongsCount();
        };

        document.addEventListener('likedSongsUpdated', handleLikedSongsUpdated);

        return () => {
            document.removeEventListener('likedSongsUpdated', handleLikedSongsUpdated);
        };
    }, [isActuallyAuthenticated]);

    const loadLikedSongsCount = async () => {
        if (isActuallyAuthenticated) {
            try {
                const count = await getLikedSongsCount();
                dispatchSidebar({ type: 'liked_count', count });
            } catch (error) {
                dispatchSidebar({ type: 'liked_count', count: 0 });
            }
        } else {
            dispatchSidebar({ type: 'liked_count', count: 0 });
        }
    };

    const isActive = (path: string) => {
        return location.pathname.startsWith(path);
    };

    return (
        <div className={cn(
            "hidden md:flex flex-col h-full w-full overflow-hidden transition-colors duration-500",
            isMoodPlaylistPage
                ? "bg-gradient-to-b from-green-950/40 via-[#121212] to-cyan-950/40"
                : "bg-transparent"
        )}>
            {/* Header */}
            <div className={cn("p-3 flex items-center gap-2", isCollapsed ? "justify-center" : "justify-between")}>
                {/* Collapse button on the left */}
                {onToggleCollapse && (
                    <button type="button"
                        className="p-1.5 rounded hover:bg-white/10 transition-colors flex-shrink-0"
                        onClick={onToggleCollapse}
                        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        {/* Sidebar icon: vertical rectangle with chevron - matches Mavrixfy design */}
                        <div className="relative w-5 h-4 flex items-center">
                            {/* Narrow left section (solid bar) - about 20% width */}
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-foreground rounded-l"></div>
                            {/* Wider right section (80% width) with border and chevron */}
                            <div className="absolute left-1 top-0 bottom-0 right-0 border border-foreground border-l-0 rounded-r flex items-center justify-center">
                                <ChevronLeft size={8} className="text-foreground" strokeWidth={2.5} />
                            </div>
                        </div>
                    </button>
                )}

                {/* Your Library text in the middle */}
                {!isCollapsed && (
                    <h1 className="text-base font-semibold text-foreground flex-1">Your Library</h1>
                )}

                {/* Action buttons on the right */}
                {!isCollapsed && (
                    <div className="flex gap-1 flex-shrink-0">
                        <button type="button"
                            className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
                            onClick={() => dispatchSidebar({ type: 'dialog', open: true })}
                            title="Create playlist"
                        >
                            <Plus size={18} className="text-foreground" />
                        </button>
                        <button type="button"
                            className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
                            onClick={() => navigate('/library')}
                            title="Open Your Library"
                        >
                            <ArrowUpRight size={18} className="text-foreground" />
                        </button>
                    </div>
                )}
            </div>

            {/* Search and View Options */}
            {!isCollapsed && (
                <div className="px-2 flex justify-between items-center">
                    <button type="button" className="p-1.5 rounded-full hover:bg-white/10 transition-colors" title="Search">
                        <Search size={16} className="text-muted-foreground hover:text-foreground" />
                    </button>
                    <button type="button" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-xs font-medium px-2 py-1 rounded hover:bg-white/10 transition-colors">
                        <span>Recents</span>
                        <List size={14} />
                    </button>
                </div>
            )}

            {/* Playlists */}
            <CustomScrollbar className="flex-1 min-h-0 pb-2 px-1">
                <div className="space-y-0.5 py-1">

                    {/* Liked Songs */}
                    <Link
                        to="/liked-songs"
                        className={cn(
                            'flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/10 transition-colors',
                            isActive('/liked-songs') ? 'bg-white/10' : '',
                            isCollapsed && 'justify-center'
                        )}
                        title={isCollapsed ? "Liked Songs" : undefined}
                    >
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-green-500 rounded flex items-center justify-center flex-shrink-0">
                            <Heart size={16} className="text-white" fill="white" />
                        </div>
                        {!isCollapsed && (
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-foreground truncate">Liked Songs</p>
                                <p className="text-xs text-muted-foreground truncate">
                                    Playlist • {likedSongsCount} songs
                                </p>
                            </div>
                        )}
                    </Link>

                    {/* AI Mood Generator */}
                    <Link
                        to="/mood-playlist"
                        className={cn(
                            'flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/10 transition-colors',
                            isActive('/mood-playlist') ? 'bg-white/10' : '',
                            isCollapsed && 'justify-center'
                        )}
                        title={isCollapsed ? "AI Mood Generator" : undefined}
                    >
                        <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-cyan-500 rounded flex items-center justify-center flex-shrink-0">
                            <img
                                src="https://res.cloudinary.com/djqq8kba8/image/upload/v1773035583/Mood-icon_asax7o.svg"
                                alt="AI Mood"
                                className="w-6 h-6 object-contain drop-shadow"
                            />
                        </div>
                        {!isCollapsed && (
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-foreground truncate">AI Mood Generator</p>
                                <p className="text-xs text-muted-foreground truncate">
                                    Create playlists from your mood
                                </p>
                            </div>
                        )}
                    </Link>


                    {/* Favourite Playlists (from local likes) */}
                    {!isCollapsed && <FavouritePlaylists />}

                    {/* Only Favourites (liked playlists) and Liked Songs are shown */}

                    {/* Your Playlists */}
                    {isActuallyAuthenticated && isSidebarLoading && userPlaylists.length === 0 && !isCollapsed && (
                        <div className="px-2 py-1 text-xs text-muted-foreground">
                            Loading your playlists…
                        </div>
                    )}

                    {isActuallyAuthenticated && userPlaylists.length > 0 && (
                        <div className="mt-1">
                            {!isCollapsed && (
                                <h3 className="text-xs text-muted-foreground px-2 mb-1 font-medium">Your Playlists</h3>
                            )}
                            {userPlaylists.slice(0, isCollapsed ? 8 : undefined).map((playlist: any) => (
                                <Link
                                    key={`own-${playlist._id}`}
                                    to={`/playlist/${playlist._id}`}
                                    className={cn(
                                        'flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/10 transition-colors group',
                                        isActive(`/playlist/${playlist._id}`) ? 'bg-white/10' : '',
                                        isCollapsed && 'justify-center'
                                    )}
                                    title={isCollapsed ? playlist.name : undefined}
                                >
                                    <div className="w-10 h-10 rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
                                        {playlist.imageUrl ? (
                                            <img
                                                src={playlist.imageUrl}
                                                alt={playlist.name}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full bg-[#282828] flex items-center justify-center">
                                                <LayoutGrid size={16} className="text-muted-foreground" />
                                            </div>
                                        )}
                                    </div>
                                    {!isCollapsed && (
                                        <>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium text-foreground truncate">{playlist.name}</p>
                                                <p className="text-xs text-muted-foreground truncate">
                                                    {playlist.createdBy?.fullName ? `By ${playlist.createdBy.fullName}` : 'Playlist'}
                                                </p>
                                            </div>
                                            <ChevronRight size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </>
                                    )}
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </CustomScrollbar>

            <CreatePlaylistDialog isOpen={showCreateDialog} onClose={() => dispatchSidebar({ type: 'dialog', open: false })} />
        </div>
    );
};

export default LeftSidebar;

let cachedLikedData: LikedPlaylistsData | null = null;
const likedListeners = new Set<() => void>();

const subscribeToLikedPlaylists = (onStoreChange: () => void) => {
    likedListeners.add(onStoreChange);
    
    const syncLikedPlaylists = () => {
        cachedLikedData = readLikedPlaylistsData();
        onStoreChange();
    };

    document.addEventListener('likedPlaylistsUpdated', syncLikedPlaylists);
    window.addEventListener('storage', syncLikedPlaylists);

    return () => {
        likedListeners.delete(onStoreChange);
        document.removeEventListener('likedPlaylistsUpdated', syncLikedPlaylists);
        window.removeEventListener('storage', syncLikedPlaylists);
    };
};

const getLikedPlaylistsSnapshot = (): LikedPlaylistsData => {
    if (cachedLikedData === null) {
        cachedLikedData = readLikedPlaylistsData();
    }
    return cachedLikedData;
};

function FavouritePlaylists() {
    const likedData = useSyncExternalStore(subscribeToLikedPlaylists, getLikedPlaylistsSnapshot);
    const playlists = usePlaylistStore(state => state.playlists);
    const location = useLocation();
    const isActive = (path: string) => location.pathname.startsWith(path);

    // Combine db playlists and external playlists metadata
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
        <div className="mt-1">
            <h3 className="text-xs text-muted-foreground px-2 mb-1 font-medium">Favourites</h3>
            {favs.map((playlist) => {
                const playlistId = getLikedPlaylistId(playlist);
                if (!playlistId) return null;
                const playlistRoute = getLikedPlaylistRoute(playlist, playlistId);
                const ownerLabel = getLikedPlaylistOwnerLabel(playlist);

                return (
                <Link
                    key={`fav-${playlistId}`}
                    to={playlistRoute}
                    className={cn(
                        'flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/10 transition-colors',
                        isActive(playlistRoute) ? 'bg-white/10' : ''
                    )}
                >
                    <div className="w-10 h-10 rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {playlist.imageUrl ? (
                            <img
                                src={playlist.imageUrl}
                                alt={playlist.name}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full bg-[#282828] flex items-center justify-center">
                                <LayoutGrid size={16} className="text-muted-foreground" />
                            </div>
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{playlist.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                            {`By ${ownerLabel}`}
                        </p>
                    </div>
                </Link>
                );
            })}
        </div>
    );
}
