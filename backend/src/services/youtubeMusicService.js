import axios from 'axios';

// Base URL for YouTube Music API (Python FastAPI)
const YOUTUBE_MUSIC_API_BASE_URL = process.env.YOUTUBE_MUSIC_API_BASE_URL || 'http://localhost:8000';

// Helper function to make YouTube Music API calls
const fetchFromYouTubeMusic = async (endpoint, queryParams = {}) => {
  try {
    const queryString = Object.entries(queryParams)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
    
    const url = `${YOUTUBE_MUSIC_API_BASE_URL}${endpoint}${queryString ? `?${queryString}` : ''}`;
    
    console.log(`[YouTube Music] Fetching: ${url}`);
    const response = await axios.get(url, { timeout: 10000 });
    return response.data;
  } catch (error) {
    console.error(`[YouTube Music] Error on ${endpoint}:`, error.message);
    throw error;
  }
};

// Search YouTube Music
export const searchYouTubeMusic = async (query, filter = null, limit = 20) => {
  try {
    const params = { q: query, limit };
    if (filter) params.filter = filter;
    
    const data = await fetchFromYouTubeMusic('/search', params);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('[YouTube Music] Search failed:', error.message);
    return [];
  }
};

// Get search suggestions
export const getYouTubeSuggestions = async (query) => {
  try {
    const data = await fetchFromYouTubeMusic('/search/suggestions', { q: query });
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('[YouTube Music] Suggestions failed:', error.message);
    return [];
  }
};

// Get YouTube Music charts
export const getYouTubeCharts = async (country = 'ZZ') => {
  try {
    const data = await fetchFromYouTubeMusic('/charts', { country });
    return data || {};
  } catch (error) {
    console.error('[YouTube Music] Charts failed:', error.message);
    return {};
  }
};

// Get mood categories
export const getYouTubeMoods = async () => {
  try {
    const data = await fetchFromYouTubeMusic('/moods');
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('[YouTube Music] Moods failed:', error.message);
    return [];
  }
};

// Get mood playlist
export const getYouTubeMoodPlaylist = async (params) => {
  try {
    const data = await fetchFromYouTubeMusic(`/mood-playlist/${params}`);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('[YouTube Music] Mood playlist failed:', error.message);
    return [];
  }
};

// Get artist details
export const getYouTubeArtist = async (channelId) => {
  try {
    const data = await fetchFromYouTubeMusic(`/artist/${channelId}`);
    return data || {};
  } catch (error) {
    console.error('[YouTube Music] Artist failed:', error.message);
    throw error;
  }
};

// Get album details
export const getYouTubeAlbum = async (browseId) => {
  try {
    const data = await fetchFromYouTubeMusic(`/album/${browseId}`);
    return data || {};
  } catch (error) {
    console.error('[YouTube Music] Album failed:', error.message);
    throw error;
  }
};

// Get song details
export const getYouTubeSong = async (videoId) => {
  try {
    const data = await fetchFromYouTubeMusic(`/song/${videoId}`);
    return data || {};
  } catch (error) {
    console.error('[YouTube Music] Song failed:', error.message);
    throw error;
  }
};

// Get lyrics
export const getYouTubeLyrics = async (browseId) => {
  try {
    const data = await fetchFromYouTubeMusic(`/lyrics/${browseId}`);
    return data || { lyrics: null, source: null };
  } catch (error) {
    console.error('[YouTube Music] Lyrics failed:', error.message);
    return { lyrics: null, source: null };
  }
};

// Get watch playlist (radio)
export const getYouTubeWatchPlaylist = async (videoId, limit = 25, radio = true) => {
  try {
    const data = await fetchFromYouTubeMusic(`/watch/${videoId}`, { limit, radio });
    return data || { tracks: [], playlistId: null, lyrics: null };
  } catch (error) {
    console.error('[YouTube Music] Watch playlist failed:', error.message);
    return { tracks: [], playlistId: null, lyrics: null };
  }
};

// Get playlist
export const getYouTubePlaylist = async (playlistId) => {
  try {
    const data = await fetchFromYouTubeMusic(`/playlist/${playlistId}`);
    return data || {};
  } catch (error) {
    console.error('[YouTube Music] Playlist failed:', error.message);
    throw error;
  }
};

// Get home feed
export const getYouTubeHome = async (limit = 3) => {
  try {
    const data = await fetchFromYouTubeMusic('/home', { limit });
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('[YouTube Music] Home failed:', error.message);
    return [];
  }
};

// Health check
export const checkYouTubeMusicHealth = async () => {
  try {
    const data = await fetchFromYouTubeMusic('/healthz');
    return { available: true, status: data };
  } catch (error) {
    return { available: false, error: error.message };
  }
};
