import { auth, db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  orderBy, 
  serverTimestamp, 
  Timestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { playlistsService } from './firestore';
import { resolveArtist } from '@/lib/resolveArtist';
import { Playlist, Song } from '@/types';
import { FirestorePlaylist, FirestoreSong, firestoreToSong, FirestoreUser } from '@/types/firebase';
import { createPlaylistCoverCollage, createDominantColorCover } from './playlistImageService';

// Generate a random placeholder image for playlists without images
const generatePlaceholderImage = (name: string): string => {
  const colors = [
    '#1DB954', '#1ED760', '#2D46B9', '#9B59B6',
    '#3498DB', '#1ABC9C', '#F1C40F', '#E74C3C'
  ];
  const color = colors[Math.floor(Math.random() * colors.length)];
  
  // Generate a data URL with the first letter
  const letter = name.charAt(0).toUpperCase();
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="300" height="300">
      <rect width="100%" height="100%" fill="${color}" />
      <text x="50%" y="50%" font-family="Arial" font-size="120" fill="white" text-anchor="middle" dominant-baseline="middle">${letter}</text>
    </svg>
  `;
  
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

// Helper to safely cast FirestorePlaylist to the expected type
const castFirestorePlaylist = (playlist: any): FirestorePlaylist => {
  return playlist as FirestorePlaylist;
};

const normalizeForSearch = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, ' ');

// Convert Firestore document to Playlist format
export const convertFirestorePlaylistToPlaylist = (data: any): Playlist => {
  // Type cast to handle the incompatible types
  const firestorePlaylist = castFirestorePlaylist(data);
  
  // Safely extract createdBy information with fallbacks
  const createdBy = (firestorePlaylist.createdBy || {}) as any;
  const createdById = createdBy.id || createdBy._id || createdBy.uid || 'unknown';
  const createdByUid = createdBy.uid || createdBy.id || createdBy._id || 'unknown';
  const createdByName = createdBy.fullName || createdBy.displayName || createdBy.name || 'Unknown User';
  const createdByImage = createdBy.imageUrl || createdBy.photoURL || '';
  
  return {
    _id: firestorePlaylist.id,
    name: firestorePlaylist.name,
    description: firestorePlaylist.description || '',
    isPublic: firestorePlaylist.isPublic,
    imageUrl: firestorePlaylist.imageUrl || generatePlaceholderImage(firestorePlaylist.name),
    songs: firestorePlaylist.songs ? firestorePlaylist.songs.map(song => firestoreToSong(song)) : [],
    featured: firestorePlaylist.featured || false,
    createdAt: firestorePlaylist.createdAt,
    updatedAt: firestorePlaylist.updatedAt,
    createdBy: {
      _id: createdById,
      uid: createdByUid,
      fullName: createdByName,
      imageUrl: createdByImage
    }
  };
};

// Generate a playlist cover image based on its songs
export const generatePlaylistCoverFromSongs = async (songs: Song[]): Promise<string> => {
  try {
    // If there are no songs, return a default placeholder
    if (!songs || songs.length === 0) {
      return '';
    }
    
    // Create a collage image from the songs' cover art
    return await createPlaylistCoverCollage(songs);
  } catch (error) {
    return '';
  }
};

// Get all user playlists
export const getUserPlaylists = async (options?: { limit?: number; page?: number }): Promise<Playlist[]> => {
  try {
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      throw new Error('Not authenticated');
    }
    
    const userId = currentUser.uid;
    
    const firestorePlaylists = await playlistsService.getUserPlaylists(userId, options?.limit);
    
    const convertedPlaylists = firestorePlaylists.map(playlist => convertFirestorePlaylistToPlaylist(playlist));
    
    return convertedPlaylists;
  } catch (error) {
    throw error;
  }
};

// Get featured playlists
export const getFeaturedPlaylists = async (options?: { limit?: number; page?: number }): Promise<Playlist[]> => {
  try {
    const firestorePlaylists = await playlistsService.getFeaturedPlaylists(options?.limit);
    return firestorePlaylists.map(playlist => convertFirestorePlaylistToPlaylist(playlist));
  } catch (error) {
    throw error;
  }
};

// Get all public playlists
export const getPublicPlaylists = async (options?: { limit?: number; page?: number }): Promise<Playlist[]> => {
  try {
    const firestorePlaylists = await playlistsService.getPublicPlaylists(options?.limit);
    return firestorePlaylists.map(playlist => convertFirestorePlaylistToPlaylist(playlist));
  } catch (error) {
    throw error;
  }
};

// Get playlist by ID
export const getPlaylistById = async (playlistId: string): Promise<Playlist> => {
  try {
    const firestorePlaylist = await playlistsService.getById(playlistId);
    
    if (!firestorePlaylist) {
      throw new Error('Playlist not found');
    }
    
    return convertFirestorePlaylistToPlaylist(firestorePlaylist);
  } catch (error) {
    throw error;
  }
};

// Create a new playlist
export const createPlaylist = async (
  name: string,
  description: string = '',
  isPublic: boolean = true,
  imageUrl: string | null = null
): Promise<Playlist> => {
  try {
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      throw new Error('Not authenticated');
    }
    
    // Use provided imageUrl or generate a placeholder
    let playlistImageUrl = imageUrl;
    if (!playlistImageUrl) {
      playlistImageUrl = generatePlaceholderImage(name);
    }
    
    // Create a user object that matches both Firebase and our application structure
    const userForFirestore = {
      id: currentUser.uid,
      _id: currentUser.uid, // Add _id to match User interface
      uid: currentUser.uid,
      name: currentUser.displayName || 'User',
      displayName: currentUser.displayName || 'User',
      fullName: currentUser.displayName || 'User',
      imageUrl: currentUser.photoURL || '',
      photoURL: currentUser.photoURL || '',
      email: currentUser.email || '',
      emailLower: (currentUser.email || '').toLowerCase()
    };
    
    const playlistData = {
      name,
      description,
      imageUrl: playlistImageUrl, // Using the provided or generated image URL
      isPublic,
      songs: [],
      songCount: 0,
      featured: false,
      createdBy: userForFirestore,
      source: 'mavrixfy_web',
      schemaVersion: 2,
      searchableName: normalizeForSearch(name),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    try {
      const firestorePlaylist = await playlistsService.create(playlistData);
      return convertFirestorePlaylistToPlaylist(firestorePlaylist);
    } catch (firestoreError) {
      // Create a local playlist object as fallback
      const fallbackPlaylist = {
        id: `local-playlist-${Date.now()}`,
        ...playlistData
      };
      
      return convertFirestorePlaylistToPlaylist(fallbackPlaylist);
    }
  } catch (error) {
    throw error;
  }
};

// Update an existing playlist
export const updatePlaylist = async (
  playlistId: string, 
  data: { 
    name?: string; 
    description?: string; 
    isPublic?: boolean; 
    imageUrl?: string;
  }
): Promise<Playlist> => {
  try {
    // Ensure imageUrl is not undefined if provided
    const updateData = { ...data };
    if (updateData.hasOwnProperty('imageUrl') && !updateData.imageUrl) {
      // Generate a placeholder image if needed
      if (updateData.name) {
        updateData.imageUrl = generatePlaceholderImage(updateData.name);
      } else {
        // Remove the imageUrl field if we can't generate a meaningful placeholder
        delete updateData.imageUrl;
      }
    }
    
    if (typeof updateData.name === 'string') {
      (updateData as typeof updateData & { searchableName: string }).searchableName = normalizeForSearch(updateData.name);
    }

    const firestorePlaylist = await playlistsService.update(playlistId, updateData);
    return convertFirestorePlaylistToPlaylist(firestorePlaylist);
  } catch (error) {
    throw error;
  }
};

// Update playlist cover image using its songs
export const updatePlaylistCoverFromSongs = async (playlistId: string, songs: Song[]): Promise<Playlist> => {
  try {
    // Generate a collage image from the songs
    const newCoverUrl = await generatePlaylistCoverFromSongs(songs);
    
    // Only update if we got a valid cover
    if (newCoverUrl) {
      return await updatePlaylist(playlistId, { imageUrl: newCoverUrl });
    }
    
    // If no cover was generated, return the existing playlist
    return await getPlaylistById(playlistId);
  } catch (error) {
    throw error;
  }
};

// Delete a playlist
export const deletePlaylist = async (playlistId: string): Promise<void> => {
  try {
    await playlistsService.delete(playlistId);
  } catch (error) {
    throw error;
  }
};

// Add a song to a playlist
export const addSongToPlaylist = async (playlistId: string, song: Song): Promise<Playlist> => {
  try {
    // Ensure song has all required fields with fallbacks for safety
    let firestoreSong: FirestoreSong = {
      id: song._id || `song-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      title: song.title || 'Unknown Title',
      artist: resolveArtist(song),
      imageUrl: song.imageUrl || '',
      audioUrl: song.audioUrl || song.streamUrl || '',
      streamUrl: song.streamUrl || song.audioUrl || '',
      duration: typeof song.duration === 'number' ? song.duration : 0,
      albumId: song.albumId || null,
      createdAt: song.createdAt || new Date().toISOString(),
      updatedAt: song.updatedAt || new Date().toISOString()
    };
    
    // Remove any undefined values to prevent Firebase errors
    Object.keys(firestoreSong).forEach(key => {
      // Use type-safe approach for handling null values
      const typedKey = key as keyof typeof firestoreSong;
      if (firestoreSong[typedKey] === undefined) {
        // Create a new object with the nullified property
        firestoreSong = {
          ...firestoreSong,
          [typedKey]: null
        };
      }
    });
    
    // Add the song to the playlist
    const updatedPlaylist = await playlistsService.addSongToPlaylist(playlistId, firestoreSong);
    const convertedPlaylist = convertFirestorePlaylistToPlaylist(updatedPlaylist);
    
    // Get the updated songs list from the playlist
    const songs = convertedPlaylist.songs;
    
    // If there are at least 4 songs and no custom cover (or using a placeholder), 
    // generate a new cover image automatically
    if (songs.length >= 1) {
      // Check if the current image is a placeholder (data URL) or default
      const currentImageUrl = convertedPlaylist.imageUrl || '';
      const isPlaceholder = currentImageUrl.startsWith('data:') || 
                           currentImageUrl.includes('default-playlist') ||
                           !currentImageUrl;
      
      if (isPlaceholder) {
        try {
          // Generate a new cover collage and update the playlist
          const newCoverUrl = await generatePlaylistCoverFromSongs(songs);
          if (newCoverUrl) {
            await playlistsService.update(playlistId, { imageUrl: newCoverUrl });
            convertedPlaylist.imageUrl = newCoverUrl;
          }
        } catch (coverError) {
          // Continue without updating the cover
        }
      }
    }
    
    return convertedPlaylist;
  } catch (error) {
    throw error;
  }
};

// Remove a song from a playlist
export const removeSongFromPlaylist = async (playlistId: string, songId: string): Promise<Playlist> => {
  try {
    const updatedPlaylist = await playlistsService.removeSongFromPlaylist(playlistId, songId);
    return convertFirestorePlaylistToPlaylist(updatedPlaylist);
  } catch (error) {
    throw error;
  }
}; 
