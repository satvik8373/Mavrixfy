import { buildSongApiUrl } from '../utils.js';

export default async function handler(req, res) {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    const response = await fetch(buildSongApiUrl('/music/search/all', { query }));
    const data = await response.json();
    
    return res.status(200).json({ results: data });
  } catch (error) {
    console.error('Error in search API:', error);
    return res.status(500).json({ error: 'Failed to search songs' });
  }
} 
