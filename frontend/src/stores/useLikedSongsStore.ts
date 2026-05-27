import { createWithEqualityFn as create } from 'zustand/traditional';
import { persist } from 'zustand/middleware';
import { Song } from '../types';
import { useAuthStore } from './useAuthStore';

const loadLikedSongsFirestoreService = () => import('@/services/likedSongsService');

// Local backup service for offline or error scenarios
const localLikedSongsService = {
  getLikedSongs: (): Song[] => {
    const songs = localStorage.getItem('likedSongs:v1');
    return songs ? JSON.parse(songs) : [];
  },

  addLikedSong: (song: Song): void => {
    const songs = localLikedSongsService.getLikedSongs();
    const songId = song._id;

    // Check if song already exists
    if (songs.some((s: Song) => s._id === songId)) {
      return;
    }

    // Add the song
    songs.unshift(song);
    localStorage.setItem('likedSongs:v1', JSON.stringify(songs));
  },

  removeLikedSong: (songId: string): void => {
    const songs = localLikedSongsService.getLikedSongs();
    const filteredSongs = songs.filter((song: Song) => song._id !== songId);
    localStorage.setItem('likedSongs:v1', JSON.stringify(filteredSongs));
  },

  isLiked: (songId: string): boolean => {
    const songs = localLikedSongsService.getLikedSongs();
    return songs.some((song: Song) => song._id === songId);
  }
};

interface LikedSongsStore {
  likedSongs: Song[];
  likedSongIds: Set<string>;
  isLoading: boolean;
  isSaving: boolean;

  // Actions
  loadLikedSongs: (force?: boolean) => Promise<void>;
  addLikedSong: (song: Song) => Promise<void>;
  removeLikedSong: (songId: string) => Promise<void>;
  toggleLikeSong: (song: Song) => Promise<void>;
}

export const useLikedSongsStore = create<LikedSongsStore>()(
  persist(
    (set, get) => ({
      likedSongs: [],
      likedSongIds: new Set<string>(),
      isLoading: false,
      isSaving: false,

      loadLikedSongs: async (force = false) => {
        // Skip if already loading
        if (get().isLoading && !force) return;

        set({ isLoading: true });
        let hasChanged = false; // Move this outside the try block

        try {
          let songs: Song[] = [];
          const isAuthenticated = useAuthStore.getState().isAuthenticated;

          // Try Firestore first if user is authenticated
          if (isAuthenticated) {
            try {
              // Fetch from Firestore sorted by most recent first
              const likedSongsFirestoreService = await loadLikedSongsFirestoreService();
              const firebaseSongs = await likedSongsFirestoreService.loadLikedSongs();
              songs = firebaseSongs; // The service now returns Song[] directly with correct IDs
            } catch (firebaseError) {
              // Fall back to local storage if Firestore fails
              songs = localLikedSongsService.getLikedSongs();
            }
          } else {
            // Use local storage for anonymous users
            songs = localLikedSongsService.getLikedSongs();
          }

          // Build songIds set for efficient lookups
          const songIds = new Set<string>();
          songs.forEach((song: any) => {
            // Use the primary _id (which should be the Firestore document ID)
            if (song._id) {
              songIds.add(song._id);
            }
            // Also add originalId if it exists for backward compatibility
            if (song.originalId) {
              songIds.add(song.originalId);
            }
          });

          // Only update state if songs actually changed
          const existingSongs = get().likedSongs;
          hasChanged =
            existingSongs.length !== songs.length ||
            existingSongs.some((existing, i) => existing._id !== songs[i]?._id);

          if (hasChanged) {
            set({ likedSongs: songs, likedSongIds: songIds });
          }
        } catch (error) {
          // Don't clear existing songs on error, just keep what we have
        } finally {
          set({ isLoading: false });
          // Only dispatch event if songs actually changed to prevent excessive updates
          const currentCount = get().likedSongs.length;
          if (hasChanged) {
            try {
              document.dispatchEvent(new CustomEvent('likedSongsUpdated', {
                detail: {
                  source: 'useLikedSongsStore.loadLikedSongs',
                  timestamp: Date.now(),
                  count: currentCount
                }
              }));
            } catch { }
          }
        }
      },

      addLikedSong: async (song: Song) => {
        // Skip if already in progress
        if (get().isSaving) return;

        try {
          // Get the song ID consistently (handle both _id and id)
          const songId = song._id;
          if (!songId) {
            return;
          }

          // First check if it's already liked
          if (get().likedSongIds.has(songId)) {
            return;
          }

          set({ isSaving: true });

          // Ensure song has _id and likedAt for internal consistency
          const now = new Date().toISOString();
          const songToSave = {
            ...song,
            _id: songId,
            likedAt: song.likedAt || now, // Use existing likedAt or set current time
            createdAt: song.createdAt || now,
            updatedAt: now
          };

          // Optimistically update local state immediately for better UX
          const updatedSongs = [songToSave, ...get().likedSongs];
          const updatedSongIds = new Set(get().likedSongIds);

          // Add both canonical and alternative IDs for global UI consistency
          updatedSongIds.add(songId);
          // Store originalId if it exists for backward compatibility
          if ((song as any).originalId) {
            updatedSongIds.add((song as any).originalId);
          }

          // Update local state before Firestore to make UI response instant
          set({
            likedSongs: updatedSongs,
            likedSongIds: updatedSongIds
          });

          // Always update local storage as a backup
          localLikedSongsService.addLikedSong(songToSave);

          // Update Firestore if user is authenticated - don't await to prevent UI blocking
          const isAuthenticated = useAuthStore.getState().isAuthenticated;
          if (isAuthenticated) {
            // Pass the song's likedAt date if it exists (for Mavrixfy imports)
            void loadLikedSongsFirestoreService()
              .then((likedSongsFirestoreService) => likedSongsFirestoreService.addLikedSong(
                songToSave,
                'mavrixfy',
                undefined,
                songToSave.likedAt
              ))
              .catch(() => {
                // Error handled silently
              });
          }

          // Notify listeners through event - but throttle to prevent excessive updates
          // Use a debounced approach to prevent rapid-fire events
          if (!(window as any).likedSongsAddTimeout) {
            (window as any).likedSongsAddTimeout = setTimeout(() => {
              document.dispatchEvent(new CustomEvent('likedSongsUpdated'));
              delete (window as any).likedSongsAddTimeout;
            }, 16); // 16ms debounce (one frame at 60fps)
          }

          // Success without notification
        } catch (error) {
          // Error handled silently
        } finally {
          set({ isSaving: false });
        }
      },

      removeLikedSong: async (songId: string) => {
        // Skip if already in progress or invalid songId
        if (get().isSaving || !songId) {
          return;
        }

        try {
          set({ isSaving: true });

          // Find the song to see what IDs it has
          const songToRemove = get().likedSongs.find(s => s._id === songId);

          if (!songToRemove) {
            return;
          }

          // Optimistically update local state immediately
          // Use the exact _id from the song object (which should be the Firestore document ID)
          const currentSongs = get().likedSongs;
          const updatedSongs = currentSongs.filter(song => song._id !== songId);

          const updatedSongIds = new Set(get().likedSongIds);
          updatedSongIds.delete(songId);

          // Also remove any alternate id representation present in the set
          if ((songToRemove as any).originalId) {
            updatedSongIds.delete((songToRemove as any).originalId);
          }

          // Update local state before Firestore - force re-render
          set({
            likedSongs: updatedSongs,
            likedSongIds: updatedSongIds
          });

          // Always update local storage as a backup
          localLikedSongsService.removeLikedSong(songId);

          // Update Firestore if user is authenticated
          const isAuthenticated = useAuthStore.getState().isAuthenticated;
          if (isAuthenticated) {
            try {
              const likedSongsFirestoreService = await loadLikedSongsFirestoreService();
              await likedSongsFirestoreService.removeLikedSong(songId);
            } catch (firestoreError) {
              // Revert optimistic update if Firestore fails
              await get().loadLikedSongs();
              throw new Error('Failed to remove song from database');
            }
          }

          // Notify listeners through event - but throttle to prevent excessive updates
          // Use a debounced approach to prevent rapid-fire events
          if (!(window as any).likedSongsRemoveTimeout) {
            (window as any).likedSongsRemoveTimeout = setTimeout(() => {
              document.dispatchEvent(new CustomEvent('likedSongsUpdated'));
              delete (window as any).likedSongsRemoveTimeout;
            }, 16); // 16ms debounce (one frame at 60fps)
          }

        } catch (error) {
          // Revert optimistic update on error
          await get().loadLikedSongs();
        } finally {
          set({ isSaving: false });
        }
      },

      toggleLikeSong: async (song: Song) => {
        const songId = song._id;
        if (!songId) {
          return;
        }

        // Skip if already in progress
        if (get().isSaving) return;

        const isLiked = get().likedSongIds.has(songId);

        try {
          if (isLiked) {
            await get().removeLikedSong(songId);
          } else {
            await get().addLikedSong(song);
          }

          // Dispatch a CustomEvent with detailed information for better listener handling
          const detail = {
            songId,
            song,
            isLiked: !isLiked,
            timestamp: Date.now()
          };
          document.dispatchEvent(new CustomEvent('likedSongsUpdated', { detail }));
          document.dispatchEvent(new CustomEvent('songLikeStateChanged', { detail }));
        } catch (error) {
          // Error handled silently
        }
      },
    }),
    {
      name: 'liked-songs-storage',
      // Only persist specific parts of the state
      partialize: state => ({
        likedSongs: state.likedSongs,
      }),
    }
  )
);

// Hydrate likedSongIds from persisted storage immediately so hearts render filled on refresh
try {
  const persistedRaw = localStorage.getItem('liked-songs-storage');
  if (persistedRaw) {
    const persisted = JSON.parse(persistedRaw);
    const songs: any[] = persisted?.state?.likedSongs || [];
    const rebuiltIds = new Set<string>();
    songs.forEach((song: any) => {
      // Use the primary _id (which should be the Firestore document ID)
      if (song._id) {
        rebuiltIds.add(song._id);
      }
      // Also add originalId if it exists for backward compatibility
      if (song.originalId) {
        rebuiltIds.add(song.originalId);
      }
    });
    useLikedSongsStore.setState({ likedSongs: songs, likedSongIds: rebuiltIds });
    document.dispatchEvent(new CustomEvent('likedSongsUpdated', {
      detail: {
        source: 'useLikedSongsStore.initialHydration',
        timestamp: Date.now(),
        count: songs.length
      }
    }));
  }
} catch { }

// Subscribe to auth store changes to reload liked songs when authentication state changes
let lastUserId: string | null = useAuthStore.getState().userId;
let lastIsAuthenticated: boolean = useAuthStore.getState().isAuthenticated;

useAuthStore.subscribe((state) => {
  if (state.userId !== lastUserId || state.isAuthenticated !== lastIsAuthenticated) {
    lastUserId = state.userId;
    lastIsAuthenticated = state.isAuthenticated;
    useLikedSongsStore.getState().loadLikedSongs(true).catch(() => { });
  }
});

// Initialize the store by loading liked songs
// This must be done outside of any component to ensure it's only called once
// Use queueMicrotask instead of setTimeout to avoid performance violations
queueMicrotask(() => {
  useLikedSongsStore.getState().loadLikedSongs().catch(() => {
    // Error handling without logging
  });
});


