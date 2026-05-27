/**
 * Playlist Generator Service — Deep Mood Algorithm v2
 * 
 * Multi-layer pipeline:
 *   1. Receives emotion + context from emotionAnalyzer
 *   2. Maps to precise JioSaavn queries via genreMapper (TAG_MAP)
 *   3. Parallel fetch from JioSaavn with fallback APIs
 *   4. Quality filter (blocks remixes, lofi, ringtones)
 *   5. Post-fetch ranking algorithm (year + duration + variety)
 *   6. Returns top 20 ranked, shuffled songs
 */

import admin from '../../config/firebase.js';
import { searchSongs, getTrendingSongs } from '../jiosaavn.service.js';
import { getHighestQualityAudioUrl } from '../../lib/jiosaavnAudio.js';

const db = admin.firestore();
const PLAYLIST_SIZE = 20;
const MAX_PRIMARY_SEARCH_QUERIES = 3;
const MAX_SEARCH_RESULTS = 60;

// ─────────────────────────────────────────
// Fisher-Yates shuffle
// ─────────────────────────────────────────
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// ─────────────────────────────────────────
// Playlist name generator
// ─────────────────────────────────────────
function generatePlaylistName(emotion, context) {
  const emotionNames = {
    sadness: 'Melancholy', joy: 'Joyful', anger: 'Intense', love: 'Romantic',
    fear: 'Peaceful', surprise: 'Unexpected', calm: 'Calm', nostalgic: 'Nostalgic',
    heartbreak: 'Heartbreak', romantic: 'Romantic', motivated: 'Motivated',
    energetic: 'Energetic', party: 'Party', chill: 'Chill', lonely: 'Alone',
    dreamy: 'Dreamy', sleepy: 'Bedtime', hopeful: 'Hopeful', focused: 'Focus',
    workout: 'Workout', filmy: 'Filmy', sufi: 'Sufi', devotional: 'Bhakti',
    desi: 'Desi', melancholy: 'Melancholy', dark: 'Dark'
  };

  const contextLabels = {
    night: 'Late Night', rain: 'Baarish', travel: 'Road Trip', gym: 'Gym',
    study: 'Study', party: 'Party', morning: 'Morning', breakup: 'Breakup',
    devotional: 'Devotional', romantic: 'Date Night'
  };

  const label = emotionNames[emotion] || 'Mood';
  const ctx = contextLabels[context] || '';
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

  const templates = ctx ? [
    `${ctx} ${label} Mix`,
    `${label} ${ctx} Playlist`,
    `Your ${ctx} Vibes — ${label}`,
    `${label} Mood · ${ctx}`
  ] : [
    `${label} Vibes`,
    `Your ${label} Playlist`,
    `${label} Mood Mix`,
    `${label} Session · ${dateStr}`
  ];

  return templates[Math.floor(Math.random() * templates.length)];
}

// ─────────────────────────────────────────
// Quality filter — reject unofficial tracks
// ─────────────────────────────────────────
function isLowQualityTrack(name, artist, album) {
  const combined = `${name || ''} ${artist || ''} ${album || ''}`.toLowerCase();

  const banned = ['remix', 'lofi', 'lo-fi', 'ringtone', 'mashup', 'instrumental',
    '8d', 'slowed', 'reverb', 'sped up', 'speed up', 'nightcore', 'karaoke',
    'cover', 'unplugged', 'bgm', 'dj mix', 'dj remix', 'edit', 'extended mix', 'club mix',
    'jukebox', 'medley', 'tribute', 'version 2', 'reprise'];

  const compilationBanned = ['valentines', 'valentine', 'session', 'hits', 't20',
    'best of', 'rewind', 'top 50', 'top 100', 'collection', 'party mix',
    'lovescapes', 'love capes', 'unwind', 'evergreen', 'retro', 'classic',
    'non stop', 'megamix', 'bhajan', 'aarti', 'mantra', 'kids', 'nursery'];

  return banned.some(kw => combined.includes(kw)) ||
    compilationBanned.some(kw => (album || '').toLowerCase().includes(kw)) ||
    !name ||
    (artist || '').toLowerCase() === 'unknown artist';
}

// ─────────────────────────────────────────
// Format a JioSaavn raw song → app format
// ─────────────────────────────────────────
function decodeHtml(html) {
  if (!html || typeof html !== 'string') return html || '';
  return html
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function formatSong(song) {
  const artistName =
    song.artists?.primary?.[0]?.name ||
    song.artists?.all?.[0]?.name ||
    song.primaryArtists ||
    'Unknown Artist';

  // Robust image parsing
  let imageUrl = '';
  if (song.image && Array.isArray(song.image)) {
    const imgObj = song.image.find(i => i.quality === '500x500') ||
      song.image.find(i => i.quality === '150x150') ||
      song.image[song.image.length - 1];
    imageUrl = imgObj?.url || imgObj?.link || '';
  } else if (typeof song.image === 'string') {
    imageUrl = song.image;
  }

  // Robust audio URL parsing
  const audioUrl = getHighestQualityAudioUrl(song.downloadUrl);

  return {
    _id: song.id,
    title: decodeHtml(song.name || song.title || ''),
    artist: decodeHtml(artistName),
    albumId: song.album?.id || null,
    album: decodeHtml(song.album?.name || ''),
    duration: parseInt(song.duration) || 0,
    imageUrl,
    audioUrl,
    year: parseInt(song.year) || new Date().getFullYear(),
    source: 'jiosaavn',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

// ─────────────────────────────────────────
// Post-fetch ranking algorithm
// score = (yearScore * 40) + (durationScore * 30) + (popularity * 15) + (random * 15)
// ─────────────────────────────────────────
function rankSongs(songs) {
  const currentYear = new Date().getFullYear();

  return songs.map(song => {
    // Year score: prefer 2023–2026 songs. Max at currentYear, decays older
    const yearDiff = Math.max(0, currentYear - (song.year || 2020));
    const yearScore = Math.max(0, 100 - yearDiff * 12);  // lose 12 pts per year

    // Duration score: prefer 3–5 min songs (180–300s). Penalize extremes
    const dur = song.duration || 0;
    const durationScore = dur >= 180 && dur <= 360 ? 100 : dur >= 120 ? 60 : 20;

    // Random variety factor (0–100)
    const random = Math.floor(Math.random() * 100);

    const score = (yearScore * 0.40) + (durationScore * 0.30) + (random * 0.30);

    return { ...song, _rankScore: parseFloat(score.toFixed(2)) };
  }).sort((a, b) => b._rankScore - a._rankScore);
}

// ─────────────────────────────────────────
// Core: query songs from JioSaavn in parallel
// ─────────────────────────────────────────
async function querySongsByGenre(searchQueries, limit = 120) {
  try {
    console.log(`[PlaylistGenerator] Running ${searchQueries.length} parallel searches...`);
    const seenIds = new Set();
    const allSongs = [];

    // All queries in parallel
    const results = await Promise.allSettled(
      searchQueries.map(async (query) => {
        if (!query || !query.trim()) return [];
        console.log(`[PlaylistGenerator] Searching: "${query}"`);
        try {
          const result = await searchSongs(query, 40);
          return result?.data?.data?.results || result?.data?.results || [];
        } catch (err) {
          console.warn(`[PlaylistGenerator] Query failed: "${query}"`, err.message);
          return [];
        }
      })
    );

    // Merge + filter + deduplicate
    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      for (const song of (result.value || [])) {
        if (seenIds.has(song.id) || allSongs.length >= limit) continue;

        const formatted = formatSong(song);
        if (isLowQualityTrack(formatted.title, formatted.artist, formatted.album)) {
          continue;
        }
        if (!formatted.audioUrl) continue;

        allSongs.push(formatted);
        seenIds.add(song.id);
      }
    }

    console.log(`[PlaylistGenerator] Collected ${allSongs.length} unique valid songs`);
    return allSongs;

  } catch (error) {
    console.error('[PlaylistGenerator] querySongsByGenre error:', error.message);
    return [];
  }
}

// ─────────────────────────────────────────
// Trending fallback
// ─────────────────────────────────────────
async function getTrendingPlaylist() {
  try {
    console.log('[PlaylistGenerator] Fetching trending fallback...');
    const result = await getTrendingSongs(40);
    const songs = result?.data?.data?.results || result?.data?.results || [];
    if (!songs.length) return null;

    const formattedSongs = songs.map(formatSong).filter(s => s.audioUrl && !isLowQualityTrack(s.title, s.artist, s.album));

    return {
      _id: `trending_${Date.now()}`,
      name: 'Trending Now',
      songs: formattedSongs,
      songCount: formattedSongs.length,
      isPublic: true,
      source: 'jiosaavn'
    };
  } catch (error) {
    console.error('[PlaylistGenerator] Trending fallback failed:', error.message);
    return null;
  }
}

// ─────────────────────────────────────────
// MAIN: generatePlaylist
// Now accepts context from emotionAnalyzer
// ─────────────────────────────────────────
async function generatePlaylist(genres, emotion, moodText, context = null) {
  const startTime = Date.now();
  const primaryContext = context?.primary || null;

  try {
    console.log(`[PlaylistGenerator] Generating playlist for emotion="${emotion}" context="${primaryContext}"`);

    // genres here = already the mapped search queries from genreMapper
    // Use them directly as JioSaavn queries
    const searchQueries = Array.isArray(genres) ? genres.slice(0, MAX_PRIMARY_SEARCH_QUERIES) : [];

    let songs = await querySongsByGenre(searchQueries, MAX_SEARCH_RESULTS);

    // If still not enough, add trending as supplement
    if (songs.length < PLAYLIST_SIZE) {
      console.log(`[PlaylistGenerator] ${songs.length} songs found, fetching trending supplement...`);
      const trending = await getTrendingPlaylist();
      if (trending?.songs) {
        const trendingSeen = new Set(songs.map(s => s._id));
        const extras = trending.songs.filter(s => !trendingSeen.has(s._id));
        songs = [...songs, ...extras];
      }
    }

    if (songs.length === 0) {
      throw new Error('No songs found after all strategies, including trending fallback');
    }

    // Apply ranking algorithm
    const rankedSongs = rankSongs(songs);

    // Take top N, then shuffle the top pool for variety
    const topPool = rankedSongs.slice(0, Math.max(PLAYLIST_SIZE * 2, 40));
    shuffleArray(topPool);

    const selectedSongs = topPool.slice(0, PLAYLIST_SIZE).map(({ _rankScore, ...song }) => song);

    const playlistName = generatePlaylistName(emotion, primaryContext);
    const processingTime = Date.now() - startTime;

    console.log(`[PlaylistGenerator] ✓ "${playlistName}" – ${selectedSongs.length} songs in ${processingTime}ms`);

    return {
      _id: `mood_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: playlistName,
      emotion,
      context: primaryContext,
      moodText,
      songs: selectedSongs,
      songCount: selectedSongs.length,
      generatedAt: admin.firestore.Timestamp.now(),
      moodGenerated: true,
      cached: false
    };

  } catch (error) {
    console.error('[PlaylistGenerator] generatePlaylist error:', {
      error: error.message,
      emotion,
      moodText,
      processingTime: Date.now() - startTime
    });
    throw new Error('Something went wrong. Please try again.');
  }
}

export {
  generatePlaylist,
  shuffleArray,
  generatePlaylistName,
  querySongsByGenre,
  getTrendingPlaylist,
  rankSongs,
  formatSong,
  isLowQualityTrack
};
