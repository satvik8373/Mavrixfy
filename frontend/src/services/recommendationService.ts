import axiosInstance from '@/lib/axios';
import { useAuthStore } from '@/stores/useAuthStore';
import { Song } from '@/types';

export type RecommendationEventType =
  | 'song_play'
  | 'song_complete'
  | 'song_skip'
  | 'song_replay'
  | 'playlist_save'
  | 'artist_follow'
  | 'search_query'
  | 'session_start'
  | 'session_end'
  | 'share_song';

export type RecommendationSource =
  | 'catalog'
  | 'jiosaavn'
  | 'liked'
  | 'history'
  | 'trending'
  | 'fresh'
  | 'regional';

export type RecommendationSectionId =
  | 'continueListening'
  | 'recommendedForYou'
  | 'freshDiscoveries'
  | 'popularNearYou'
  | 'basedOnActivity'
  | 'newReleases';

export interface RecommendationItem {
  id: string;
  contentId: string;
  kind: 'song' | 'playlist';
  source: RecommendationSource;
  title: string;
  subtitle: string;
  imageUrl?: string;
  routePath?: string;
  song?: Song & { source?: string };
  playlist?: any;
  artist?: string;
  album?: string;
  language?: string;
  genre?: string;
  moodTags?: string[];
}

export interface RecommendationSection {
  id: RecommendationSectionId;
  title: string;
  subtitle: string;
  items: RecommendationItem[];
}

export interface RecommendationFeed {
  generatedAt: string;
  cacheStatus: 'hit' | 'miss' | 'refresh';
  sectionOrder: RecommendationSectionId[];
  sections: RecommendationSection[];
}

export interface RecommendationEventContext {
  progressSeconds?: number;
  durationSeconds?: number;
  completionRatio?: number;
  position?: number;
  surface?: string;
}

interface EventPayload {
  eventType: RecommendationEventType;
  item?: Partial<RecommendationItem> | null;
  query?: string;
  context?: RecommendationEventContext;
}

const SESSION_KEY = 'recommendation_session_id:v1';
const SESSION_STARTED_KEY = 'recommendation_session_started:v1';
const SESSION_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const recentPlayStarts = new Map<string, number>();
let sessionListenersAttached = false;

export const recommendationFeedEnabled = () => {
  const configuredValue = String(import.meta.env.VITE_RECOMMENDATION_FEED_V1 || '').trim().toLowerCase();
  return configuredValue !== 'false';
};

const canTrack = () => {
  const { isAuthenticated, userId } = useAuthStore.getState();
  return Boolean(isAuthenticated && userId);
};

const createSessionId = () => {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `web-${random}`;
};

export const getRecommendationSessionId = () => {
  const startedAt = Number(sessionStorage.getItem(SESSION_STARTED_KEY) || 0);
  const current = sessionStorage.getItem(SESSION_KEY);
  if (current && startedAt && Date.now() - startedAt < SESSION_MAX_AGE_MS) return current;

  const next = createSessionId();
  sessionStorage.setItem(SESSION_KEY, next);
  sessionStorage.setItem(SESSION_STARTED_KEY, String(Date.now()));
  return next;
};

const getSongSource = (song: Partial<Song> & { source?: string }) => {
  const source = String(song.source || '');
  if (['catalog', 'jiosaavn', 'liked', 'history', 'trending', 'fresh', 'regional'].includes(source)) {
    return source;
  }
  if (source === 'jiosaavn' || String(song._id || '').startsWith('jiosaavn_')) return 'jiosaavn';
  return 'catalog';
};

export const recommendationItemFromSong = (
  song: Partial<Song> & { source?: string },
  source = getSongSource(song),
): RecommendationItem | null => {
  const contentId = String(song._id || '').trim();
  if (!contentId || !song.title) return null;

  return {
    id: `${source}:${contentId}`,
    contentId,
    kind: 'song',
    source: source as RecommendationSource,
    title: song.title,
    subtitle: song.artist || 'Unknown Artist',
    artist: song.artist || '',
    album: typeof song.album === 'string' ? song.album : '',
    imageUrl: song.imageUrl || '',
    song: song as Song,
  };
};

export const recommendationItemFromPlaylist = (playlist: any, source: RecommendationSource = 'catalog') => {
  const contentId = String(playlist?._id || playlist?.id || '').trim();
  if (!contentId || !playlist?.name) return null;

  return {
    id: `${source}:${contentId}`,
    contentId,
    kind: 'playlist' as const,
    source,
    title: playlist.name,
    subtitle: playlist.description || `${playlist.songCount || playlist.songs?.length || 0} songs`,
    imageUrl: playlist.imageUrl || '',
    playlist,
  };
};

export const trackRecommendationEvent = async ({
  eventType,
  item = null,
  query = '',
  context = {},
}: EventPayload) => {
  if (!canTrack()) return;

  try {
    await axiosInstance.post('/recommendations/events', {
      eventType,
      sessionId: getRecommendationSessionId(),
      occurredAt: new Date().toISOString(),
      item,
      query,
      context,
    });
  } catch {
    // Recommendation signals must never interrupt playback or navigation.
  }
};

const getPlaybackContext = (progressSeconds = 0, durationSeconds = 0, surface = 'player') => ({
  progressSeconds,
  durationSeconds,
  completionRatio: durationSeconds > 0 ? Math.min(progressSeconds / durationSeconds, 1) : 0,
  surface,
});

export const trackSongPlayStarted = (song: Song, progressSeconds = 0, durationSeconds = song.duration || 0) => {
  const item = recommendationItemFromSong(song);
  if (!item) return;

  const playKey = `${item.source}:${item.contentId}`;
  const lastStart = recentPlayStarts.get(playKey) || 0;
  const shouldCountReplay = progressSeconds <= 2 && lastStart > 0 && Date.now() - lastStart > 500;
  recentPlayStarts.set(playKey, Date.now());

  void trackRecommendationEvent({
    eventType: 'song_play',
    item,
    context: getPlaybackContext(progressSeconds, durationSeconds),
  });

  if (shouldCountReplay) {
    void trackRecommendationEvent({
      eventType: 'song_replay',
      item,
      context: getPlaybackContext(progressSeconds, durationSeconds),
    });
  }
};

export const trackSongComplete = (song: Song, durationSeconds = song.duration || 0) => {
  const item = recommendationItemFromSong(song);
  if (!item) return;

  void trackRecommendationEvent({
    eventType: 'song_complete',
    item,
    context: getPlaybackContext(durationSeconds, durationSeconds),
  });
};

export const trackSongSkip = (song: Song | null, progressSeconds: number, durationSeconds: number) => {
  if (!song || durationSeconds <= 0 || progressSeconds / durationSeconds >= 0.9) return;
  const item = recommendationItemFromSong(song);
  if (!item) return;

  void trackRecommendationEvent({
    eventType: 'song_skip',
    item,
    context: getPlaybackContext(progressSeconds, durationSeconds),
  });
};

export const startRecommendationSessionTracking = () => {
  if (sessionListenersAttached) return;
  sessionListenersAttached = true;

  const emitStart = () => {
    void trackRecommendationEvent({ eventType: 'session_start' });
  };

  const emitEnd = () => {
    void trackRecommendationEvent({ eventType: 'session_end' });
  };

  emitStart();
  window.addEventListener('pagehide', emitEnd);
  window.addEventListener('beforeunload', emitEnd);
};

export const getRecommendationHomeFeed = async () => {
  const response = await axiosInstance.get<{ success: boolean; feed: RecommendationFeed }>('/recommendations/home', {
    params: { sessionId: getRecommendationSessionId() },
  });
  return response.data.feed;
};
