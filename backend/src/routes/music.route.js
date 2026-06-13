import { Router } from "express";
import axios from "axios";
import * as jiosaavnService from "../services/jiosaavn.service.js";
import { 
  getTrendingSongs, 
  searchSongs, 
  getBollywoodSongs, 
  getHollywoodSongs, 
  getHindiSongs,
  getSongDetails,
  getAlbumDetails,
  searchAllPlatforms
} from "../controllers/music.controller.js";

const router = Router();

// Constants
const JIOSAAVN_API_BASE_URL = process.env.JIOSAAVN_API_BASE_URL || "https://mavrixfy-song-api.vercel.app/api";

// Proxy endpoint for JioSaavn search
router.get("/search", searchSongs);

// Unified search across JioSaavn and YouTube Music
router.get("/search/all", searchAllPlatforms);

// Get trending songs
router.get("/combined/trending", async (req, res) => {
  try {
    const jiosaavnTrending = await jiosaavnService.getTrendingSongs();
    res.json({ jiosaavn: jiosaavnTrending });
  } catch (error) {
    console.error("Error fetching trending songs:", error);
    res.status(500).json({ message: "Failed to fetch trending songs" });
  }
});

// Get Bollywood songs
router.get("/bollywood", getBollywoodSongs);

// Get Hollywood songs
router.get("/hollywood", getHollywoodSongs);

// Get Hindi songs
router.get("/hindi", getHindiSongs);

// Get song details
router.get("/songs/:id", getSongDetails);

// Get album details
router.get("/albums/:id", getAlbumDetails);

// Get song details
router.get("/combined/songs/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const songDetails = await jiosaavnService.getSongDetails(id);
    res.json(songDetails);
  } catch (error) {
    console.error("Error fetching song details:", error);
    res.status(500).json({ message: "Failed to fetch song details" });
  }
});

// Proxy endpoint for lyrics
router.get("/lyrics/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ message: "Song ID is required" });
    }
    
    const response = await axios.get(`${JIOSAAVN_API_BASE_URL}/lyrics?id=${id}`);
    
    res.json(response.data);
  } catch (error) {
    console.error("Error fetching lyrics:", error);
    res.status(500).json({ message: "Failed to fetch lyrics" });
  }
});

// Get trending songs (main endpoint)
router.get("/trending", getTrendingSongs);

export default router; 
