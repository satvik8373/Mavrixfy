import { useAuthStore } from "@/stores/useAuthStore";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
  getCountFromServer
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Song } from "@/types";

// IMPORTANT: This service ONLY works with user-specific liked songs
// Path: users/{userId}/likedSongs/{songId}
// NEVER save to the main 'songs' collection - that's for other app features

export interface LikedSong {
  id: string;
  title: string;
  artist: string;
  albumName?: string;
  imageUrl: string;
  audioUrl: string;
  duration?: number;
  likedAt: any; // Firebase Timestamp
  createdAt?: any;
  updatedAt?: any;
  source: 'mavrixfy' | 'spotify' | 'saavn';
  year?: string;
  spotifyId?: string; // Original Mavrixfy track ID if synced from Mavrixfy
  normalizedTitle?: string;
  normalizedArtist?: string;
  dedupeKey?: string;
  client?: string;
}

export interface BulkLikedSongIssue {
  title: string;
  artist: string;
  album?: string;
  addedAt?: string;
  reason: 'already_added' | 'duplicate_in_import' | 'invalid_song' | 'storage_failed';
}

export interface AddMultipleLikedSongsResult {
  added: number;
  skipped: number;
  errors: number;
  alreadyAdded: number;
  duplicateInImport: number;
  skippedSongs: BulkLikedSongIssue[];
  errorSongs: BulkLikedSongIssue[];
}

// Batch operations manager for Firebase
class FirebaseBatchManager {
  private batchOperations: Array<() => Promise<void>> = [];
  private isProcessing = false;
  private batchSize = 10; // Process 10 operations at once
  private processingDelay = 100; // ms between batches

  addOperation(operation: () => Promise<void>) {
    this.batchOperations.push(operation);
    this.processBatch();
  }

  private async processBatch() {
    if (this.isProcessing || this.batchOperations.length === 0) return;
    
    this.isProcessing = true;
    
    try {
      const batch = this.batchOperations.splice(0, this.batchSize);
      await Promise.all(batch.map(op => op().catch(() => {})));
      
      // Continue processing if more operations exist
      if (this.batchOperations.length > 0) {
        setTimeout(() => {
          this.isProcessing = false;
          this.processBatch();
        }, this.processingDelay);
      } else {
        this.isProcessing = false;
      }
    } catch (error) {
      // Batch processing error
      this.isProcessing = false;
    }
  }
}

const firebaseBatchManager = new FirebaseBatchManager();

// Cache for duplicate checks to avoid repeated Firebase queries
const duplicateCheckCache = new Map<string, { result: boolean; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const INVALID_TEXT_VALUES = new Set(['', 'null', 'undefined', '[object object]']);
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

const normalizeText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const normalized = String(value).trim();
  return INVALID_TEXT_VALUES.has(normalized.toLowerCase()) ? '' : normalized;
};

const normalizeForDedupe = (value: unknown): string => normalizeText(value).toLowerCase().replace(/\s+/g, ' ');

const getDedupeKey = (title: unknown, artist: unknown): string => {
  return `${normalizeForDedupe(title)}|${normalizeForDedupe(artist)}`;
};

const getAlbumNameFromSong = (song: Song): string => {
  const album = normalizeText(song.album);
  if (album) return album;

  const albumId = normalizeText(song.albumId);
  if (!albumId || OBJECT_ID_PATTERN.test(albumId)) {
    return '';
  }

  return albumId;
};

const toIsoDateString = (value: unknown): string | null => {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  if (typeof value === 'object') {
    const timestampLike = value as {
      toDate?: () => Date;
      seconds?: number;
      _seconds?: number;
    };

    if (typeof timestampLike.toDate === 'function') {
      return toIsoDateString(timestampLike.toDate());
    }

    const seconds = typeof timestampLike.seconds === 'number'
      ? timestampLike.seconds
      : timestampLike._seconds;
    if (typeof seconds === 'number') {
      return toIsoDateString(seconds * 1000);
    }
  }

  return null;
};

/**
 * Optimized check if a song already exists in liked songs (by title and artist)
 * Uses Firestore query with caching instead of fetching all documents
 */
export const isSongAlreadyLiked = async (title: string, artist: string): Promise<boolean> => {
  const { isAuthenticated, userId } = useAuthStore.getState();
  
  if (!isAuthenticated || !userId) {
    return false;
  }
  
  // Create cache key
  const normalizedTitle = normalizeForDedupe(title);
  const normalizedArtist = normalizeForDedupe(artist);
  if (!normalizedTitle || !normalizedArtist) {
    return false;
  }

  const cacheKey = `${userId}:${normalizedTitle}:${normalizedArtist}`;
  
  // Check cache first
  const cached = duplicateCheckCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }
  
  try {
    const likedSongsRef = collection(db, 'users', userId, 'likedSongs:v1');
    
    const duplicateQuery = query(
      likedSongsRef,
      where('normalizedTitle', '==', normalizedTitle),
      where('normalizedArtist', '==', normalizedArtist),
      limit(1)
    );

    let exists = false;
    try {
      const snapshot = await getDocs(duplicateQuery);
      exists = !snapshot.empty;
    } catch {
      const snapshot = await getDocs(likedSongsRef);
      exists = snapshot.docs.some(doc => {
        const data = doc.data();
        const existingTitle = data.normalizedTitle || normalizeForDedupe(data.title);
        const existingArtist = data.normalizedArtist || normalizeForDedupe(data.artist);
        return existingTitle === normalizedTitle && existingArtist === normalizedArtist;
      });
    }
    
    // Cache the result
    duplicateCheckCache.set(cacheKey, { result: exists, timestamp: Date.now() });
    
    return exists;
  } catch (error) {
    return false;
  }
};

/**
 * Add a song to liked songs (with duplicate detection)
 */
export const addLikedSong = async (
  song: Song, 
  source: 'mavrixfy' | 'spotify' | 'saavn' = 'mavrixfy', 
  spotifyId?: string,
  customLikedAt?: string | Date
): Promise<{ added: boolean; reason?: string }> => {
  const { isAuthenticated, userId } = useAuthStore.getState();
  
  if (!isAuthenticated || !userId) {
    return { added: false, reason: 'Not authenticated' };
  }

  try {
    // Check for duplicates first with caching
    const alreadyExists = await isSongAlreadyLiked(song.title, song.artist);
    if (alreadyExists) {
      return { added: false, reason: 'Already exists' };
    }

    // Use batch manager for better performance
    return new Promise((resolve) => {
      firebaseBatchManager.addOperation(async () => {
        try {
          // CRITICAL: Use song._id as the Firestore document ID consistently
          // This ensures that when we delete, we use the same ID
          const normalizedTitle = normalizeForDedupe(song.title);
          const normalizedArtist = normalizeForDedupe(song.artist);
          if (!normalizedTitle || !normalizedArtist) {
            resolve({ added: false, reason: 'Invalid song' });
            return;
          }

          const documentId = String(song._id || getDedupeKey(song.title, song.artist)).replace(/\//g, '_');
          const likedSongRef = doc(db, 'users', userId, 'likedSongs:v1', documentId);
          
          // Determine the likedAt timestamp
          let likedAtTimestamp;
          if (customLikedAt) {
            // Use custom date (for Mavrixfy imports)
            likedAtTimestamp = customLikedAt instanceof Date ? customLikedAt : new Date(customLikedAt);
          } else {
            // Use server timestamp for current time
            likedAtTimestamp = serverTimestamp();
          }

          const likedSongData: LikedSong = {
            id: song._id || documentId, // Store the original song ID in the data
            title: song.title,
            normalizedTitle,
            artist: song.artist,
            normalizedArtist,
            albumName: getAlbumNameFromSong(song),
            imageUrl: song.imageUrl || '',
            audioUrl: song.audioUrl || song.streamUrl || '',
            duration: song.duration,
            year: '',
            likedAt: likedAtTimestamp,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            source: source,
            dedupeKey: `${normalizedTitle}|${normalizedArtist}`,
            client: 'mavrixfy_web',
            ...(spotifyId && { spotifyId })
          };
          
          await setDoc(likedSongRef, likedSongData);
          
          // Update cache
          const cacheKey = `${userId}:${normalizedTitle}:${normalizedArtist}`;
          duplicateCheckCache.set(cacheKey, { result: true, timestamp: Date.now() });
          
          // Dispatch event to notify other components
          document.dispatchEvent(new CustomEvent('likedSongsUpdated'));
          
          resolve({ added: true });
        } catch (error) {
          resolve({ added: false, reason: 'Database error' });
        }
      });
    });
    
  } catch (error) {
    throw error;
  }
};

/**
 * Optimized batch add multiple songs to liked songs
 */
export const addMultipleLikedSongs = async (
  songs: Song[],
  source: 'mavrixfy' | 'spotify' | 'saavn' = 'mavrixfy'
): Promise<AddMultipleLikedSongsResult> => {
  const { isAuthenticated, userId } = useAuthStore.getState();
  
  if (!isAuthenticated || !userId) {
    return {
      added: 0,
      skipped: 0,
      errors: 0,
      alreadyAdded: 0,
      duplicateInImport: 0,
      skippedSongs: [],
      errorSongs: [],
    };
  }

  let added = 0;
  let skipped = 0;
  let errors = 0;
  let alreadyAdded = 0;
  let duplicateInImport = 0;
  const skippedSongs: BulkLikedSongIssue[] = [];
  const errorSongs: BulkLikedSongIssue[] = [];

  try {
    const likedSongsRef = collection(db, 'users', userId, 'likedSongs:v1');
    const existingSnapshot = await getDocs(likedSongsRef);
    const existingKeys = new Set<string>();
    const existingIds = new Set<string>();

    existingSnapshot.forEach((docSnap) => {
      existingIds.add(docSnap.id);
      const data = docSnap.data();
      const existingKey = data.dedupeKey || getDedupeKey(data.normalizedTitle || data.title, data.normalizedArtist || data.artist);
      if (existingKey !== '|') {
        existingKeys.add(existingKey);
      }
    });

    const normalizedInput = new Map<string, Song>();
    const seenInputIds = new Set<string>();
    for (const song of songs) {
      const title = String(song?.title || '').trim();
      const artist = String(song?.artist || '').trim();
      const id = String(song?._id || '').trim();
      if (!title || !artist || !id) {
        errors += 1;
        errorSongs.push({
          title,
          artist,
          album: String(song?.album || '').trim(),
          addedAt: toIsoDateString((song as Song)?.likedAt) ?? toIsoDateString((song as Song)?.createdAt) ?? undefined,
          reason: 'invalid_song',
        });
        continue;
      }

      const dedupeKey = getDedupeKey(title, artist);
      if (normalizedInput.has(dedupeKey) || seenInputIds.has(id)) {
        skipped += 1;
        duplicateInImport += 1;
        skippedSongs.push({
          title,
          artist,
          album: String(song?.album || '').trim(),
          addedAt: toIsoDateString(song?.likedAt) ?? toIsoDateString(song?.createdAt) ?? undefined,
          reason: 'duplicate_in_import',
        });
        continue;
      }

      normalizedInput.set(dedupeKey, song);
      seenInputIds.add(id);
    }

    const uniqueSongs = Array.from(normalizedInput.values());
    const batchSize = 200;
    const commitPlans: Array<{ promise: Promise<void>; committedSongs: Song[] }> = [];

    for (let i = 0; i < uniqueSongs.length; i += batchSize) {
      const batch = writeBatch(db);
      const songBatch = uniqueSongs.slice(i, i + batchSize);
      let writesInBatch = 0;
      const committedSongs: Song[] = [];

      for (const song of songBatch) {
        const normalizedTitle = normalizeForDedupe(song.title);
        const normalizedArtist = normalizeForDedupe(song.artist);
        const dedupeKey = `${normalizedTitle}|${normalizedArtist}`;

        if (existingKeys.has(dedupeKey) || existingIds.has(song._id)) {
          skipped += 1;
          alreadyAdded += 1;
          skippedSongs.push({
            title: song.title,
            artist: song.artist,
            album: String(song.album || '').trim(),
            addedAt: toIsoDateString(song.likedAt) ?? toIsoDateString(song.createdAt) ?? undefined,
            reason: 'already_added',
          });
          continue;
        }

        try {
          const likedSongRef = doc(db, 'users', userId, 'likedSongs:v1', song._id);
          const likedAtIso = toIsoDateString(song.likedAt) ?? toIsoDateString(song.createdAt);
          const likedAtValue = likedAtIso ? new Date(likedAtIso) : serverTimestamp();
          const likedSongData: LikedSong = {
            id: song._id,
            title: song.title,
            normalizedTitle,
            artist: song.artist,
            normalizedArtist,
            albumName: getAlbumNameFromSong(song),
            imageUrl: song.imageUrl || '',
            audioUrl: song.audioUrl || song.streamUrl || '',
            duration: song.duration,
            year: '',
            likedAt: likedAtValue,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            source,
            dedupeKey,
            client: 'mavrixfy_web'
          };

          batch.set(likedSongRef, likedSongData, { merge: true });
          existingKeys.add(dedupeKey);
          existingIds.add(song._id);
          committedSongs.push(song);
          writesInBatch += 1;
          added += 1;
        } catch (error) {
          errors += 1;
          errorSongs.push({
            title: song.title,
            artist: song.artist,
            album: String(song.album || '').trim(),
            addedAt: toIsoDateString(song.likedAt) ?? toIsoDateString(song.createdAt) ?? undefined,
            reason: 'storage_failed',
          });
        }
      }

      if (writesInBatch > 0) {
        commitPlans.push({ promise: batch.commit(), committedSongs });
      }
    }

    const commitResults = await Promise.allSettled(commitPlans.map((plan) => plan.promise));
    commitResults.forEach((result, index) => {
      const { committedSongs } = commitPlans[index];
      if (result.status === 'fulfilled') {
        committedSongs.forEach((song) => {
          const cacheKey = `${userId}:${normalizeForDedupe(song.title)}:${normalizeForDedupe(song.artist)}`;
          duplicateCheckCache.set(cacheKey, { result: true, timestamp: Date.now() });
        });
        return;
      }

      added -= committedSongs.length;
      errors += committedSongs.length;

      committedSongs.forEach((song) => {
        const normalizedTitle = normalizeForDedupe(song.title);
        const normalizedArtist = normalizeForDedupe(song.artist);
        existingKeys.delete(`${normalizedTitle}|${normalizedArtist}`);
        existingIds.delete(song._id);
        errorSongs.push({
          title: song.title,
          artist: song.artist,
          album: String(song.album || '').trim(),
          addedAt: toIsoDateString(song.likedAt) ?? toIsoDateString(song.createdAt) ?? undefined,
          reason: 'storage_failed',
        });
      });
    });

    document.dispatchEvent(new CustomEvent('likedSongsUpdated'));
    return {
      added,
      skipped,
      errors,
      alreadyAdded,
      duplicateInImport,
      skippedSongs,
      errorSongs,
    };
  } catch (error) {
    return {
      added,
      skipped,
      errors: errors + 1,
      alreadyAdded,
      duplicateInImport,
      skippedSongs,
      errorSongs,
    };
  }
};

/**
 * Remove a song from liked songs
 */
export const removeLikedSong = async (songId: string): Promise<void> => {
  const { isAuthenticated, userId } = useAuthStore.getState();
  
  if (!isAuthenticated || !userId) {
    return;
  }
  
  try {
    // First, check if the document exists with the given ID
    const likedSongRef = doc(db, 'users', userId, 'likedSongs:v1', songId);
    
    // Check if document exists before attempting deletion
    const docSnap = await getDoc(likedSongRef);
    if (!docSnap.exists()) {
      // Try to find the document by searching all liked songs
      const likedSongsRef = collection(db, 'users', userId, 'likedSongs:v1');
      const snapshot = await getDocs(likedSongsRef);
      
      let foundDocId = null;
      snapshot.forEach(doc => {
        const data = doc.data();
        
        // Check if this document matches our song by ID or by title/artist
        if (doc.id === songId || data.id === songId) {
          foundDocId = doc.id;
        }
      });
      
      if (foundDocId && foundDocId !== songId) {
        const correctRef = doc(db, 'users', userId, 'likedSongs:v1', foundDocId);
        await deleteDoc(correctRef);
      } else {
        throw new Error(`Song not found in Firestore with ID: ${songId}`);
      }
    } else {
      // Document exists, delete it normally
      await deleteDoc(likedSongRef);
    }
    
    // Dispatch event to notify other components
    document.dispatchEvent(new CustomEvent('likedSongsUpdated'));
    
  } catch (error) {
    throw error;
  }
};

/**
 * Load liked songs from Firestore
 */
export const loadLikedSongs = async (): Promise<Song[]> => {
  const { isAuthenticated, userId } = useAuthStore.getState();
  
  if (!isAuthenticated || !userId) {
    return [];
  }

  try {
    const likedSongsRef = collection(db, 'users', userId, 'likedSongs:v1');
    
    let snapshot;
    try {
      // Try to order by likedAt first
      const q = query(likedSongsRef, orderBy('likedAt', 'desc'));
      snapshot = await getDocs(q);
    } catch (orderError) {
      // If ordering fails, get all docs without ordering
      snapshot = await getDocs(likedSongsRef);
    }
    
    const songs: Song[] = [];
    
    snapshot.forEach(docSnap => {
      const data = docSnap.data() as LikedSong;
      
      // CRITICAL: Always use the Firestore document ID as the primary ID
      // This ensures that when we delete, we use the correct document ID
      const songId = docSnap.id; // Use Firestore document ID
      
      if (!songId) {
        return; // Skip songs without valid IDs
      }

      const albumName = normalizeText(data.albumName);
      const safeAlbumName = albumName && !OBJECT_ID_PATTERN.test(albumName) ? albumName : '';
      const likedAtIso = toIsoDateString(data.likedAt);
      const nowIso = new Date().toISOString();
      const createdAtIso = likedAtIso ?? nowIso;
      
      songs.push({
        _id: songId, // Use Firestore document ID as _id
        title: data.title,
        artist: data.artist,
        album: safeAlbumName || null,
        imageUrl: data.imageUrl,
        audioUrl: data.audioUrl || (data as any).streamUrl || '',
        streamUrl: (data as any).streamUrl || data.audioUrl || '',
        duration: data.duration || 0,
        albumId: safeAlbumName || null,
        createdAt: createdAtIso,
        updatedAt: toIsoDateString((data as { updatedAt?: unknown }).updatedAt) ?? createdAtIso,
        // Preserve source information for UI indicators
        source: data.source || 'mavrixfy',
        spotifyId: data.spotifyId,
        likedAt: likedAtIso ?? createdAtIso,
        // Store the original data.id as a separate field for reference
        originalId: data.id
      } as Song & { source?: string; spotifyId?: string; likedAt?: any; originalId?: string });
    });
    
    return songs;
    
  } catch (error) {
    return [];
  }
};

/**
 * Check if a song is liked
 */
export const isSongLiked = async (songId: string): Promise<boolean> => {
  const { isAuthenticated, userId } = useAuthStore.getState();
  
  if (!isAuthenticated || !userId) {
    return false;
  }
  
  try {
    const likedSongRef = doc(db, 'users', userId, 'likedSongs:v1', songId);
    const songDoc = await getDoc(likedSongRef);
    
    return songDoc.exists();
    
  } catch (error) {
    return false;
  }
};

/**
 * Toggle liked state of a song
 */
export const toggleLikedSong = async (song: Song): Promise<boolean> => {
  try {
    const isLiked = await isSongLiked(song._id);
    
    if (isLiked) {
      await removeLikedSong(song._id);
      return false;
    } else {
      await addLikedSong(song);
      return true;
    }
  } catch (error) {
    return false;
  }
};

/**
 * Get liked songs count
 */
export const getLikedSongsCount = async (): Promise<number> => {
  const { isAuthenticated, userId } = useAuthStore.getState();
  
  if (!isAuthenticated || !userId) {
    return 0;
  }

  try {
    const likedSongsRef = collection(db, 'users', userId, 'likedSongs:v1');
    const snapshot = await getCountFromServer(likedSongsRef);
    return snapshot.data().count;
    
  } catch (error) {
    try {
      const likedSongsRef = collection(db, 'users', userId, 'likedSongs:v1');
      const snapshot = await getDocs(likedSongsRef);
      return snapshot.size;
    } catch {
      return 0;
    }
  }
};

