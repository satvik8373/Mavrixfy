import axiosInstance from '../lib/axios';
import { resolveArtist } from '@/lib/resolveArtist';
import { Album, Song, Stats } from '@/types';
import { createWithEqualityFn as create } from 'zustand/traditional';
import { requestManager } from '@/services/requestManager';
import { getHighestQualityAudioUrl } from '@/utils/jiosaavnAudio';

interface IndianSong {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  year?: string;
  duration?: string;
  image: string;
  url?: string;
  likedAt?: string | Date; // For preserving original liked date (e.g., from Spotify)
}

interface MusicStore {
  songs: Song[];
  albums: Album[];
  isLoading: boolean;
  error: string | null;
  currentAlbum: Album | null;
  featuredSongs: Song[];
  madeForYouSongs: Song[];
  trendingSongs: Song[];
  indianNewReleases: IndianSong[];
  indianSearchResults: IndianSong[];
  bollywoodSongs: IndianSong[];
  hollywoodSongs: IndianSong[];
  hindiSongs: IndianSong[];
  isIndianMusicLoading: boolean;
  stats: Stats;

  fetchAlbums: () => Promise<void>;
  fetchAlbumById: (id: string) => Promise<void>;
  fetchFeaturedSongs: () => Promise<void>;
  fetchMadeForYouSongs: () => Promise<void>;
  fetchTrendingSongs: () => Promise<void>;
  fetchStats: () => Promise<void>;
  fetchSongs: () => Promise<void>;

  // Indian music methods
  fetchIndianNewReleases: () => Promise<void>;
  fetchBollywoodSongs: () => Promise<void>;
  fetchHollywoodSongs: () => Promise<void>;
  fetchHindiSongs: () => Promise<void>;
  searchIndianSongs: (query: string) => Promise<void>;
  convertIndianSongToAppSong: (song: IndianSong) => Song;
}

// Optimized music API request function with aggressive caching
async function fetchMusicJson(endpoint: string, params: Record<string, any> = {}, cacheTTL: number = 10 * 60 * 1000): Promise<any> {
  return requestManager.request({
    url: endpoint,
    method: 'GET',
    params
  }, {
    cache: true,
    cacheTTL,
    deduplicate: true,
    priority: endpoint.includes('search') ? 'high' : 'normal'
  });
}

function decodeHtml(html: string | undefined): string {
  if (!html) return '';
  return String(html)
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

// Convert JioSaavn track to IndianSong format
function convertSaavnTrack(item: any): IndianSong {
  const audioUrl = getHighestQualityAudioUrl(item.downloadUrl);

  // Get the best quality image
  let imageUrl = '';
  if (item.image && Array.isArray(item.image)) {
    const image = item.image.find((i: any) => i.quality === '500x500') ||
      item.image.find((i: any) => i.quality === '150x150') ||
      item.image[item.image.length - 1];
    imageUrl = image?.url || image?.link || '';
  } else if (typeof item.image === 'string') {
    imageUrl = item.image;
  }

  const rawArtist = item.primaryArtists || item.singers || (item.artistMap?.primary?.flatMap((a: any) => a?.name ? [a.name] : []).join(', ')) || resolveArtist(item);

  return {
    id: item.id,
    title: decodeHtml(item.name || item.title),
    artist: decodeHtml(rawArtist),
    album: decodeHtml(item.album?.name || item.album),
    year: item.year,
    duration: item.duration,
    image: imageUrl,
    url: audioUrl,
  };
}

export const useMusicStore = create<MusicStore>((set) => ({
  albums: [],
  songs: [],
  isLoading: false,
  error: null,
  currentAlbum: null,
  madeForYouSongs: [],
  featuredSongs: [],
  trendingSongs: [],
  indianNewReleases: [],
  indianSearchResults: [],
  bollywoodSongs: [],
  hollywoodSongs: [],
  hindiSongs: [],
  isIndianMusicLoading: false,
  stats: {
    totalSongs: 0,
    totalAlbums: 0,
    totalUsers: 0,
    totalArtists: 0,
  },



  fetchSongs: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await axiosInstance.get('/songs');
      set({ songs: response.data });
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchStats: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await axiosInstance.get('/stats');
      set({ stats: response.data });
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchAlbums: async () => {
    set({ isLoading: true, error: null });

    try {
      const response = await axiosInstance.get('/albums');
      set({ albums: response.data });
    } catch (error: any) {
      set({ error: (error?.response?.data?.message) || 'Failed to load songs' });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchAlbumById: async id => {
    set({ isLoading: true, error: null });
    try {
      const response = await axiosInstance.get(`/albums/${id}`);
      set({ currentAlbum: response.data });
    } catch (error: any) {
      set({ error: (error?.response?.data?.message) || 'Failed to load trending songs' });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchFeaturedSongs: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await axiosInstance.get('/songs/featured');
      set({ featuredSongs: response.data });
    } catch (error: any) {
      set({ error: error.response.data.message });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchMadeForYouSongs: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await axiosInstance.get('/songs/made-for-you');
      set({ madeForYouSongs: response.data });
    } catch (error: any) {
      set({ error: error.response.data.message });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchTrendingSongs: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await axiosInstance.get('/songs/trending');
      set({ trendingSongs: response.data });
    } catch (error: any) {
      set({ error: error.response.data.message });
    } finally {
      set({ isLoading: false });
    }
  },

  // Indian Music API Methods (optimized with request manager)
  fetchBollywoodSongs: async () => {
    set({ isIndianMusicLoading: true });
    try {
      const data = await fetchMusicJson('/jiosaavn/search/songs', { query: 'bollywood hits', limit: 15 });
      if (data?.data?.results) {
        const formattedResults = data.data.results
          // Don't filter out songs without downloadUrl - we can fetch it later
          .map((item: any) => convertSaavnTrack(item));
        set({ bollywoodSongs: formattedResults });
      } else {
        set({ bollywoodSongs: [] });
      }
    } catch (error) {
      set({ bollywoodSongs: [] });
    } finally {
      set({ isIndianMusicLoading: false });
    }
  },

  fetchHollywoodSongs: async () => {
    set({ isIndianMusicLoading: true });
    try {
      const data = await fetchMusicJson('/jiosaavn/search/songs', { query: 'english top hits', limit: 15 });
      if (data?.data?.results) {
        const formattedResults = data.data.results
          // Don't filter out songs without downloadUrl - we can fetch it later
          .map((item: any) => convertSaavnTrack(item));
        set({ hollywoodSongs: formattedResults });
      } else {
        set({ hollywoodSongs: [] });
      }
    } catch (error) {
      set({ hollywoodSongs: [] });
    } finally {
      set({ isIndianMusicLoading: false });
    }
  },

  fetchHindiSongs: async () => {
    set({ isIndianMusicLoading: true });
    try {
      const data = await fetchMusicJson('/jiosaavn/search/songs', { query: 'hindi top songs', limit: 15 });
      if (data?.data?.results) {
        const formattedResults = data.data.results
          // Don't filter out songs without downloadUrl - we can fetch it later
          .map((item: any) => convertSaavnTrack(item));
        set({ hindiSongs: formattedResults });
      } else {
        set({ hindiSongs: [] });
      }
    } catch (error) {
      set({ hindiSongs: [] });
    } finally {
      set({ isIndianMusicLoading: false });
    }
  },

  fetchIndianNewReleases: async () => {
    set({ isIndianMusicLoading: true });
    try {
      const data = await fetchMusicJson('/jiosaavn/new-releases', { limit: 10 });
      if (data?.data?.results) {
        const formattedResults = data.data.results
          // Don't filter out songs without downloadUrl - we can fetch it later
          .map((item: any) => convertSaavnTrack(item));
        set({ indianNewReleases: formattedResults });
      } else {
        set({ indianNewReleases: [] });
      }
    } catch (error) {
      set({ indianNewReleases: [] });
    } finally {
      set({ isIndianMusicLoading: false });
    }
  },

  searchIndianSongs: async query => {
    if (!query || query.trim() === '') return;

    set({ isIndianMusicLoading: true });
    try {
      const data = await fetchMusicJson('/jiosaavn/search/songs', { query: query.trim(), limit: 20 }, 60 * 1000);
      if (data?.data?.results) {
        const formattedResults = data.data.results
          // Don't filter out songs without downloadUrl - we can fetch it later
          .map((item: any) => convertSaavnTrack(item));
        set({ indianSearchResults: formattedResults });
      } else {
        set({ indianSearchResults: [] });
      }
    } catch (error) {
      set({ indianSearchResults: [] });
    } finally {
      set({ isIndianMusicLoading: false });
    }
  },

  convertIndianSongToAppSong: (song) => {
    const now = new Date().toISOString();
    const likedAtDate = song.likedAt ?
      (song.likedAt instanceof Date ? song.likedAt.toISOString() : song.likedAt) :
      now;
    const album = song.album?.trim() || null;

    return {
      _id: song.id || `indian-song-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      title: song.title || 'Unknown Title',
      artist: resolveArtist(song),
      album,
      albumId: album,
      imageUrl: song.image || '',
      audioUrl: song.url || '',
      duration: parseInt(song.duration || '0'),
      createdAt: now,
      updatedAt: now,
      likedAt: likedAtDate, // Use custom likedAt or current time
    };
  },
}));
