import { createWithEqualityFn as create } from 'zustand/traditional';
import { Playlist } from '../types';
import { useMusicStore } from '../stores/useMusicStore';

const loadPlaylistService = () => import('../services/playlistService');

interface PlaylistStore {
  playlists: Playlist[];
  userPlaylists: Playlist[];
  featuredPlaylists: Playlist[];
  publicPlaylists: Playlist[];
  currentPlaylist: Playlist | null;
  searchResults: Playlist[];
  isLoading: boolean;
  isSearching: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  lastRefresh: number;

  fetchPlaylists: () => Promise<void>;
  fetchUserPlaylists: () => Promise<void>;
  fetchFeaturedPlaylists: () => Promise<void>;
  fetchPublicPlaylists: () => Promise<void>;
  fetchPlaylistById: (id: string) => Promise<Playlist | null>;
  forceRefreshPlaylistById: (id: string) => Promise<Playlist | null>;
  searchPlaylists: (query: string) => Promise<Playlist[]>;
  createPlaylist: (
    name: string,
    description?: string,
    isPublic?: boolean,
    imageUrl?: string | null
  ) => Promise<Playlist | null>;
  updatePlaylist: (
    id: string,
    data: { name?: string; description?: string; isPublic?: boolean; imageUrl?: string }
  ) => Promise<void>;
  deletePlaylist: (id: string) => Promise<void>;
  addSongToPlaylist: (playlistId: string, songIdOrObject: string | any) => Promise<void>;
  removeSongFromPlaylist: (playlistId: string, songId: string) => Promise<void>;
  refreshAllData: () => Promise<void>;
  shouldRefresh: () => boolean;
}

export const usePlaylistStore = create<PlaylistStore>((set, get) => ({
  playlists: [],
  userPlaylists: [],
  featuredPlaylists: [],
  publicPlaylists: [],
  currentPlaylist: null,
  searchResults: [],
  isLoading: false,
  isSearching: false,
  isCreating: false,
  isUpdating: false,
  isDeleting: false,
  lastRefresh: 0,

  fetchPlaylists: async () => {
    try {
      set({ isLoading: true });
      try {
        const playlistService = await loadPlaylistService();
        const [userPlaylists, publicPlaylists] = await Promise.all([
          playlistService.getUserPlaylists({ limit: 50, page: 1 }),
          playlistService.getPublicPlaylists({ limit: 50, page: 1 })
        ]);
        const map = new Map<string, Playlist>();
        publicPlaylists.forEach(p => map.set(p._id, p));
        userPlaylists.forEach(p => map.set(p._id, p));
        set({ playlists: Array.from(map.values()), userPlaylists, publicPlaylists, isLoading: false });
      } catch {
        set({ playlists: [], isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  fetchUserPlaylists: async () => {
    try {
      set({ isLoading: true });
      try {
        const playlistService = await loadPlaylistService();
        const userPlaylists = await playlistService.getUserPlaylists({ limit: 50, page: 1 });
        
        const merged = new Map<string, Playlist>();
        get().publicPlaylists.forEach(p => merged.set(p._id, p));
        userPlaylists.forEach(p => merged.set(p._id, p));
        
        set({ userPlaylists, playlists: Array.from(merged.values()), isLoading: false });
      } catch (error) {
        set({ userPlaylists: [], isLoading: false });
      }
    } catch (error) {
      set({ isLoading: false });
    }
  },

  fetchFeaturedPlaylists: async () => {
    try {
      set({ isLoading: true });
      try {
        const playlistService = await loadPlaylistService();
        const featuredPlaylists = await playlistService.getFeaturedPlaylists();
        set({ featuredPlaylists, isLoading: false });
      } catch {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  fetchPublicPlaylists: async () => {
    try {
      set({ isLoading: true });
      try {
        const playlistService = await loadPlaylistService();
        const publicPlaylists = await playlistService.getPublicPlaylists({ limit: 50, page: 1 });
        const merged = new Map<string, Playlist>();
        publicPlaylists.forEach(p => merged.set(p._id, p));
        get().userPlaylists.forEach(p => merged.set(p._id, p));
        set({ publicPlaylists, playlists: Array.from(merged.values()), isLoading: false });
      } catch {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  fetchPlaylistById: async (id: string) => {
    try {
      set({ isLoading: true });
      try {
        const playlistService = await loadPlaylistService();
        const playlist = await playlistService.getPlaylistById(id);
        set({ currentPlaylist: playlist, isLoading: false });
        return playlist;
      } catch {}
      set({ isLoading: false });
      return null;
    } catch {
      set({ isLoading: false });
      return null;
    }
  },

  // Force refresh a playlist by bypassing cache
  forceRefreshPlaylistById: async (id: string) => {
    try {
      set({ isLoading: true });
      // Clear any cached data for this playlist
      const { playlistsService } = await import('../services/firestore');
      playlistsService.clearCache();
      
      const playlistService = await loadPlaylistService();
      const playlist = await playlistService.getPlaylistById(id);
      set({ currentPlaylist: playlist, isLoading: false });
      return playlist;
    } catch (error) {
      set({ isLoading: false });
      return null;
    }
  },

  searchPlaylists: async (query: string) => {
    if (!query.trim()) {
      set({ searchResults: [] });
      return [];
    }
    try {
      set({ isSearching: true });
      const userPlaylists = get().userPlaylists;
      const publicPlaylists = get().publicPlaylists;
      const featuredPlaylists = get().featuredPlaylists;
      const map = new Map<string, Playlist>();
      userPlaylists.forEach(p => map.set(p._id, p));
      publicPlaylists.forEach(p => map.set(p._id, p));
      featuredPlaylists.forEach(p => map.set(p._id, p));
      const all = Array.from(map.values());
      const q = query.toLowerCase();
      const results = all.filter(p => (p.name || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q));
      set({ searchResults: results, isSearching: false });
      return results;
    } catch {
      set({ isSearching: false });
      return [];
    }
  },

  createPlaylist: async (name: string, description = '', isPublic = true, imageUrl = null) => {
    try {
      set({ isCreating: true });
      try {
        const playlistService = await loadPlaylistService();
        const playlist = await playlistService.createPlaylist(name, description, isPublic, imageUrl);
        const userPlaylists = [...get().userPlaylists, playlist];
        set({ userPlaylists, isCreating: false });
        return playlist;
      } catch {
        set({ isCreating: false });
        return null;
      }
    } catch {
      set({ isCreating: false });
      return null;
    }
  },

  updatePlaylist: async (id: string, data: { name?: string; description?: string; isPublic?: boolean; imageUrl?: string }) => {
    try {
      set({ isUpdating: true });
      const playlistService = await loadPlaylistService();
      const updatedPlaylist = await playlistService.updatePlaylist(id, data);
      const playlists = get().playlists.map(p => (p._id === id ? updatedPlaylist : p));
      const userPlaylists = get().userPlaylists.map(p => (p._id === id ? updatedPlaylist : p));
      set({ playlists, userPlaylists, currentPlaylist: updatedPlaylist, isUpdating: false });
    } catch {
      set({ isUpdating: false });
    }
  },

  deletePlaylist: async (id: string) => {
    try {
      set({ isDeleting: true });
      const playlistService = await loadPlaylistService();
      await playlistService.deletePlaylist(id);
      const playlists = get().playlists.filter(p => p._id !== id);
      const userPlaylists = get().userPlaylists.filter(p => p._id !== id);
      const featuredPlaylists = get().featuredPlaylists.filter(p => p._id !== id);
      set({ playlists, userPlaylists, featuredPlaylists, currentPlaylist: null, isDeleting: false });
    } catch {
      set({ isDeleting: false });
    }
  },

  addSongToPlaylist: async (playlistId: string, songIdOrObject: string | any) => {
    try {
      const playlist = get().currentPlaylist;
      if (!playlist) return;

      let song: any;
      if (typeof songIdOrObject === 'string') {
        const songId = songIdOrObject;
        song = playlist.songs.find(s => s._id === songId) || useMusicStore.getState().songs.find(s => s._id === songId) || {
          _id: songId,
          title: 'Unknown Song',
          artist: 'Unknown Artist',
          imageUrl: '',
          audioUrl: '',
          duration: 0,
          albumId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      } else {
        song = songIdOrObject;
        if (!song._id) song._id = `song-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      }

      try {
        const playlistService = await loadPlaylistService();
        const updatedPlaylist = await playlistService.addSongToPlaylist(playlistId, song);
        set({ currentPlaylist: updatedPlaylist });
        const userPlaylists = get().userPlaylists.map(p => (p._id === playlistId ? updatedPlaylist : p));
        const playlists = get().playlists.map(p => (p._id === playlistId ? updatedPlaylist : p));
        set({ userPlaylists, playlists });
        
        // Force refresh the current playlist to ensure we have the latest data
        setTimeout(async () => {
          await get().forceRefreshPlaylistById(playlistId);
        }, 500);
        
      } catch {
        const updatedSongs = [...playlist.songs, song];
        const updatedPlaylist = { ...playlist, songs: updatedSongs } as Playlist;
        set({ currentPlaylist: updatedPlaylist });
        const userPlaylistsUpdated = get().userPlaylists.map(p => (p._id === playlistId ? updatedPlaylist : p));
        const playlistsUpdated = get().playlists.map(p => (p._id === playlistId ? updatedPlaylist : p));
        set({ userPlaylists: userPlaylistsUpdated, playlists: playlistsUpdated });
        try {
          const playlistService = await loadPlaylistService();
          void playlistService.updatePlaylist(playlistId, { imageUrl: song.imageUrl });
        } catch {}
      }
    } catch {}
  },

  removeSongFromPlaylist: async (playlistId: string, songId: string) => {
    try {
      const playlistService = await loadPlaylistService();
      const updatedPlaylist = await playlistService.removeSongFromPlaylist(playlistId, songId);
      set({ currentPlaylist: updatedPlaylist });
    } catch {}
  },

  refreshAllData: async () => {
    try {
      set({ isLoading: true });
      await Promise.all([
        get().fetchUserPlaylists(),
        get().fetchPublicPlaylists(),
        get().fetchFeaturedPlaylists()
      ]);
      set({ lastRefresh: Date.now(), isLoading: false });
    } catch (error) {
      set({ isLoading: false });
    }
  },

  shouldRefresh: () => {
    const now = Date.now();
    const lastRefresh = get().lastRefresh;
    const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
    return now - lastRefresh > REFRESH_INTERVAL;
  }
}));


