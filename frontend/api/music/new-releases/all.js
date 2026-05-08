import { buildSongApiUrl } from '../utils.js';

export default async function handler(req, res) {
  try {
    const response = await fetch(buildSongApiUrl('/music/new-releases/all'));
    const data = await response.json();
    
    return res.status(200).json({ results: data });
  } catch (error) {
    console.error('Error in new releases API:', error);
    return res.status(500).json({ error: 'Failed to fetch new releases' });
  }
} 
