import {
  searchYouTubeMusic,
  getYouTubeSuggestions,
  getYouTubeCharts,
  getYouTubeMoods,
  getYouTubeMoodPlaylist,
  getYouTubeArtist,
  getYouTubeAlbum,
  getYouTubeSong,
  getYouTubeLyrics,
  getYouTubeWatchPlaylist,
  getYouTubePlaylist,
  getYouTubeHome,
  checkYouTubeMusicHealth
} from '../services/youtubeMusicService.js';

// Search YouTube Music
export const search = async (req, res) => {
  try {
    const { query, filter, limit } = req.query;
    
    if (!query) {
      return res.status(400).json({ 
        success: false, 
        message: 'Search query is required' 
      });
    }
    
    const data = await searchYouTubeMusic(
      query, 
      filter || null, 
      parseInt(limit) || 20
    );
    
    res.status(200).json({
      success: true,
      source: 'youtube-music',
      results: data
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to search YouTube Music',
      error: error.message 
    });
  }
};

// Get search suggestions
export const getSuggestions = async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({ 
        success: false, 
        message: 'Search query is required' 
      });
    }
    
    const data = await getYouTubeSuggestions(query);
    
    res.status(200).json({
      success: true,
      suggestions: data
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get suggestions',
      error: error.message 
    });
  }
};

// Get charts
export const getCharts = async (req, res) => {
  try {
    const { country } = req.query;
    const data = await getYouTubeCharts(country || 'ZZ');
    
    res.status(200).json({
      success: true,
      charts: data
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get charts',
      error: error.message 
    });
  }
};

// Get moods
export const getMoods = async (req, res) => {
  try {
    const data = await getYouTubeMoods();
    
    res.status(200).json({
      success: true,
      moods: data
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get moods',
      error: error.message 
    });
  }
};

// Get mood playlist
export const getMoodPlaylist = async (req, res) => {
  try {
    const { params } = req.params;
    
    if (!params) {
      return res.status(400).json({ 
        success: false, 
        message: 'Params are required' 
      });
    }
    
    const data = await getYouTubeMoodPlaylist(params);
    
    res.status(200).json({
      success: true,
      playlist: data
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get mood playlist',
      error: error.message 
    });
  }
};

// Get artist
export const getArtist = async (req, res) => {
  try {
    const { channelId } = req.params;
    
    if (!channelId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Channel ID is required' 
      });
    }
    
    const data = await getYouTubeArtist(channelId);
    
    res.status(200).json({
      success: true,
      artist: data
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get artist',
      error: error.message 
    });
  }
};

// Get album
export const getAlbum = async (req, res) => {
  try {
    const { browseId } = req.params;
    
    if (!browseId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Browse ID is required' 
      });
    }
    
    const data = await getYouTubeAlbum(browseId);
    
    res.status(200).json({
      success: true,
      album: data
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get album',
      error: error.message 
    });
  }
};

// Get song
export const getSong = async (req, res) => {
  try {
    const { videoId } = req.params;
    
    if (!videoId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Video ID is required' 
      });
    }
    
    const data = await getYouTubeSong(videoId);
    
    res.status(200).json({
      success: true,
      song: data
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get song',
      error: error.message 
    });
  }
};

// Get lyrics
export const getLyrics = async (req, res) => {
  try {
    const { browseId } = req.params;
    
    if (!browseId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Browse ID is required' 
      });
    }
    
    const data = await getYouTubeLyrics(browseId);
    
    res.status(200).json({
      success: true,
      lyrics: data
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get lyrics',
      error: error.message 
    });
  }
};

// Get watch playlist (radio)
export const getWatchPlaylist = async (req, res) => {
  try {
    const { videoId } = req.params;
    const { limit, radio } = req.query;
    
    if (!videoId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Video ID is required' 
      });
    }
    
    const data = await getYouTubeWatchPlaylist(
      videoId,
      parseInt(limit) || 25,
      radio !== 'false'
    );
    
    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get watch playlist',
      error: error.message 
    });
  }
};

// Get playlist
export const getPlaylist = async (req, res) => {
  try {
    const { playlistId } = req.params;
    
    if (!playlistId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Playlist ID is required' 
      });
    }
    
    const data = await getYouTubePlaylist(playlistId);
    
    res.status(200).json({
      success: true,
      playlist: data
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get playlist',
      error: error.message 
    });
  }
};

// Get home feed
export const getHome = async (req, res) => {
  try {
    const { limit } = req.query;
    const data = await getYouTubeHome(parseInt(limit) || 3);
    
    res.status(200).json({
      success: true,
      home: data
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get home feed',
      error: error.message 
    });
  }
};

// Health check
export const healthCheck = async (req, res) => {
  try {
    const health = await checkYouTubeMusicHealth();
    
    res.status(health.available ? 200 : 503).json({
      success: health.available,
      service: 'YouTube Music API',
      ...health
    });
  } catch (error) {
    res.status(503).json({ 
      success: false, 
      message: 'YouTube Music API is unavailable',
      error: error.message 
    });
  }
};
