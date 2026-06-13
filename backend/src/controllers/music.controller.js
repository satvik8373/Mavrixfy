import axios from 'axios';
import { searchYouTubeMusic } from '../services/youtubeMusicService.js';

// Base URL for JioSaavn API
const JIOSAAVN_API_BASE_URL = process.env.JIOSAAVN_API_BASE_URL || 'https://mavrixfy-song-api.vercel.app/api';

// Helper function to make JioSaavn API calls
const fetchFromJioSaavn = async (endpoint, queryParams = {}) => {
  try {
    const queryString = Object.entries(queryParams)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
    
    const url = `${JIOSAAVN_API_BASE_URL}/${endpoint}${queryString ? `?${queryString}` : ''}`;
    
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Get trending songs
export const getTrendingSongs = async (req, res) => {
  try {
    const data = await fetchFromJioSaavn('trending/songs');
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch trending songs',
      error: error.message 
    });
  }
};

// Search for songs
export const searchSongs = async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({ 
        success: false, 
        message: 'Search query is required' 
      });
    }
    
    const data = await fetchFromJioSaavn('search', { query });
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to search songs',
      error: error.message 
    });
  }
};

// Get Bollywood songs
export const getBollywoodSongs = async (req, res) => {
  try {
    const data = await fetchFromJioSaavn('search', { query: 'bollywood hits' });
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch Bollywood songs',
      error: error.message 
    });
  }
};

// Get Hollywood songs
export const getHollywoodSongs = async (req, res) => {
  try {
    const data = await fetchFromJioSaavn('search', { query: 'hollywood hits' });
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch Hollywood songs',
      error: error.message 
    });
  }
};

// Get Hindi songs
export const getHindiSongs = async (req, res) => {
  try {
    const data = await fetchFromJioSaavn('search', { query: 'hindi top songs' });
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch Hindi songs',
      error: error.message 
    });
  }
};

// Get song details
export const getSongDetails = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Song ID is required' 
      });
    }
    
    const data = await fetchFromJioSaavn('songs', { id });
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch song details',
      error: error.message 
    });
  }
};

// Get album details
export const getAlbumDetails = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Album ID is required' 
      });
    }
    
    const data = await fetchFromJioSaavn('albums', { id });
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch album details',
      error: error.message 
    });
  }
};

// Unified search across both JioSaavn and YouTube Music
export const searchAllPlatforms = async (req, res) => {
  try {
    const { query, limit } = req.query;
    
    if (!query) {
      return res.status(400).json({ 
        success: false, 
        message: 'Search query is required' 
      });
    }
    
    const searchLimit = parseInt(limit) || 15;
    
    // Search both platforms in parallel
    const [jiosaavnResults, youtubeResults] = await Promise.allSettled([
      fetchFromJioSaavn('search/songs', { query, limit: searchLimit })
        .catch(err => {
          console.error('[JioSaavn] Search failed:', err.message);
          return { data: { results: [] } };
        }),
      searchYouTubeMusic(query, 'songs', searchLimit)
        .catch(err => {
          console.error('[YouTube Music] Search failed:', err.message);
          return [];
        })
    ]);
    
    // Extract results safely
    const jiosaavn = jiosaavnResults.status === 'fulfilled' 
      ? (jiosaavnResults.value?.data?.results || jiosaavnResults.value?.results || [])
      : [];
    
    const youtube = youtubeResults.status === 'fulfilled' 
      ? (youtubeResults.value || [])
      : [];
    
    // Add source identifier to each result
    const jiosaavnWithSource = Array.isArray(jiosaavn) 
      ? jiosaavn.map(song => ({ ...song, source: 'jiosaavn' }))
      : [];
    
    const youtubeWithSource = Array.isArray(youtube) 
      ? youtube.map(song => ({ ...song, source: 'youtube' }))
      : [];
    
    // Combine results
    const allResults = [...jiosaavnWithSource, ...youtubeWithSource];
    
    res.status(200).json({
      success: true,
      query,
      total: allResults.length,
      sources: {
        jiosaavn: jiosaavnWithSource.length,
        youtube: youtubeWithSource.length
      },
      results: allResults
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to search across platforms',
      error: error.message 
    });
  }
}; 
