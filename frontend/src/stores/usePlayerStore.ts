import { createWithEqualityFn as create } from 'zustand/traditional';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Song } from '@/types';
import { trackSongSkip } from '@/services/recommendationService';

export type ShuffleMode = 'off' | 'normal' | 'smart';

export interface PlayerState {
  currentSong: Song | null;
  isPlaying: boolean;
  isShuffled: boolean;
  shuffleMode: ShuffleMode;
  isRepeating: boolean;
  queue: Song[];
  originalQueue: Song[];
  currentIndex: number;
  currentTime: number;
  duration: number;
  volume: number;
  audioOutputDevice: string | null;
  lastPlayNextTime: number;
  setCurrentSong: (song: Song) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setVolume: (volume: number) => void;
  seekTo: (time: number) => void;
  togglePlay: () => void;
  playAlbum: (songs: Song[], initialIndex: number) => void;
  playNext: () => void;
  playPrevious: () => void;
  toggleShuffle: () => void;
  setShuffleMode: (mode: ShuffleMode) => void;
  toggleRepeat: () => void;
  setUserInteracted: () => void;
  addToQueue: (song: Song) => void;
  playNextInQueue: (song: Song) => void;
  removeFromQueue: (index: number) => void;
  smartShuffle: () => void;
}

const persistedStateCache = new Map<string, string>();

const persistedPlayerStorage = createJSONStorage(() => ({
  getItem: (name: string) => localStorage.getItem(name),
  setItem: (name: string, value: string) => {
    if (persistedStateCache.get(name) === value) {
      return;
    }

    persistedStateCache.set(name, value);
    localStorage.setItem(name, value);
  },
  removeItem: (name: string) => {
    persistedStateCache.delete(name);
    localStorage.removeItem(name);
  },
}));

const isPlayableSong = (song: Song | null | undefined): song is Song => {
  return Boolean(song?.audioUrl && !song.audioUrl.startsWith('blob:'));
};

const findSongIndex = (songs: Song[], target: Song | null | undefined) => {
  if (!target) return -1;

  return songs.findIndex((song) =>
    song._id === target._id ||
    ((song as any).id && (song as any).id === (target as any).id) ||
    (song.title === target.title && song.artist === target.artist),
  );
};

const getRandomIndex = (currentIndex: number, length: number): number => {
  if (length <= 1) return 0;

  const potentialIndices = Array.from({ length }, (_, index) => index)
    .filter((index) => index !== currentIndex);

  return potentialIndices[Math.floor(Math.random() * potentialIndices.length)] ?? currentIndex;
};

const shuffleArray = <T>(array: T[]): T[] => {
  const shuffled = [...array];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled;
};

const smartShuffleArray = <T extends Song>(array: T[]): T[] => {
  if (array.length <= 2) return shuffleArray(array);

  const pool = shuffleArray(array);
  const result: T[] = [];
  const artistCounts: Record<string, number> = {};

  while (pool.length > 0) {
    let bestIndex = 0;
    let bestScore = -1;

    for (let index = 0; index < pool.length; index += 1) {
      const candidate = pool[index];
      const artist = candidate.artist || 'Unknown';
      const artistCount = artistCounts[artist] || 0;
      let score = 1 / (artistCount + 1);

      if (result.length > 0 && result[result.length - 1].artist === artist) {
        score *= 0.1;
      }

      score *= Math.random();

      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }

    const [selected] = pool.splice(bestIndex, 1);
    result.push(selected);
    artistCounts[selected.artist || 'Unknown'] = (artistCounts[selected.artist || 'Unknown'] || 0) + 1;
  }

  return result;
};

type AudioManagerModule = typeof import('@/utils/audioManager');

let audioManagerModulePromise: Promise<AudioManagerModule> | null = null;

const getAudioManagerModule = () => {
  audioManagerModulePromise ??= import('@/utils/audioManager');
  return audioManagerModulePromise;
};

const withAudioManager = (callback: (manager: AudioManagerModule['audioManager']) => void | Promise<void>) => {
  void getAudioManagerModule()
    .then(({ audioManager }) => callback(audioManager))
    .catch(() => {});
};

const syncQueueWithAudioManager = (queue: Song[], currentIndex: number) => {
  withAudioManager((audioManager) => {
    audioManager.setQueue(queue, currentIndex);
  });
};

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      currentSong: null,
      isPlaying: false,
      isShuffled: false,
      shuffleMode: 'off',
      isRepeating: false,
      queue: [],
      originalQueue: [],
      currentIndex: 0,
      currentTime: 0,
      duration: 0,
      volume: 100,
      audioOutputDevice: null,
      lastPlayNextTime: 0,

      setCurrentSong: (song) => {
        if (!isPlayableSong(song)) return;

        const state = get();
        const existingIndex = findSongIndex(state.queue, song);
        const nextQueue = existingIndex >= 0 ? state.queue : [song];
        const nextIndex = existingIndex >= 0 ? existingIndex : 0;

        set({
          currentSong: song,
          queue: nextQueue,
          originalQueue: existingIndex >= 0 && state.originalQueue.length > 0 ? state.originalQueue : nextQueue,
          currentIndex: nextIndex,
          currentTime: 0,
          duration: 0,
        });

        syncQueueWithAudioManager(nextQueue, nextIndex);
      },

      setIsPlaying: (nextIsPlaying) => {
        const state = get();

        if (!state.currentSong) {
          set({ isPlaying: false });
          return;
        }

        set({ isPlaying: nextIsPlaying });
        syncQueueWithAudioManager(state.queue, state.currentIndex);

        if (nextIsPlaying) {
          withAudioManager((audioManager) => audioManager.resumeSong());
          return;
        }

        withAudioManager((audioManager) => audioManager.pauseSong());
      },

      setCurrentTime: (time) => {
        const currentTime = get().currentTime;
        if (Math.abs(currentTime - time) >= 0.25) {
          set({ currentTime: time });
        }
      },

      setDuration: (duration) => {
        set({ duration });
      },

      setVolume: (volume) => {
        const nextVolume = Math.max(0, Math.min(volume, 100));
        set({ volume: nextVolume });
        withAudioManager((audioManager) => audioManager.setVolume(nextVolume / 100));
      },

      seekTo: (time) => {
        const duration = get().duration;
        const nextTime = Math.max(0, Math.min(time, duration || time));
        set({ currentTime: nextTime });
        withAudioManager((audioManager) => audioManager.seekTo(nextTime));
      },

      togglePlay: () => {
        const { isPlaying, setIsPlaying } = get();
        setIsPlaying(!isPlaying);
      },

      playAlbum: (songs, initialIndex) => {
        if (songs.length === 0) return;

        const requestedSong = songs[initialIndex];
        const validSongs = songs.filter(isPlayableSong);

        if (validSongs.length === 0) return;

        let validIndex = findSongIndex(validSongs, requestedSong);
        if (validIndex === -1) validIndex = 0;

        const originalQueue = [...validSongs];
        let playQueue = [...validSongs];
        let playIndex = validIndex;

        const { shuffleMode } = get();
        if (shuffleMode !== 'off' && validSongs.length > 1) {
          const selectedSong = validSongs[validIndex];
          const otherSongs = validSongs.filter((_, index) => index !== validIndex);

          playQueue = [
            selectedSong,
            ...(shuffleMode === 'smart' ? smartShuffleArray(otherSongs) : shuffleArray(otherSongs)),
          ];
          playIndex = 0;
        }

        const songToPlay = playQueue[playIndex];
        set({
          queue: playQueue,
          originalQueue,
          currentIndex: playIndex,
          currentSong: songToPlay,
          currentTime: 0,
          duration: 0,
          isPlaying: true,
        });

        syncQueueWithAudioManager(playQueue, playIndex);
        withAudioManager((audioManager) => audioManager.playSong(songToPlay));
      },

      playNext: () => {
        const { queue, currentIndex, shuffleMode } = get();
        if (queue.length === 0) return;
        const stateBeforeNext = get();
        trackSongSkip(
          stateBeforeNext.currentSong,
          stateBeforeNext.currentTime,
          stateBeforeNext.duration,
        );

        const now = Date.now();
        const lastPlayNextTime = get().lastPlayNextTime || 0;
        if (now - lastPlayNextTime < 250) return;

        if (queue.length === 1) {
          set({
            currentTime: 0,
            lastPlayNextTime: now,
            isPlaying: true,
          });
          withAudioManager((audioManager) => {
            audioManager.seekTo(0);
            return audioManager.resumeSong();
          });
          return;
        }

        const nextIndex = shuffleMode !== 'off'
          ? getRandomIndex(currentIndex, queue.length)
          : currentIndex >= queue.length - 1 ? 0 : currentIndex + 1;

        const nextSong = queue[nextIndex];
        set({
          currentIndex: nextIndex,
          currentSong: nextSong,
          currentTime: 0,
          duration: 0,
          isPlaying: true,
          lastPlayNextTime: now,
        });

        // Update lock screen metadata immediately so the OS shows the right song
        if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'playing';
        }

        syncQueueWithAudioManager(queue, nextIndex);
        withAudioManager((audioManager) => audioManager.playSong(nextSong));
      },

      playPrevious: () => {
        const { queue, currentIndex, isRepeating, isPlaying } = get();
        if (queue.length === 0) return;

        const elapsedSeconds = get().currentTime;
        if (elapsedSeconds > 3 && !isRepeating) {
          withAudioManager((audioManager) => audioManager.seekTo(0));
          set({
            currentTime: 0,
            isPlaying: true,
          });

          if (isPlaying) {
            withAudioManager((audioManager) => audioManager.resumeSong());
          }
          return;
        }

        const stateBeforePrevious = get();
        trackSongSkip(
          stateBeforePrevious.currentSong,
          elapsedSeconds || stateBeforePrevious.currentTime,
          stateBeforePrevious.duration,
        );

        const previousIndex = (currentIndex - 1 + queue.length) % queue.length;
        const previousSong = queue[previousIndex];

        set({
          currentIndex: previousIndex,
          currentSong: previousSong,
          currentTime: 0,
          duration: 0,
          isPlaying: true,
        });

        // Update lock screen metadata immediately so the OS shows the right song
        if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'playing';
        }

        syncQueueWithAudioManager(queue, previousIndex);
        withAudioManager((audioManager) => audioManager.playSong(previousSong));
      },

      toggleShuffle: () => {
        const state = get();
        const { queue, originalQueue, currentSong, currentIndex, shuffleMode } = state;

        let nextMode: ShuffleMode;
        switch (shuffleMode) {
          case 'off':
            nextMode = 'normal';
            break;
          case 'normal':
            nextMode = 'smart';
            break;
          default:
            nextMode = 'off';
            break;
        }

        const nextIsShuffled = nextMode !== 'off';

        if (!nextIsShuffled) {
          const restoredQueue = originalQueue.length > 0 ? [...originalQueue] : [...queue];
          const restoredIndex = Math.max(0, findSongIndex(restoredQueue, currentSong));
          set({
            isShuffled: false,
            shuffleMode: 'off',
            queue: restoredQueue,
            currentIndex: restoredIndex,
          });

          syncQueueWithAudioManager(restoredQueue, restoredIndex);
          return;
        }

        if (queue.length <= 1 || !currentSong) {
          set({
            isShuffled: true,
            shuffleMode: nextMode,
          });
          return;
        }

        const queueToStore = originalQueue.length > 0 ? originalQueue : [...queue];
        const currentSongIndex = findSongIndex(queue, currentSong);
        const otherSongs = queue.filter((_, index) => index !== currentSongIndex);
        const shuffledQueue = [
          currentSong,
          ...(nextMode === 'smart' ? smartShuffleArray(otherSongs) : shuffleArray(otherSongs)),
        ];

        set({
          isShuffled: true,
          shuffleMode: nextMode,
          queue: shuffledQueue,
          originalQueue: queueToStore,
          currentIndex: 0,
        });

        syncQueueWithAudioManager(shuffledQueue, 0);
      },

      setShuffleMode: (mode) => {
        const { queue, originalQueue, currentSong } = get();
        const nextIsShuffled = mode !== 'off';

        if (!nextIsShuffled) {
          const restoredQueue = originalQueue.length > 0 ? [...originalQueue] : [...queue];
          const restoredIndex = Math.max(0, findSongIndex(restoredQueue, currentSong));
          set({
            isShuffled: false,
            shuffleMode: 'off',
            queue: restoredQueue,
            currentIndex: restoredIndex,
          });

          syncQueueWithAudioManager(restoredQueue, restoredIndex);
          return;
        }

        if (queue.length <= 1 || !currentSong) {
          set({
            isShuffled: true,
            shuffleMode: mode,
          });
          return;
        }

        const queueToStore = originalQueue.length > 0 ? originalQueue : [...queue];
        const currentSongIndex = findSongIndex(queue, currentSong);
        const otherSongs = queue.filter((_, index) => index !== currentSongIndex);
        const shuffledQueue = [
          currentSong,
          ...(mode === 'smart' ? smartShuffleArray(otherSongs) : shuffleArray(otherSongs)),
        ];

        set({
          isShuffled: true,
          shuffleMode: mode,
          queue: shuffledQueue,
          originalQueue: queueToStore,
          currentIndex: 0,
        });

        syncQueueWithAudioManager(shuffledQueue, 0);
      },

      toggleRepeat: () => {
        set((state) => ({ isRepeating: !state.isRepeating }));
      },

      setUserInteracted: () => {
        // No-op with Howler as the centralized player, kept for compatibility with existing UI calls.
      },

      addToQueue: (song) => {
        if (!isPlayableSong(song)) return;

        const nextQueue = [...get().queue, song];
        set({ queue: nextQueue });
        syncQueueWithAudioManager(nextQueue, get().currentIndex);
      },

      playNextInQueue: (song) => {
        if (!isPlayableSong(song)) return;

        const { queue, currentIndex } = get();
        const nextQueue = [...queue];
        nextQueue.splice(currentIndex + 1, 0, song);

        set({ queue: nextQueue });
        syncQueueWithAudioManager(nextQueue, currentIndex);
      },

      removeFromQueue: (index) => {
        const state = get();
        const { queue, currentIndex, originalQueue, isPlaying } = state;
        if (index < 0 || index >= queue.length) return;

        const nextQueue = [...queue];
        const [removedSong] = nextQueue.splice(index, 1);
        const nextOriginalQueue = originalQueue.filter((song) => song._id !== removedSong?._id);

        if (nextQueue.length === 0) {
          set({
            queue: [],
            originalQueue: [],
            currentIndex: 0,
            currentSong: null,
            currentTime: 0,
            duration: 0,
            isPlaying: false,
          });
          withAudioManager((audioManager) => audioManager.stopSong());
          syncQueueWithAudioManager([], 0);
          return;
        }

        let nextIndex = currentIndex;
        if (index < currentIndex) {
          nextIndex = currentIndex - 1;
        } else if (index === currentIndex) {
          nextIndex = Math.min(currentIndex, nextQueue.length - 1);
        }

        const nextSong = nextQueue[nextIndex];

        set({
          queue: nextQueue,
          originalQueue: nextOriginalQueue,
          currentIndex: nextIndex,
          currentSong: nextSong,
          currentTime: index === currentIndex ? 0 : state.currentTime,
          duration: index === currentIndex ? 0 : state.duration,
          isPlaying: index === currentIndex ? isPlaying : state.isPlaying,
        });

        syncQueueWithAudioManager(nextQueue, nextIndex);

        if (index === currentIndex) {
          if (isPlaying) {
            withAudioManager((audioManager) => audioManager.playSong(nextSong));
          } else {
            withAudioManager((audioManager) => audioManager.stopSong());
          }
        }
      },

      smartShuffle: () => {
        const { queue, originalQueue } = get();
        if (queue.length === 0) return;

        const baseQueue = originalQueue.length > 0 ? [...originalQueue] : [...queue];
        const shuffledQueue = smartShuffleArray(baseQueue);

        set({
          queue: shuffledQueue,
          originalQueue: baseQueue,
          currentIndex: 0,
          currentSong: shuffledQueue[0],
          currentTime: 0,
          duration: 0,
          isShuffled: true,
          shuffleMode: 'smart',
          isPlaying: true,
        });

        syncQueueWithAudioManager(shuffledQueue, 0);
        withAudioManager((audioManager) => audioManager.playSong(shuffledQueue[0]));
      },
    }),
    {
      name: 'player-store:v1',
      storage: persistedPlayerStorage,
      partialize: (state) => ({
        currentSong: state.currentSong,
        queue: state.queue,
        originalQueue: state.originalQueue,
        currentIndex: state.currentIndex,
        isShuffled: state.isShuffled,
        shuffleMode: state.shuffleMode,
        isRepeating: state.isRepeating,
        volume: state.volume,
        audioOutputDevice: state.audioOutputDevice,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isPlaying = false;
          state.currentTime = 0;
          state.duration = 0;
        }
      },
    },
  ),
);

setTimeout(() => {
  const store = usePlayerStore.getState();

  if (store.currentSong && !isPlayableSong(store.currentSong)) {
    usePlayerStore.setState({ currentSong: null });
  }

  const cleanedQueue = store.queue.filter(isPlayableSong);
  const cleanedOriginalQueue = store.originalQueue.filter(isPlayableSong);

  if (cleanedQueue.length !== store.queue.length || cleanedOriginalQueue.length !== store.originalQueue.length) {
    usePlayerStore.setState({
      queue: cleanedQueue,
      originalQueue: cleanedOriginalQueue,
      currentIndex: Math.max(0, Math.min(store.currentIndex, Math.max(cleanedQueue.length - 1, 0))),
    });
  }

  const freshState = usePlayerStore.getState();
  if (!freshState.currentSong) return;

  withAudioManager((audioManager) => audioManager.setVolume(freshState.volume / 100));
  syncQueueWithAudioManager(freshState.queue, freshState.currentIndex);
}, 0);

