import { Router } from 'express';
import {
  search,
  getSuggestions,
  getCharts,
  getMoods,
  getMoodPlaylist,
  getArtist,
  getAlbum,
  getSong,
  getLyrics,
  getWatchPlaylist,
  getPlaylist,
  getHome,
  healthCheck
} from '../controllers/youtubeMusic.controller.js';

const router = Router();

// Health check
router.get('/health', healthCheck);

// Search
router.get('/search', search);
router.get('/search/suggestions', getSuggestions);

// Charts and moods
router.get('/charts', getCharts);
router.get('/moods', getMoods);
router.get('/mood-playlist/:params', getMoodPlaylist);

// Content
router.get('/artist/:channelId', getArtist);
router.get('/album/:browseId', getAlbum);
router.get('/song/:videoId', getSong);
router.get('/lyrics/:browseId', getLyrics);
router.get('/watch/:videoId', getWatchPlaylist);
router.get('/playlist/:playlistId', getPlaylist);
router.get('/home', getHome);

export default router;
