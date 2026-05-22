import { Howl, Howler } from 'howler';
import type { Song } from '@/types';
import { resolveArtist } from '@/lib/resolveArtist';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { trackSongComplete, trackSongPlayStarted } from '@/services/recommendationService';

type HowlNode = HTMLAudioElement & {
  setSinkId?: (sinkId: string) => Promise<void>;
  sinkId?: string;
};

const FALLBACK_ARTWORK = 'https://cdn.iconscout.com/icon/free/png-256/free-music-1779799-1513951.png';
const PLAY_ERROR_RETRY_LIMIT = 1;
const PROGRESS_INTERVAL_MS = 500;
const DEFAULT_SEEK_OFFSET = 10;

// ── Platform detection ────────────────────────────────────────────────────────
// Detected once at module load — never changes during a session.
const IS_IOS = typeof navigator !== 'undefined' &&
  /iPad|iPhone|iPod/.test(navigator.userAgent) &&
  !(window as any).MSStream;

const IS_IOS_PWA = IS_IOS &&
  (typeof (navigator as any).standalone === 'boolean'
    ? (navigator as any).standalone === true
    : window.matchMedia('(display-mode: standalone)').matches);

// ─────────────────────────────────────────────────────────────────────────────

const getSongKey = (song: Song | null | undefined): string =>
  song?._id || `${song?.title ?? 'unknown'}::${song?.artist ?? 'unknown'}`;

const normalizeAudioUrl = (audioUrl?: string): string => {
  if (!audioUrl) return '';
  return audioUrl.replace(/^http:\/\//i, 'https://').trim();
};

const isValidAudioUrl = (audioUrl?: string): boolean => {
  const normalized = normalizeAudioUrl(audioUrl);
  if (!normalized || normalized.startsWith('blob:')) return false;
  try {
    const parsed = new URL(normalized);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
};

const trySetActionHandler = (
  action: MediaSessionAction,
  handler: MediaSessionActionHandler | null,
) => {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* unsupported */ }
};

class AudioManager {
  private currentSound: Howl | null = null;
  private currentSong: Song | null = null;
  private queue: Song[] = [];
  private currentIndex = -1;
  private progressTimer: number | null = null;
  private volume = 1;
  private playRetryCounts = new Map<string, number>();
  private failedSongKeys = new Set<string>();
  private mediaSessionRegistered = false;
  private boundTimeUpdate: (() => void) | null = null;
  // Preloaded next-track Howl — eliminates gap between songs
  private preloadedSound: Howl | null = null;
  private preloadedSongKey: string | null = null;

  constructor() {
    Howler.autoUnlock = true;
    Howler.autoSuspend = false;
    // Keep pool at 1 — iOS only allows one active audio element in PWA mode
    Howler.html5PoolSize = 1;
    this.registerMediaSessionHandlers();
    this.attachDebugHandles();
  }

  // ── Debug ─────────────────────────────────────────────────────────────────
  private attachDebugHandles() {
    if (typeof window === 'undefined') return;
    const w = window as any;
    w.mavrixfyAudioManager = this;
    w.currentSound = this.currentSound;
    w.mavrixfyFailedSongs = Array.from(this.failedSongKeys);
  }

  private syncDebugHandles() {
    if (typeof window === 'undefined') return;
    const w = window as any;
    w.currentSound = this.currentSound;
    w.mavrixfyFailedSongs = Array.from(this.failedSongKeys);
  }

  private getCurrentNode(): HowlNode | null {
    return ((this.currentSound as any)?._sounds?.[0]?._node as HowlNode | undefined) ?? null;
  }

  // ── Position state ────────────────────────────────────────────────────────
  // Driven by native <audio> timeupdate so it fires even when backgrounded/locked.
  private syncPositionState() {
    const duration = this.getDuration();
    const position = this.getCurrentTime();

    usePlayerStore.setState({ currentTime: position, duration });

    if (
      typeof navigator === 'undefined' ||
      !('mediaSession' in navigator) ||
      !('setPositionState' in navigator.mediaSession)
    ) return;

    // Guard: setPositionState throws if values are invalid
    if (
      !Number.isFinite(duration) || duration <= 0 ||
      !Number.isFinite(position) || position < 0
    ) return;

    try {
      navigator.mediaSession.setPositionState({
        duration,
        position: Math.min(position, duration),
        playbackRate: 1,
      });
    } catch { /* ignore */ }
  }

  // ── Native timeupdate ─────────────────────────────────────────────────────
  private attachNativeTimeUpdate() {
    this.detachNativeTimeUpdate();
    const node = this.getCurrentNode();
    if (!node) { this.startFallbackTimer(); return; }
    this.boundTimeUpdate = () => this.syncPositionState();
    node.addEventListener('timeupdate', this.boundTimeUpdate);
  }

  private detachNativeTimeUpdate() {
    const node = this.getCurrentNode();
    if (node && this.boundTimeUpdate) {
      node.removeEventListener('timeupdate', this.boundTimeUpdate);
    }
    this.boundTimeUpdate = null;
    this.clearFallbackTimer();
  }

  private clearFallbackTimer() {
    if (this.progressTimer !== null) {
      window.clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
  }

  private startFallbackTimer() {
    this.clearFallbackTimer();
    this.progressTimer = window.setInterval(() => this.syncPositionState(), PROGRESS_INTERVAL_MS);
  }

  // ── Metadata ──────────────────────────────────────────────────────────────
  // iOS quirks (researched):
  //   • Only the FIRST artwork entry is used on iOS — put smallest first so it
  //     renders sharply in the small lock-screen widget (96×96 or 128×128).
  //   • iOS 18+ uses 512×512 for the full-screen player; include it last.
  //   • album field is ignored on iOS when artist is set — omit to save bytes.
  //   • Artwork must be an absolute HTTPS URL — blob: URLs work on desktop but
  //     are unreliable on iOS PWA.
  private updateMediaMetadata(song: Song | null) {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    if (!song) { navigator.mediaSession.metadata = null; return; }

    const raw = song.imageUrl?.startsWith('http')
      ? song.imageUrl
      : song.imageUrl
        ? new URL(song.imageUrl, window.location.origin).toString()
        : FALLBACK_ARTWORK;

    // Ensure HTTPS — some CDN URLs come as HTTP
    const artworkUrl = raw.replace(/^http:\/\//i, 'https://');

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.title || 'Unknown Title',
        artist: resolveArtist(song),
        // album intentionally omitted — iOS ignores it when artist is set,
        // and on Android it takes up space without adding value here.
        artwork: [
          // Smallest first — iOS picks the first entry for the lock-screen widget
          { src: artworkUrl, sizes: '96x96',   type: 'image/jpeg' },
          { src: artworkUrl, sizes: '128x128', type: 'image/jpeg' },
          { src: artworkUrl, sizes: '192x192', type: 'image/jpeg' },
          { src: artworkUrl, sizes: '256x256', type: 'image/jpeg' },
          { src: artworkUrl, sizes: '512x512', type: 'image/jpeg' },
        ],
      });
    } catch { /* ignore */ }
  }

  // ── Media Session handlers ────────────────────────────────────────────────
  // Critical iOS rule (from research):
  //   Registering seekbackward + seekforward REPLACES the nexttrack/previoustrack
  //   buttons with skip-10s buttons on iOS Control Center / lock screen.
  //   Solution: on iOS, register ONLY nexttrack/previoustrack (no seek handlers).
  //   On Android/Chrome, register all handlers for full seek bar support.
  private registerMediaSessionHandlers() {
    if (
      typeof navigator === 'undefined' ||
      this.mediaSessionRegistered ||
      !('mediaSession' in navigator)
    ) return;
    this.mediaSessionRegistered = true;

    // play / pause — universal
    trySetActionHandler('play', () => {
      if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
      }
      void this.resumeSong();
    });

    trySetActionHandler('pause', () => {
      if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
      }
      this.pauseSong();
    });

    // nexttrack / previoustrack — universal
    // Set playbackState = 'playing' immediately so iOS doesn't remove controls
    // while the new track is loading.
    trySetActionHandler('nexttrack', () => {
      if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
      }
      usePlayerStore.setState({ lastPlayNextTime: 0 });
      usePlayerStore.getState().playNext();
    });

    trySetActionHandler('previoustrack', () => {
      if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
      }
      usePlayerStore.getState().playPrevious();
    });

    if (IS_IOS) {
      // iOS: do NOT register seekbackward/seekforward — they hide next/prev buttons.
      // Explicitly null them out in case a previous registration exists.
      trySetActionHandler('seekbackward', null);
      trySetActionHandler('seekforward', null);
      // seekto still works on iOS for progress bar scrubbing
      trySetActionHandler('seekto', (details) => {
        if (typeof details.seekTime !== 'number') return;
        this.seekTo(details.seekTime);
        this.syncPositionState();
      });
    } else {
      // Android / Chrome / desktop: register full seek support
      trySetActionHandler('seekto', (details) => {
        if (typeof details.seekTime !== 'number') return;
        this.seekTo(details.seekTime);
        this.syncPositionState();
      });

      trySetActionHandler('seekbackward', (details) => {
        const offset = details.seekOffset ?? DEFAULT_SEEK_OFFSET;
        this.seekTo(Math.max(0, this.getCurrentTime() - offset));
        this.syncPositionState();
      });

      trySetActionHandler('seekforward', (details) => {
        const offset = details.seekOffset ?? DEFAULT_SEEK_OFFSET;
        const dur = this.getDuration();
        this.seekTo(dur > 0 ? Math.min(dur, this.getCurrentTime() + offset) : this.getCurrentTime() + offset);
        this.syncPositionState();
      });
    }
  }

  // ── Preload next track ────────────────────────────────────────────────────
  // Called ~3s after a song starts. Silently loads the next track's audio so
  // it's buffered and ready — eliminates the gap between songs.
  // Only preloads on non-iOS (iOS PWA allows only one active audio element).
  private schedulePreload() {
    if (IS_IOS_PWA) return; // iOS PWA: one audio element only

    window.setTimeout(() => {
      const store = usePlayerStore.getState();
      const { queue, currentIndex, shuffleMode } = store;
      if (!queue.length) return;

      const nextIndex = shuffleMode !== 'off'
        ? -1 // skip preload in shuffle — next song is unpredictable
        : currentIndex >= queue.length - 1 ? 0 : currentIndex + 1;

      if (nextIndex < 0) return;
      const nextSong = queue[nextIndex];
      if (!nextSong || !isValidAudioUrl(nextSong.audioUrl)) return;

      const key = getSongKey(nextSong);
      if (key === this.preloadedSongKey) return; // already preloaded

      // Dispose previous preload
      this.disposePreload();

      const url = normalizeAudioUrl(nextSong.audioUrl);
      this.preloadedSound = new Howl({
        src: [url],
        html5: true,
        preload: true,
        volume: 0,       // silent — just buffering
        autoplay: false,
      });
      this.preloadedSongKey = key;
    }, 3000);
  }

  private disposePreload() {
    if (!this.preloadedSound) return;
    try {
      this.preloadedSound.off();
      this.preloadedSound.unload();
    } catch { /* ignore */ }
    this.preloadedSound = null;
    this.preloadedSongKey = null;
  }

  // ── Output device ─────────────────────────────────────────────────────────
  private async applyPreferredOutputDevice() {
    const preferredOutputId = usePlayerStore.getState().audioOutputDevice;
    if (!preferredOutputId) return;
    const node = this.getCurrentNode();
    if (!node || typeof node.setSinkId !== 'function') return;
    try { await node.setSinkId(preferredOutputId); } catch { /* ignore */ }
  }

  // ── Sound lifecycle ───────────────────────────────────────────────────────
  private disposeCurrentSound() {
    this.detachNativeTimeUpdate();
    if (!this.currentSound) { this.syncDebugHandles(); return; }
    try {
      this.currentSound.off();
      this.currentSound.stop();
      this.currentSound.unload();
    } catch { /* ignore */ }
    this.currentSound = null;
    this.syncDebugHandles();
  }

  private handlePlaybackFailure(song: Song, phase: 'load' | 'play', error: unknown) {
    const songKey = getSongKey(song);
    this.failedSongKeys.add(songKey);
    this.syncDebugHandles();
    console.error(`[audioManager] ${phase} failure`, { song, error });
    usePlayerStore.setState({ isPlaying: false, currentTime: 0, duration: 0 });
    const store = usePlayerStore.getState();
    if (store.queue.length > 1) { store.playNext(); return; }
    this.stopSong();
  }

  private handleTrackEnd() {
    const store = usePlayerStore.getState();
    if (store.isRepeating && this.currentSound) {
      this.seekTo(0);
      void this.resumeSong();
      return;
    }
    if (store.queue.length <= 1) {
      this.stopSong();
      usePlayerStore.setState({ isPlaying: false, currentTime: 0 });
      return;
    }
    usePlayerStore.setState({ lastPlayNextTime: 0 });
    store.playNext();
  }

  private buildHowl(song: Song) {
    const audioUrl = normalizeAudioUrl(song.audioUrl);
    const songKey = getSongKey(song);

    const howl = new Howl({
      src: [audioUrl],
      html5: true,   // MUST be true — Web Audio API breaks background on iOS PWA
      preload: true,
      volume: this.volume,

      onplay: () => {
        this.currentSong = song;
        this.currentSound = howl;
        this.syncDebugHandles();
        // Attach native timeupdate after play so the <audio> node exists
        this.attachNativeTimeUpdate();
        this.updateMediaMetadata(song);
        usePlayerStore.setState({
          currentSong: song,
          isPlaying: true,
          duration: howl.duration() || usePlayerStore.getState().duration,
        });
        if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'playing';
        }
        void this.applyPreferredOutputDevice();
        trackSongPlayStarted(song, this.getCurrentTime(), howl.duration() || song.duration || 0);
        this.syncPositionState();
        // Preload next track in background after song starts
        this.schedulePreload();
      },

      onpause: () => {
        usePlayerStore.setState({
          isPlaying: false,
          currentTime: this.getCurrentTime(),
          duration: this.getDuration(),
        });
        if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'paused';
        }
      },

      onstop: () => {
        this.detachNativeTimeUpdate();
        if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
          navigator.mediaSession.playbackState = 'none';
        }
      },

      onload: () => {
        usePlayerStore.setState({ duration: howl.duration() || 0 });
        this.syncPositionState();
      },

      onseek: () => {
        usePlayerStore.setState({ currentTime: this.getCurrentTime() });
        this.syncPositionState();
      },

      onend: () => {
        this.detachNativeTimeUpdate();
        usePlayerStore.setState({ currentTime: howl.duration() || 0 });
        trackSongComplete(song, howl.duration() || song.duration || 0);
        this.handleTrackEnd();
      },

      onloaderror: (_id, error) => {
        this.handlePlaybackFailure(song, 'load', error);
      },

      onplayerror: (_id, error) => {
        const retryCount = this.playRetryCounts.get(songKey) ?? 0;
        if (retryCount < PLAY_ERROR_RETRY_LIMIT) {
          this.playRetryCounts.set(songKey, retryCount + 1);
          howl.once('unlock', () => howl.play());
          window.setTimeout(() => {
            try { howl.play(); } catch (e) { this.handlePlaybackFailure(song, 'play', e); }
          }, 250);
          return;
        }
        this.handlePlaybackFailure(song, 'play', error);
      },
    });

    return howl;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  setQueue(songs: Song[], startIndex = 0) {
    this.queue = [...songs];
    this.currentIndex = songs.length === 0
      ? -1
      : Math.max(0, Math.min(startIndex, songs.length - 1));
  }

  async playSong(song: Song) {
    if (!song || !isValidAudioUrl(song.audioUrl)) {
      console.error('[audioManager] Refusing to play invalid audioUrl', song);
      this.handlePlaybackFailure(song, 'load', new Error('Invalid audio URL'));
      return;
    }

    // Always sync queue from store — keeps lock screen state fresh
    const storeState = usePlayerStore.getState();
    if (storeState.queue.length > 0) {
      this.queue = [...storeState.queue];
      this.currentIndex = storeState.currentIndex >= 0 ? storeState.currentIndex : 0;
    }

    const currentSongKey = getSongKey(this.currentSong);
    const nextSongKey = getSongKey(song);

    if (this.currentSound && currentSongKey === nextSongKey) {
      if (this.currentSound.state() === 'loading') return;
      if (!this.currentSound.playing()) this.currentSound.play();
      return;
    }

    this.playRetryCounts.delete(nextSongKey);
    Howler.stop();
    this.disposeCurrentSound();

    this.currentSong = song;
    this.updateMediaMetadata(song);

    // Use preloaded Howl if available — eliminates buffering gap
    if (this.preloadedSound && this.preloadedSongKey === nextSongKey) {
      this.currentSound = this.preloadedSound;
      this.preloadedSound = null;
      this.preloadedSongKey = null;
      // Restore volume (was 0 during preload)
      this.currentSound.volume(this.volume);
    } else {
      this.disposePreload();
      this.currentSound = this.buildHowl(song);
    }

    this.syncDebugHandles();

    usePlayerStore.setState({ currentSong: song, isPlaying: false, currentTime: 0, duration: 0 });
    this.currentSound.play();
  }

  pauseSong() {
    this.currentSound?.pause();
  }

  async resumeSong() {
    const store = usePlayerStore.getState();
    const song = store.currentSong ?? this.currentSong;
    if (!song) return;

    // Resume suspended AudioContext — happens after backgrounding on Android/desktop.
    // On iOS PWA we use html5:true so Howler.ctx may be null — that's fine.
    if (Howler.ctx && Howler.ctx.state === 'suspended') {
      try { await Howler.ctx.resume(); } catch { /* ignore */ }
    }

    if (!this.currentSound || getSongKey(song) !== getSongKey(this.currentSong)) {
      this.setQueue(store.queue, store.currentIndex);
      await this.playSong(song);
      return;
    }

    if (this.currentSound.state() === 'loading' || this.currentSound.playing()) return;
    this.currentSound.play();
  }

  stopSong() {
    this.disposePreload();
    this.disposeCurrentSound();
    this.currentSong = null;
    this.syncDebugHandles();
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'none';
    }
  }

  seekTo(timeInSeconds: number) {
    if (!this.currentSound) return;
    const duration = this.currentSound.duration() || 0;
    const next = Math.max(0, Math.min(timeInSeconds, duration || timeInSeconds));
    this.currentSound.seek(next);
    usePlayerStore.setState({ currentTime: next });
    this.syncPositionState();
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(volume, 1));
    this.currentSound?.volume(this.volume);
  }

  getVolume() { return this.volume; }

  getCurrentTime() {
    if (!this.currentSound) return 0;
    const t = this.currentSound.seek();
    return typeof t === 'number' ? t : 0;
  }

  getDuration() { return this.currentSound?.duration() || 0; }
  isPlaying() { return Boolean(this.currentSound?.playing()); }
  getCurrentSong() { return this.currentSong; }
  getQueue() { return [...this.queue]; }
  getCurrentIndex() { return this.currentIndex; }
  getCurrentNodeForOutput() { return this.getCurrentNode(); }

  async setOutputDevice(deviceId: string) {
    const node = this.getCurrentNode();
    if (!node || typeof node.setSinkId !== 'function') return false;
    try { await node.setSinkId(deviceId); return true; } catch { return false; }
  }

  async resumeIfPausedUnexpectedly() {
    const store = usePlayerStore.getState();
    if (!store.isPlaying || !store.currentSong) return;
    if (!this.currentSound) { await this.playSong(store.currentSong); return; }
    if (!this.currentSound.playing()) this.currentSound.play();
  }
}

export const audioManager = new AudioManager();

export const playSong = (song: Song) => audioManager.playSong(song);
export const pauseSong = () => audioManager.pauseSong();
export const resumeSong = () => audioManager.resumeSong();
export const stopSong = () => audioManager.stopSong();
export const setQueue = (songs: Song[], startIndex = 0) => audioManager.setQueue(songs, startIndex);
