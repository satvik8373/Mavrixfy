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

export const recommendationFeedEnabled = () => {
  return false;
};

export const getRecommendationSessionId = () => {
  return 'disabled-recommendation-session';
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

export const trackRecommendationEvent = async (_payload: EventPayload) => {
  // Discard all events - no longer tracking recommendations
  return;
};

const getPlaybackContext = (progressSeconds = 0, durationSeconds = 0, surface = 'player') => ({
  progressSeconds,
  durationSeconds,
  completionRatio: durationSeconds > 0 ? Math.min(progressSeconds / durationSeconds, 1) : 0,
  surface,
});

export const trackSongPlayStarted = (_song: Song, _progressSeconds = 0, _durationSeconds = 0) => {
  // Discard - tracking disabled
};

export const trackSongComplete = (_song: Song, _durationSeconds = 0) => {
  // Discard - tracking disabled
};

export const trackSongSkip = (_song: Song | null, _progressSeconds: number, _durationSeconds: number) => {
  // Discard - tracking disabled
};

export const startRecommendationSessionTracking = () => {
  // Discard - tracking disabled
};

export const getRecommendationHomeFeed = async () => {
  return null;
};
