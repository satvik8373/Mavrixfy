import { Song, Album, Playlist, User } from './index';

// Firebase Document interface with id field
export interface FirebaseDocument {
  id: string;
  [key: string]: any;
}

// Firebase-compatible Song
export interface FirestoreSong extends Omit<Song, '_id'> {
  id: string;
  title: string;
  artist: string;
  albumId: string | null;
  imageUrl: string;
  audioUrl: string;
  streamUrl?: string;
  storagePath?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  uploadedAt?: string | null;
  duration: number;
  createdAt: string;
  updatedAt: string;
}

// Conversion helpers
export const songToFirestore = (song: Song): FirestoreSong => {
  if (!song) {
    return {
      id: 'unknown',
      title: 'Unknown Song',
      artist: 'Unknown Artist',
      imageUrl: '',
      audioUrl: '',
      albumId: null,
      duration: 0,
      createdAt: '',
      updatedAt: ''
    };
  }
  const { _id, ...rest } = song;
  return {
    id: _id || 'unknown',
    ...rest
  } as FirestoreSong;
};

export const firestoreToSong = (fsong: FirestoreSong): Song => {
  if (!fsong) {
    return {
      _id: 'unknown',
      title: 'Unknown Song',
      artist: 'Unknown Artist',
      imageUrl: '',
      audioUrl: '',
      streamUrl: '',
      albumId: null,
      duration: 0,
      createdAt: '',
      updatedAt: ''
    };
  }
  const { id, audioUrl, streamUrl, ...rest } = fsong;
  return {
    _id: id || 'unknown',
    audioUrl: audioUrl || streamUrl || '',
    streamUrl: streamUrl || audioUrl || '',
    ...rest
  };
};

// Firebase-compatible Album
export interface FirestoreAlbum extends Omit<Album, '_id' | 'songs'> {
  id: string;
  title: string;
  artist: string;
  imageUrl: string;
  releaseYear: number;
  songs: FirestoreSong[];
}

// Firebase-compatible Playlist
export interface FirestorePlaylist extends Omit<Playlist, '_id' | 'songs' | 'createdBy'> {
  id: string;
  name: string;
  description: string;
  createdBy: FirestoreUser;
  songs: FirestoreSong[];
  imageUrl: string;
  isPublic: boolean;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
}

// Firebase-compatible User
export interface FirestoreUser extends Omit<User, '_id'> {
  id: string;
  _id?: string;
  uid: string;
  fullName: string;
  imageUrl: string;
} 
