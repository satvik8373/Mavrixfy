import admin from '../../config/firebase.js';
import { logPlaylistSaved } from './analytics.js';

/**
 * Save Playlist Handler for AI Mood Playlist Generator
 * 
 * Handles saving generated mood playlists to user's library.
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 14.4
 */

const db = admin.firestore();
const PLAYLISTS_COLLECTION = 'playlists';
const MOOD_HISTORY_MAX_RECORDS = 20;
const MOOD_HISTORY_SCAN_LIMIT = 250;
const MOOD_HISTORY_QUERY_TIMEOUT_MS = Number(process.env.MOOD_HISTORY_QUERY_TIMEOUT_MS || 8000);

const withQueryDeadline = (promise, label, timeoutMs = MOOD_HISTORY_QUERY_TIMEOUT_MS) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
        const error = new Error(`${label} timed out`);
        error.code = 'deadline-exceeded';
        reject(error);
    }, timeoutMs);

    promise
      .then(resolve, reject)
      .finally(() => clearTimeout(timer));
  });
};

const extractTimestampSeconds = (value) => {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
  }
  if (typeof value?._seconds === 'number') return value._seconds;
  if (typeof value?.seconds === 'number') return value.seconds;
  if (typeof value?.toDate === 'function') {
    const dt = value.toDate();
    return dt instanceof Date ? Math.floor(dt.getTime() / 1000) : 0;
  }
  return 0;
};

const enforceMoodHistoryRetention = async (userId) => {
  let snapshot;
  try {
      snapshot = await withQueryDeadline(db.collection(PLAYLISTS_COLLECTION)
        .where('createdBy.uid', '==', userId)
        .where('moodGenerated', '==', true)
        .orderBy('createdAt', 'desc')
        .limit(MOOD_HISTORY_SCAN_LIMIT)
        .get(), 'Mood history retention query');
  } catch (error) {
    if (error.code === 'deadline-exceeded') throw error;
    snapshot = await withQueryDeadline(db.collection(PLAYLISTS_COLLECTION)
      .where('createdBy.uid', '==', userId)
      .limit(MOOD_HISTORY_SCAN_LIMIT)
      .get(), 'Mood history retention fallback query');
  }

  const moodDocs = [];
  snapshot.forEach((doc) => {
    const data = doc.data();
    if (data?.moodGenerated === true) {
      moodDocs.push({ id: doc.id, ...data });
    }
  });

  if (moodDocs.length <= MOOD_HISTORY_MAX_RECORDS) return;

  moodDocs.sort((a, b) => {
    const aTs = extractTimestampSeconds(a.createdAt) || extractTimestampSeconds(a.generatedAt);
    const bTs = extractTimestampSeconds(b.createdAt) || extractTimestampSeconds(b.generatedAt);
    return bTs - aTs;
  });

  const docsToDelete = moodDocs.slice(MOOD_HISTORY_MAX_RECORDS);
  if (docsToDelete.length === 0) return;

  const batch = db.batch();
  docsToDelete.forEach((record) => {
    batch.delete(db.collection(PLAYLISTS_COLLECTION).doc(record.id));
  });
  await batch.commit();
};

/**
 * Save a generated mood playlist to user's library
 * 
 * @param {string} userId - User's Firebase UID
 * @param {Object} playlistData - Playlist data to save
 * @param {string} playlistData.name - Playlist name
 * @param {string} playlistData.emotion - Emotion label
 * @param {string[]} playlistData.songs - Array of song IDs
 * @param {string} [playlistData.moodText] - Original mood text
 * @param {Object} [userInfo] - User information for createdBy field
 * @param {string} [userInfo.fullName] - User's full name
 * @param {string} [userInfo.imageUrl] - User's profile image URL
 * @returns {Promise<Object>} Save result with playlist ID
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4
 */
export const savePlaylist = async (userId, playlistData, userInfo = {}) => {
  try {
    // Validate required fields
    if (!userId) {
      throw new Error('User ID is required');
    }

    if (!playlistData || !playlistData.name || !playlistData.emotion || !playlistData.songs) {
      throw new Error('Invalid playlist data: name, emotion, and songs are required');
    }

    if (!Array.isArray(playlistData.songs) || playlistData.songs.length === 0) {
      throw new Error('Playlist must contain at least one song');
    }

    // Prepare playlist document
    const playlist = {
      name: playlistData.name,
      description: playlistData.description || `A ${playlistData.emotion} mood playlist`,
      isPublic: false, // Private by default
      songs: playlistData.songs,
      songCount: playlistData.songs.length,
      createdBy: {
        id: userId,
        _id: userId,
        uid: userId,
        name: userInfo.fullName || 'Unknown User',
        fullName: userInfo.fullName || 'Unknown User',
        imageUrl: userInfo.imageUrl || '',
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      source: 'mood_playlist_generator',
      schemaVersion: 2,
      // Mood-specific fields (Requirement 9.2)
      moodGenerated: true,
      emotion: playlistData.emotion,
      moodText: playlistData.moodText || '',
      generatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Save to Firestore (Requirement 9.1)
    const docRef = await db.collection(PLAYLISTS_COLLECTION).add(playlist);
    try {
      // Keep only latest N mood records per user for better load/database management.
      await enforceMoodHistoryRetention(userId);
    } catch (retentionError) {
      console.warn('[SaveHandler] Mood history retention cleanup failed (non-critical):', {
        userId,
        error: retentionError.message
      });
    }

    // Log analytics event
    logPlaylistSaved(userId, docRef.id, playlistData.emotion);

    // Return confirmation with playlist ID (Requirement 9.3)
    return {
      success: true,
      playlistId: docRef.id,
      message: 'Playlist saved successfully',
      playlist: {
        _id: docRef.id,
        ...playlist,
      },
    };
  } catch (error) {
    // Log error details internally (Requirement 13.1)
    console.error('[SaveHandler] Error saving playlist:', {
      error: error.message,
      stack: error.stack,
      code: error.code,
      userId,
      timestamp: new Date().toISOString()
    });

    // Return descriptive error message (Requirement 9.5, 13.5)
    return {
      success: false,
      error: 'Failed to save playlist',
      message: getErrorMessage(error),
    };
  }
};

/**
 * Get user-friendly error message
 * 
 * @param {Error} error - Error object
 * @returns {string} User-friendly error message
 * 
 * Requirement: 9.5, 13.5
 */
const getErrorMessage = (error) => {
  // Don't expose technical details to users (Requirement 13.5)

  if (error.message.includes('required')) {
    return 'Something went wrong. Please try again.';
  }

  if (error.message.includes('Invalid playlist data')) {
    return 'Something went wrong. Please try again.';
  }

  if (error.code === 'permission-denied') {
    return 'Something went wrong. Please try again.';
  }

  if (error.code === 'unavailable') {
    return 'Something went wrong. Please try again.';
  }

  // Generic error message (Requirement 13.5)
  return 'Something went wrong. Please try again.';
};

/**
 * Get saved playlists for a user
 * 
 * @param {string} userId - User's Firebase UID
 * @param {number} [limit=50] - Maximum number of playlists to return
 * @returns {Promise<Object[]>} Array of saved playlists
 */
export const getUserPlaylists = async (userId, limit = 10, page = 1) => {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }
    const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), MOOD_HISTORY_MAX_RECORDS);
    const safePage = Math.max(Number(page) || 1, 1);

    let snapshot;
    try {
      snapshot = await withQueryDeadline(db.collection(PLAYLISTS_COLLECTION)
        .where('createdBy.uid', '==', userId)
        .where('moodGenerated', '==', true)
        .orderBy('createdAt', 'desc')
        .limit(MOOD_HISTORY_MAX_RECORDS)
        .get(), 'Mood history query');
    } catch (error) {
      if (error.code === 'deadline-exceeded') throw error;
      snapshot = await withQueryDeadline(db.collection(PLAYLISTS_COLLECTION)
        .where('createdBy.uid', '==', userId)
        .limit(MOOD_HISTORY_SCAN_LIMIT)
        .get(), 'Mood history fallback query');
    }

    const playlists = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      // Only return AI-generated mood playlists
      if (data.moodGenerated === true) {
        playlists.push({ _id: doc.id, ...data });
      }
    });

    // Sort by createdAt descending in memory
    playlists.sort((a, b) => {
      const ta = a.createdAt?._seconds || a.createdAt?.seconds || 0;
      const tb = b.createdAt?._seconds || b.createdAt?.seconds || 0;
      return tb - ta;
    });

    const startIndex = (safePage - 1) * safeLimit;
    const endIndex = startIndex + safeLimit;
    const totalPages = Math.ceil(playlists.length / safeLimit);

    return {
      playlists: playlists.slice(startIndex, endIndex),
      total: playlists.length,
      page: safePage,
      totalPages,
      hasMore: endIndex < playlists.length
    };
  } catch (error) {
    console.error('[SaveHandler] Error fetching user playlists:', {
      error: error.message,
      userId,
      timestamp: new Date().toISOString()
    });

    const wrappedError = new Error(`Failed to fetch playlists: ${error.message}`);
    wrappedError.code = error.code;
    throw wrappedError;
  }
};

/**
 * Delete a saved playlist
 * 
 * @param {string} userId - User's Firebase UID
 * @param {string} playlistId - Playlist ID to delete
 * @returns {Promise<Object>} Deletion result
 */
export const deletePlaylist = async (userId, playlistId) => {
  try {
    if (!userId || !playlistId) {
      throw new Error('User ID and playlist ID are required');
    }

    // Get playlist to verify ownership
    const playlistDoc = await db.collection(PLAYLISTS_COLLECTION).doc(playlistId).get();

    if (!playlistDoc.exists) {
      return {
        success: false,
        error: 'Playlist not found',
        message: 'Something went wrong. Please try again.',
      };
    }

    const playlist = playlistDoc.data();

    // Verify ownership
    if (playlist.createdBy.uid !== userId) {
      return {
        success: false,
        error: 'Permission denied',
        message: 'Something went wrong. Please try again.',
      };
    }

    // Delete playlist
    await db.collection(PLAYLISTS_COLLECTION).doc(playlistId).delete();

    return {
      success: true,
      message: 'Playlist deleted successfully',
    };
  } catch (error) {
    console.error('[SaveHandler] Error deleting playlist:', {
      error: error.message,
      stack: error.stack,
      userId,
      playlistId,
      timestamp: new Date().toISOString()
    });

    return {
      success: false,
      error: 'Failed to delete playlist',
      message: 'Something went wrong. Please try again.',
    };
  }
};

// Emotion → gradient color palette
const EMOTION_COLORS = {
  joy: '#f59e0b,#f97316',
  sadness: '#6366f1,#818cf8',
  love: '#ec4899,#f43f5e',
  anger: '#ef4444,#dc2626',
  calm: '#10b981,#065f46',
  heartbreak: '#8b5cf6,#ec4899',
  nostalgic: '#b45309,#d97706',
  romantic: '#ec4899,#be185d',
  motivated: '#22c55e,#15803d',
  energetic: '#f97316,#ea580c',
  party: '#a855f7,#ec4899',
  chill: '#06b6d4,#0284c7',
  default: '#6366f1,#8b5cf6'
};

const EMOTION_ADJECTIVES = {
  joy: ['Joyful', 'Happy', 'Upbeat', 'Cheerful'],
  sadness: ['Melancholic', 'Emotional', 'Deep', 'Heartfelt'],
  love: ['Romantic', 'Loving', 'Tender', 'Heartwarming'],
  anger: ['Intense', 'Powerful', 'Fierce', 'Bold'],
  calm: ['Peaceful', 'Serene', 'Soothing', 'Tranquil'],
  heartbreak: ['Bittersweet', 'Moving', 'Raw', 'Healing'],
  nostalgic: ['Nostalgic', 'Vintage', 'Throwback', 'Classic'],
  romantic: ['Dreamy', 'Intimate', 'Candlelit', 'Romantic'],
  motivated: ['Motivated', 'Driven', 'Unstoppable', 'Rising'],
  energetic: ['Electric', 'Energetic', 'Wild', 'Rush'],
  party: ['Party', 'Lit', 'Vibrant', 'Festival'],
  chill: ['Chill', 'Easy', 'Mellow', 'Relaxed'],
  default: ['Mood', 'Vibes', 'Mix', 'Session']
};

function generateTitle(emotion) {
  const adj = EMOTION_ADJECTIVES[emotion] || EMOTION_ADJECTIVES.default;
  const pick = adj[Math.floor(Math.random() * adj.length)];
  const now = new Date();
  const month = now.toLocaleString('en-IN', { month: 'short' });
  const year = now.getFullYear();
  return `My ${pick} Mix · ${month} ${year}`;
}

/**
 * Finalize a mood-generated playlist into the permanent library
 * @param {string} userId
 * @param {string} playlistId
 */
export const finalizeToLibrary = async (userId, playlistId) => {
  try {
    const docRef = db.collection(PLAYLISTS_COLLECTION).doc(playlistId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return { success: false, error: 'Playlist not found', status: 404, message: 'Playlist not found.' };
    }

    const data = doc.data();

    if (data.createdBy?.uid !== userId) {
      return { success: false, error: 'Permission denied', status: 403, message: 'You do not own this playlist.' };
    }

    if (data.isFinalized) {
      return { success: false, error: 'Already finalized', status: 400, message: 'This playlist is already in your library.' };
    }

    const title = generateTitle(data.emotion);
    const gradient = EMOTION_COLORS[data.emotion] || EMOTION_COLORS.default;

    await docRef.update({
      isFinalized: true,
      finalizedAt: admin.firestore.FieldValue.serverTimestamp(),
      name: title,
      coverGradient: gradient,
      isPublic: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      success: true,
      message: `"${title}" added to your Library!`,
      playlist: { _id: playlistId, ...data, isFinalized: true, name: title, coverGradient: gradient }
    };
  } catch (error) {
    console.error('[SaveHandler] Error finalizing playlist:', error.message);
    return { success: false, error: 'Failed to finalize', message: 'Something went wrong. Please try again.' };
  }
};
