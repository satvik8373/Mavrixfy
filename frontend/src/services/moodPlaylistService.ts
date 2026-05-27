import axiosInstance from '@/lib/axios';
import { Song } from '@/types';

export interface MoodPlaylist {
  _id: string;
  name: string;
  emotion: string;
  songs: Song[];
  songCount: number;
  generatedAt: string;
  cached?: boolean;
}

export interface RateLimitInfo {
  remaining: number;
  resetAt: string;
}

export interface GeneratePlaylistResponse {
  playlist: MoodPlaylist;
  rateLimitInfo?: RateLimitInfo;
}

export interface MoodCreditStatus {
  remaining: number;
  resetAt: string | null;
  dailyLimit: number;
  unlimited: boolean;
}

export interface RateLimitError {
  error: string;
  message: string;
  upgradeUrl?: string;
  resetAt: string;
}

const MOOD_GENERATE_TIMEOUT_MS = 60000;
const RETRY_DELAY_MS = 1200;

const isTransientNetworkError = (error: any): boolean => {
  if (!error) return false;
  if (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED') return true;
  const message = String(error.message || '').toLowerCase();
  return message.includes('network error') || message.includes('timeout');
};

/**
 * Generate a mood-based playlist from natural language input
 */
export const generateMoodPlaylist = async (moodText: string): Promise<GeneratePlaylistResponse> => {
  const request = () =>
    axiosInstance.post<GeneratePlaylistResponse>(
      '/playlists/mood-generate',
      { moodText },
      { timeout: MOOD_GENERATE_TIMEOUT_MS }
    );

  try {
    const response = await request();
    return response.data;
  } catch (error: any) {
    // One retry for flaky mobile/PWA network transitions.
    if (isTransientNetworkError(error)) {
      try {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        const retryResponse = await request();
        return retryResponse.data;
      } catch {
        // Fall through to existing error mapping.
      }
    }

    if (error.code === 'ECONNABORTED' || /timeout/i.test(error.message || '')) {
      throw new Error('Server is busy right now. Please wait a moment and try again.');
    }

    // Handle rate limit errors
    if (error.response?.status === 429) {
      const rateLimitError: RateLimitError = error.response.data;
      throw {
        isRateLimitError: true,
        ...rateLimitError,
      };
    }

    // Handle validation errors
    if (error.response?.status === 400) {
      throw new Error(error.response.data.message || 'Invalid mood description');
    }

    // Handle authentication errors
    if (error.response?.status === 401) {
      throw new Error('Please log in to generate mood playlists');
    }

    if (error.response?.status === 503 && error.response.data?.message) {
      throw new Error(error.response.data.message);
    }

    // Handle server errors
    if (error.response?.status >= 500) {
      throw new Error('Something went wrong. Please try again.');
    }

    // Generic error
    throw new Error(error.message || 'Failed to generate playlist');
  }
};

/**
 * Get current user's mood credit status.
 */
export const getMoodCreditStatus = async (): Promise<MoodCreditStatus> => {
  const response = await axiosInstance.get<MoodCreditStatus>('/playlists/mood-credit-status', {
    timeout: 10000
  });
  return response.data;
};

/**
 * Save a generated mood playlist to user's library
 */
export const saveMoodPlaylist = async (playlist: MoodPlaylist): Promise<{ playlistId: string }> => {
  try {
    const response = await axiosInstance.post('/playlists/mood-save', {
      playlistData: playlist
    });
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error('Please log in to save playlists');
    }

    throw new Error(error.response?.data?.message || 'Failed to save playlist');
  }
};

/**
 * Get all past saved mood playlists for the user
 */
export const getSavedMoodPlaylists = async (limit: number = 50): Promise<MoodPlaylist[]> => {
  try {
    const response = await axiosInstance.get(`/playlists/mood-saved?limit=${limit}`);
    return response.data.playlists || [];
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error('Please log in to view saved playlists');
    }
    throw new Error(error.response?.data?.message || 'Failed to load saved playlists');
  }
};

/**
 * Share a mood playlist and get a shareable link
 */
export const shareMoodPlaylist = async (playlistId: string): Promise<{ shareUrl: string; shareId: string }> => {
  try {
    const response = await axiosInstance.post(`/playlists/${playlistId}/share`);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 401) {
      throw new Error('Please log in to share playlists');
    }

    throw new Error(error.response?.data?.message || 'Failed to share playlist');
  }
};

/**
 * Get a shared playlist by share ID (no authentication required)
 */
export const getSharedPlaylist = async (shareId: string): Promise<MoodPlaylist> => {
  try {
    const response = await axiosInstance.get(`/playlists/share/${shareId}`);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      throw new Error('Shared playlist not found');
    }

    throw new Error(error.response?.data?.message || 'Failed to load shared playlist');
  }
};
