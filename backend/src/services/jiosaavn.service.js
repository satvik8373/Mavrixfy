import axios from 'axios';
import { getHighestQualityAudioUrl, getHighestQualityDownload } from '../lib/jiosaavnAudio.js';

const JIOSAAVN_API_BASE_URL = process.env.JIOSAAVN_API_BASE_URL || 'https://mavrixfy-song-api.vercel.app/api';
const FALLBACK_API_BASE_URL = 'https://saavn.me';
const BACKUP_API_BASE_URL = 'https://jiosaavn-api-privatecvc2.vercel.app';
const SEARCH_TIMEOUT_MS = Number(process.env.JIOSAAVN_SEARCH_TIMEOUT_MS || 3500);

/**
 * Search for songs, albums, artists on JioSaavn
 * @param {string} query - Search query
 * @param {number} limit - Number of results to return
 * @returns {Promise<Object>} - Search results
 */
export const searchSongs = async (query, limit = 20) => {
  const apis = [JIOSAAVN_API_BASE_URL, FALLBACK_API_BASE_URL, BACKUP_API_BASE_URL];

  const searchPromises = apis.map(async (apiUrl) => {
    try {
      console.log(`Trying JioSaavn API: ${apiUrl}/search/songs?query=${query}`);
      const response = await axios.get(`${apiUrl}/search/songs`, {
        params: { query, page: 1, limit },
        timeout: SEARCH_TIMEOUT_MS
      });
      if (response.data && response.data.success !== false) {
        const results = response.data.data?.results || response.data.results || [];
        return Array.isArray(results) ? results : Object.values(results);
      }
    } catch (error) {
      console.warn(`JioSaavn API ${apiUrl} failed for searchSongs:`, error.message);
    }
    return [];
  });

  const resultsArrays = await Promise.all(searchPromises);
  const allResults = [];
  const seenIds = new Set();

  for (const results of resultsArrays) {
    for (const song of results) {
      if (song && song.id && !seenIds.has(song.id)) {
        seenIds.add(song.id);
        allResults.push(song);
      }
    }
  }

  // Return empty array gracefully instead of throwing an error
  // This allows the backend and frontend to seamlessly merge catalog songs
  return {
    success: true,
    data: { results: allResults }
  };
};

/**
 * Search for playlists on JioSaavn with fallback APIs
 * @param {string} query - Search query
 * @param {number} limit - Number of results to return
 * @returns {Promise<Object>} - Search results
 */
export const searchPlaylists = async (query, limit = 10) => {
  const apis = [JIOSAAVN_API_BASE_URL, FALLBACK_API_BASE_URL, BACKUP_API_BASE_URL];

  for (const apiUrl of apis) {
    try {
      console.log(`Trying JioSaavn API: ${apiUrl}/search/playlists`);
      const response = await axios.get(`${apiUrl}/search/playlists`, {
        params: {
          query,
          page: 1,
          limit
        },
        timeout: 4500
      });

      console.log(`API ${apiUrl} response:`, response.data);

      // Check if we got valid data
      if (response.data && (response.data.success !== false)) {
        return response.data;
      }
    } catch (error) {
      console.warn(`JioSaavn API ${apiUrl} failed:`, error.message);
      // Try next API
    }
  }

  // If all APIs failed, return empty result
  console.error('All JioSaavn APIs failed for playlist search');
  return {
    success: true,
    data: {
      total: 0,
      start: 0,
      results: []
    }
  };
};

/**
 * Get trending songs from JioSaavn with 2026 focus
 * @param {number} limit - Number of results to return
 * @returns {Promise<Object>} - Trending songs
 */
export const getTrendingSongs = async (limit = 20) => {
  try {
    // Try 2026-specific trending terms first
    const trending2026Terms = [
      'latest bollywood 2026',
      'trending hindi 2026',
      'trending punjabi 2026',
      'trending gujarati 2026',
      'latest telugu 2026',
      'trending songs india 2026',
      'top indian hits 2026',
      'superhits 2026',
      'viral indian songs 2026'
    ];

    for (const term of trending2026Terms) {
      try {
        const response = await axios.get(`${JIOSAAVN_API_BASE_URL}/search/songs`, {
          params: {
            query: term,
            page: 1,
            limit
          }
        });

        if (response.data && response.data.results && response.data.results.length > 0) {
          return response.data;
        }
      } catch (error) {
        console.warn(`Failed to fetch with term: ${term}`, error.message);
      }
    }

    // Fallback to Indian-market trending
    const response = await axios.get(`${JIOSAAVN_API_BASE_URL}/search/songs`, {
      params: {
        query: 'trending hindi bollywood songs',
        page: 1,
        limit
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching JioSaavn trending songs:', error.message);
    throw error;
  }
};

/**
 * Get new releases from JioSaavn with 2026 focus
 * @param {number} limit - Number of results to return
 * @returns {Promise<Object>} - New releases
 */
export const getNewReleases = async (limit = 20) => {
  try {
    // Try 2026-specific new release terms first
    const newRelease2026Terms = [
      'fresh bollywood 2026',
      'new hindi songs 2026',
      'latest indian songs 2026',
      'new punjabi songs 2026',
      'latest telugu songs 2026',
      'latest tamil songs 2026'
    ];

    for (const term of newRelease2026Terms) {
      try {
        const response = await axios.get(`${JIOSAAVN_API_BASE_URL}/search/songs`, {
          params: {
            query: term,
            page: 1,
            limit
          }
        });

        if (response.data && response.data.results && response.data.results.length > 0) {
          return response.data;
        }
      } catch (error) {
        console.warn(`Failed to fetch with term: ${term}`, error.message);
      }
    }

    // Fallback to Indian-market new releases
    const response = await axios.get(`${JIOSAAVN_API_BASE_URL}/search/songs`, {
      params: {
        query: 'new hindi bollywood releases',
        page: 1,
        limit
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching JioSaavn new releases:', error.message);
    throw error;
  }
};

/**
 * Get song details from JioSaavn
 * @param {string} id - Song ID
 * @returns {Promise<Object>} - Song details
 */
export const getSongDetails = async (id) => {
  try {
    const response = await axios.get(`${JIOSAAVN_API_BASE_URL}/songs`, {
      params: { ids: id }
    });

    // The API returns an array, so we need to extract the first item
    if (response.data && response.data.success && response.data.data && response.data.data.length > 0) {
      return {
        success: true,
        data: response.data.data[0]
      };
    }

    return response.data;
  } catch (error) {
    console.error('Error fetching JioSaavn song details:', error.message);
    throw error;
  }
};

/**
 * Get album details from JioSaavn
 * @param {string} id - Album ID
 * @returns {Promise<Object>} - Album details
 */
export const getAlbumDetails = async (id) => {
  try {
    const response = await axios.get(`${JIOSAAVN_API_BASE_URL}/albums`, {
      params: { id }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching JioSaavn album details:', error.message);
    throw error;
  }
};

/**
 * Get playlist details from JioSaavn with fallback APIs and multiple methods
 * @param {string} id - Playlist ID
 * @param {number} page - Page number (default: 1)
 * @param {number} limit - Number of songs per page (default: 50)
 * @returns {Promise<Object>} - Playlist details
 */
export const getPlaylistDetails = async (id, page = 1, limit = 50) => {
  const apis = [JIOSAAVN_API_BASE_URL, FALLBACK_API_BASE_URL, BACKUP_API_BASE_URL];
  const playlistUrl = `https://www.jiosaavn.com/featured/playlist/${id}`;

  console.log(`\n=== Fetching JioSaavn Playlist: ${id} ===`);

  for (const apiUrl of apis) {
    try {
      console.log(`Trying API: ${apiUrl}`);

      // Method 1: Try with link parameter (might return all songs)
      try {
        const response = await axios.get(`${apiUrl}/playlists`, {
          params: { link: playlistUrl },
          timeout: 15000
        });

        if (response.data && response.data.success !== false && response.data.songs) {
          console.log(`✓ Success with link parameter: ${response.data.songs.length} songs`);
          return response.data;
        }
      } catch (err) {
        console.log(`  link parameter failed: ${err.message}`);
      }

      // Method 2: Try with id parameter
      try {
        const response = await axios.get(`${apiUrl}/playlists`, {
          params: { id, page, limit },
          timeout: 15000
        });

        if (response.data && response.data.success !== false && response.data.songs) {
          console.log(`✓ Success with id parameter: ${response.data.songs.length} songs`);
          return response.data;
        }
      } catch (err) {
        console.log(`  id parameter failed: ${err.message}`);
      }

      // Method 3: Try old /playlist/ endpoint with query
      try {
        const response = await axios.get(`${apiUrl}/playlist/`, {
          params: { query: playlistUrl },
          timeout: 15000
        });

        if (response.data && response.data.success !== false) {
          const songs = response.data.data?.songs || response.data.songs || [];
          console.log(`✓ Success with query parameter: ${songs.length} songs`);
          return response.data.data || response.data;
        }
      } catch (err) {
        console.log(`  query parameter failed: ${err.message}`);
      }

    } catch (error) {
      console.warn(`API ${apiUrl} completely failed:`, error.message);
    }
  }

  console.error('=== All JioSaavn APIs failed for playlist details ===\n');
  throw new Error('Failed to get playlist details from all APIs');
};

/**
 * Get all songs from a playlist - tries multiple methods to get complete playlist
 * Fetches in pages if needed to overcome 10-song API limitation
 * @param {string} id - Playlist ID
 * @returns {Promise<Object>} - Complete playlist details with all songs
 */
export const getCompletePlaylistDetails = async (id) => {
  try {
    console.log(`\n=== Fetching Complete Playlist: ${id} ===`);

    // First try to get the playlist with link parameter (might return all songs)
    const playlistData = await getPlaylistDetails(id);

    if (!playlistData || !playlistData.data) {
      throw new Error('Invalid playlist response');
    }

    const data = playlistData.data || playlistData;
    let allSongs = data.songs || [];
    const totalSongs = data.songCount || data.list_count || data.song_count || allSongs.length;

    console.log(`Playlist: ${data.name || 'Unknown'}`);
    console.log(`  Total songs expected: ${totalSongs}`);
    console.log(`  First fetch returned: ${allSongs.length} songs`);

    // If we got all songs or close to it, return as is
    if (allSongs.length >= totalSongs || allSongs.length >= totalSongs * 0.9) {
      console.log(`✓ Got all songs (${allSongs.length}/${totalSongs})`);
      console.log(`=== End Playlist Fetch ===\n`);
      return playlistData;
    }

    // If we only got 10 songs but there are more, try pagination
    if (allSongs.length < totalSongs) {
      console.log(`⚠ Only got ${allSongs.length} songs, attempting pagination...`);

      const songsPerPage = 50; // Try to fetch 50 songs per page
      const totalPages = Math.ceil(totalSongs / songsPerPage);

      // Try fetching additional pages
      for (let page = 2; page <= Math.min(totalPages, 10); page++) {
        try {
          console.log(`  Fetching page ${page}...`);
          const pageData = await getPlaylistDetails(id, page, songsPerPage);

          if (pageData && pageData.data && pageData.data.songs) {
            const newSongs = pageData.data.songs;
            console.log(`  Page ${page} returned: ${newSongs.length} songs`);

            if (newSongs.length === 0) {
              console.log(`  No more songs, stopping pagination`);
              break;
            }

            // Add new songs (avoid duplicates by checking song IDs)
            const existingIds = new Set(allSongs.map(s => s.id));
            const uniqueNewSongs = newSongs.filter(s => !existingIds.has(s.id));
            allSongs = [...allSongs, ...uniqueNewSongs];

            console.log(`  Total songs now: ${allSongs.length}/${totalSongs}`);

            // If we have all songs, stop
            if (allSongs.length >= totalSongs) {
              console.log(`✓ Got all songs!`);
              break;
            }

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
          } else {
            console.log(`  Page ${page} returned no data, stopping`);
            break;
          }
        } catch (pageError) {
          console.warn(`  Failed to fetch page ${page}:`, pageError.message);
          break;
        }
      }

      // Update the data with all collected songs
      data.songs = allSongs;
      playlistData.data = data;

      console.log(`\n✓ Final result: ${allSongs.length}/${totalSongs} songs`);
      if (allSongs.length < totalSongs) {
        console.warn(`⚠ Could only fetch ${allSongs.length} of ${totalSongs} songs`);
        console.warn(`  This is a limitation of the JioSaavn unofficial APIs`);
      }
    }

    console.log(`=== End Playlist Fetch ===\n`);
    return playlistData;

  } catch (error) {
    console.error('Error fetching complete playlist:', error.message);
    throw error;
  }
};

/**
 * Get lyrics for a song from JioSaavn
 * @param {string} id - Song ID
 * @returns {Promise<Object>} - Lyrics
 */
export const getLyrics = async (id) => {
  try {
    const response = await axios.get(`${JIOSAAVN_API_BASE_URL}/lyrics`, {
      params: { id }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching JioSaavn lyrics:', error.message);
    throw error;
  }
};

/**
 * Format JioSaavn song data to a consistent format
 * @param {Object} song - JioSaavn song object
 * @returns {Object} - Formatted song object
 */
export const formatSongData = (song) => {
  if (!song) return null;

  const audio = getHighestQualityDownload(song.downloadUrl);

  return {
    id: song.id,
    title: song.name,
    artist: song.primaryArtists,
    album: song.album ? song.album.name : '',
    year: song.year,
    duration: song.duration,
    image: song.image && song.image.length > 2 ? song.image[2].url : '',
    audio,
    url: getHighestQualityAudioUrl(song.downloadUrl) || song.url || '',
    source: 'jiosaavn'
  };
};


/**
 * Alternative method: Get playlist songs by fetching album details
 * Some playlists are actually albums, this method tries to get all songs from the album
 * @param {string} id - Playlist/Album ID
 * @returns {Promise<Object>} - Complete playlist with all songs
 */
export const getPlaylistViaAlbum = async (id) => {
  try {
    console.log(`Trying album method for playlist: ${id}`);
    const albumData = await getAlbumDetails(id);

    if (albumData && albumData.data && albumData.data.songs) {
      console.log(`✓ Album method returned ${albumData.data.songs.length} songs`);
      return albumData;
    }

    return null;
  } catch (error) {
    console.log(`Album method failed: ${error.message}`);
    return null;
  }
};

/**
 * Comprehensive method to get all playlist songs using multiple strategies
 * @param {string} id - Playlist ID
 * @returns {Promise<Object>} - Complete playlist with maximum possible songs
 */
export const getPlaylistAllSongs = async (id) => {
  console.log(`\n=== Comprehensive Playlist Fetch: ${id} ===`);

  let bestResult = null;
  let maxSongs = 0;

  // Strategy 1: Try standard playlist fetch with pagination
  try {
    console.log('Strategy 1: Standard playlist fetch with pagination');
    const result = await getCompletePlaylistDetails(id);
    const songCount = result?.data?.songs?.length || 0;

    if (songCount > maxSongs) {
      maxSongs = songCount;
      bestResult = result;
      console.log(`✓ Strategy 1 got ${songCount} songs`);
    }
  } catch (error) {
    console.log(`Strategy 1 failed: ${error.message}`);
  }

  // Strategy 2: Try as album
  try {
    console.log('Strategy 2: Trying album method');
    const result = await getPlaylistViaAlbum(id);
    const songCount = result?.data?.songs?.length || 0;

    if (songCount > maxSongs) {
      maxSongs = songCount;
      bestResult = result;
      console.log(`✓ Strategy 2 got ${songCount} songs`);
    }
  } catch (error) {
    console.log(`Strategy 2 failed: ${error.message}`);
  }

  // Strategy 3: Try different API endpoints
  const apis = [FALLBACK_API_BASE_URL, BACKUP_API_BASE_URL];
  for (const apiUrl of apis) {
    try {
      console.log(`Strategy 3: Trying API ${apiUrl}`);
      const response = await axios.get(`${apiUrl}/playlists`, {
        params: { id, limit: 100 },
        timeout: 15000
      });

      const songCount = response.data?.data?.songs?.length || response.data?.songs?.length || 0;

      if (songCount > maxSongs) {
        maxSongs = songCount;
        bestResult = response.data;
        console.log(`✓ Strategy 3 (${apiUrl}) got ${songCount} songs`);
      }
    } catch (error) {
      console.log(`Strategy 3 (${apiUrl}) failed: ${error.message}`);
    }
  }

  console.log(`\n=== Best Result: ${maxSongs} songs ===\n`);

  if (!bestResult) {
    throw new Error('All strategies failed to fetch playlist');
  }

  return bestResult;
};

/**
 * Get playlist songs in chunks by searching for them individually
 * This is a workaround for the 10-song API limitation
 * @param {string} playlistId - Playlist ID
 * @param {string} playlistName - Playlist name for search context
 * @returns {Promise<Array>} - Array of songs
 */
export const getPlaylistSongsBySearch = async (playlistId, playlistName) => {
  try {
    console.log(`\n=== Fetching songs via search for: ${playlistName} ===`);

    // First get the basic playlist info to know total song count
    const basicPlaylist = await getPlaylistDetails(playlistId);
    const totalSongs = basicPlaylist?.data?.songCount || basicPlaylist?.data?.list_count || 0;
    const initialSongs = basicPlaylist?.data?.songs || [];

    console.log(`Initial fetch: ${initialSongs.length}/${totalSongs} songs`);

    if (initialSongs.length >= totalSongs || totalSongs <= 10) {
      return initialSongs;
    }

    // If we have less than total, try searching for the playlist name
    // and get more songs from search results
    const searchResults = await searchSongs(playlistName, Math.min(totalSongs, 100));
    const searchSongs = searchResults?.data?.results || [];

    console.log(`Search returned: ${searchSongs.length} songs`);

    // Combine initial songs with search results, removing duplicates
    const allSongs = [...initialSongs];
    const existingIds = new Set(initialSongs.map(s => s.id));

    for (const song of searchSongs) {
      if (!existingIds.has(song.id) && allSongs.length < totalSongs) {
        allSongs.push(song);
        existingIds.add(song.id);
      }
    }

    console.log(`Final count: ${allSongs.length}/${totalSongs} songs`);
    console.log(`=== End Search Method ===\n`);

    return allSongs;

  } catch (error) {
    console.error('Search method failed:', error.message);
    throw error;
  }
};
