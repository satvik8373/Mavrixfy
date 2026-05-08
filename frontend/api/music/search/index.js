import { buildSongApiUrl, getHighestQualityDownload } from '../utils.js';

export default async function handler(req, res) {
  try {
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    // Extract query parameter
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required query parameter',
        timestamp: new Date().toISOString()
      });
    }
    
    // Add cache control headers (shorter for search queries)
    res.setHeader('Cache-Control', 'public, max-age=1800'); // Cache for 30 minutes
    
    const response = await fetch(
      buildSongApiUrl('/search/songs', { query, page: 1, limit: 20 })
    );
    
    if (!response.ok) {
      throw new Error(`JioSaavn API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Process and filter the data to ensure only valid entries are returned
    const processedResults = data.data.results
      .filter(item => item.downloadUrl && item.downloadUrl.length > 0)
      .map(item => {
        const audio = getHighestQualityDownload(item.downloadUrl);

        return {
          id: item.id,
          title: item.name,
          artist: item.primaryArtists,
          album: item.album.name,
          year: item.year,
          duration: item.duration,
          image: item.image[2].url,
          audio,
          url: audio?.url || audio?.link || '',
        };
      });
    
    return res.status(200).json({ 
      status: 'success',
      message: 'Songs search completed successfully',
      query: query,
      timestamp: new Date().toISOString(),
      data: { results: processedResults }
    });
  } catch (error) {
    console.error('Error in search API:', error);
    return res.status(500).json({ 
      status: 'error',
      message: 'Failed to search songs',
      error: error.message || 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
} 
