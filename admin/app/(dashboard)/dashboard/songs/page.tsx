'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import { collection, getDocs, query, orderBy, deleteDoc, doc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase-client';
import { Music2, Plus, Search, Edit, Trash2, Play, Pause, Loader2, X, Check, RefreshCw, Database, Globe, Upload } from 'lucide-react';

const ADMIN_SEARCH_API = '/api/music/search';
const ADMIN_UPLOAD_API = '/api/music/upload';
const MAX_MP3_SIZE_BYTES = 25 * 1024 * 1024;
const GENRES = [
  'Pop', 'Rock', 'Hip-Hop', 'Indian Hip-Hop', 'Punjabi', 'Punjabi Hip-Hop', 'Bhangra',
  'R&B', 'R&B/Soul', 'Electronic', 'Jazz', 'Classical', 'Country', 'Bollywood', 'Indie', 'Other'
];

interface Song {
  id: string;
  title: string;
  artist: string;
  album?: string;
  genre?: string;
  duration?: number;
  imageUrl?: string;
  audioUrl?: string;
  streamUrl?: string;
  storagePath?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  uploadedAt?: string | null;
  year?: number;
  releaseDate?: string | null;
  source?: string;
  sourceLabel?: string;
  playbackType?: 'audio';
  externalUrl?: string;
  inFirestore?: boolean;
}

interface ApiSong {
  id: string;
  name?: string;
  title?: string;
  // new schema: artists.primary[].name
  artists?: { primary?: Array<{ name: string }> };
  primaryArtists?: string;
  artist?: string;
  album?: { id?: string | null; name?: string | null; url?: string | null } | string;
  image?: Array<{ quality: string; url?: string; link?: string }> | string;
  imageUrl?: string;
  downloadUrl?: Array<{ quality: string; url?: string; link?: string }>;
  streamUrl?: string;
  url?: string;
  duration?: number | string | null;
  year?: number | string | null;
  releaseDate?: string | null;
  language?: string;
  genre?: string;
  source?: string;
  sourceLabel?: string;
  playbackType?: 'audio';
  externalUrl?: string;
}

interface SongForm {
  title: string; artist: string; album: string; genre: string;
  duration: string; imageUrl: string; year: string;
}

interface UploadedAudioAsset {
  audioUrl: string;
  streamUrl: string;
  storagePath?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  bucket?: string;
  uploadedAt?: string;
}

const EMPTY_FORM: SongForm = { title: '', artist: '', album: '', genre: '', duration: '', imageUrl: '', year: '' };

function formatDuration(s?: number) {
  if (!s) return '—';
  const sec = Number(s);
  return `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`;
}

function getMediaUrl(item?: { url?: string; link?: string }) {
  return item?.url || item?.link || '';
}

function formatFileSize(bytes?: number) {
  if (!bytes || bytes <= 0) return 'Unknown size';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function inferFileName(url?: string) {
  if (!url) return 'audio.mp3';
  try {
    const parsed = new URL(url);
    const rawPath = decodeURIComponent(parsed.pathname);
    const segments = rawPath.split('/');
    return segments[segments.length - 1] || 'audio.mp3';
  } catch {
    return 'audio.mp3';
  }
}

async function readAudioDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    audio.src = objectUrl;

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      audio.removeAttribute('src');
    };

    audio.onloadedmetadata = () => {
      const duration = Math.round(audio.duration);
      cleanup();
      resolve(Number.isFinite(duration) && duration > 0 ? duration : null);
    };

    audio.onerror = () => {
      cleanup();
      resolve(null);
    };
  });
}

function getResultKey(song: Song) {
  return [song.title, song.artist]
    .map(value => value
      .toLowerCase()
      .replace(/&/g, ' ')
      .replace(/\band\b/g, ' ')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim())
    .join('|');
}

function sourceScore(song: Song) {
  if (song.source?.startsWith('jiosaavn') && (song.streamUrl || song.audioUrl)) return 4;
  if (song.source?.startsWith('jiosaavn')) return 3;
  if (song.streamUrl || song.audioUrl) return 2;
  return 1;
}

function mergeUniqueSongs(current: Song[], incoming: Song[]) {
  const byKey = new Map(current.map(song => [getResultKey(song), song]));
  incoming.forEach(song => {
    const key = getResultKey(song);
    const existing = byKey.get(key);
    if (!existing || sourceScore(song) > sourceScore(existing)) {
      byKey.set(key, song);
    }
  });
  return Array.from(byKey.values()).sort((a, b) => (b.year || 0) - (a.year || 0));
}

function normalizeFirestoreSong(id: string, d: any): Song {
  const resolvedAudioUrl = d.audioUrl || d.streamUrl || d.url || '';
  return {
    id,
    title: d.title || d.name || '',
    artist: d.artist || d.primaryArtists || '',
    album: typeof d.album === 'object' ? d.album?.name : (d.album || ''),
    genre: d.genre || '',
    duration: d.duration ? Number(d.duration) : undefined,
    imageUrl: d.imageUrl || (Array.isArray(d.image) ? d.image[2]?.url : d.image) || '',
    audioUrl: resolvedAudioUrl,
    streamUrl: resolvedAudioUrl,
    storagePath: d.storagePath || undefined,
    fileName: d.fileName || undefined,
    fileSize: d.fileSize ? Number(d.fileSize) : undefined,
    mimeType: d.mimeType || undefined,
    uploadedAt: d.uploadedAt || null,
    year: d.year ? Number(d.year) : undefined,
    releaseDate: d.releaseDate || null,
    source: d.source || 'firestore',
    sourceLabel: d.sourceLabel || d.source || 'firestore',
    playbackType: d.playbackType || (resolvedAudioUrl ? 'audio' : undefined),
    externalUrl: d.externalUrl || undefined,
    inFirestore: true,
  };
}

function normalizeApiSong(s: ApiSong): Song {
  // Pick highest quality download URL (320kbps preferred)
  const bestDownload = Array.isArray(s.downloadUrl)
    ? getMediaUrl(s.downloadUrl.find(u => u.quality === '320kbps') ||
       s.downloadUrl.find(u => u.quality === '160kbps') ||
       s.downloadUrl[s.downloadUrl.length - 1])
    : '';
  const bestAudio = bestDownload || s.streamUrl || s.url || '';

  // Pick highest quality image (last item = highest res in saavn API)
  const img = Array.isArray(s.image)
    ? (getMediaUrl(s.image[s.image.length - 1]) || getMediaUrl(s.image[0]))
    : (typeof s.image === 'string' ? s.image : s.imageUrl || '');

  // Artist: new schema uses artists.primary[].name, fallback to old fields
  const artist = s.artists?.primary?.map(a => a.name).join(', ')
    || s.primaryArtists
    || s.artist
    || '';

  // Album: new schema uses album.name object
  const album = typeof s.album === 'object' && s.album !== null
    ? (s.album.name || '')
    : (typeof s.album === 'string' ? s.album : '');

  return {
    id: `api_${s.id}`,
    title: s.name || s.title || '',
    artist,
    album,
    genre: s.genre || s.language || '',
    duration: s.duration ? Number(s.duration) : undefined,
    imageUrl: img,
    audioUrl: bestAudio || '',
    streamUrl: bestAudio || '',
    year: s.year ? Number(s.year) : undefined,
    releaseDate: s.releaseDate || null,
    source: s.source || 'jiosaavn',
    sourceLabel: s.sourceLabel || s.source || 'jiosaavn',
    playbackType: s.playbackType || (bestAudio ? 'audio' : undefined),
    externalUrl: s.externalUrl || s.url || '',
    inFirestore: false,
  };
}

export default function SongsPage() {
  // Firestore songs
  const [firestoreSongs, setFirestoreSongs] = useState<Song[]>([]);
  const [fsLoading, setFsLoading] = useState(true);

  // API search
  const [searchQuery, setSearchQuery] = useState('');
  const [apiResults, setApiResults] = useState<Song[]>([]);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [searched, setSearched] = useState(false);
  const [apiTotal, setApiTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  // View mode: 'catalog' = firestore, 'search' = api results
  const [viewMode, setViewMode] = useState<'catalog' | 'search'>('catalog');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<SongForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [formError, setFormError] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [selectedAudioFile, setSelectedAudioFile] = useState<File | null>(null);
  const [currentAudioAsset, setCurrentAudioAsset] = useState<UploadedAudioAsset | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  // Saving API song to Firestore
  const [savingApiId, setSavingApiId] = useState<string | null>(null);
  const [activeSongId, setActiveSongId] = useState<string | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const apiPageRef = useRef(0);

  useEffect(() => { fetchFirestoreSongs(); }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setIsAudioPlaying(true);
    const onPause = () => setIsAudioPlaying(false);
    const onEnded = () => {
      setIsAudioPlaying(false);
      setActiveSongId(null);
    };
    const onError = () => {
      setIsAudioPlaying(false);
      setActiveSongId(null);
      alert('This song could not be played in the admin panel.');
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.pause();
    };
  }, []);

  async function fetchFirestoreSongs() {
    setFsLoading(true);
    try {
      let snap;
      try { snap = await getDocs(query(collection(db, 'songs'), orderBy('createdAt', 'desc'))); }
      catch { snap = await getDocs(collection(db, 'songs')); }
      setFirestoreSongs(snap.docs.map(d => normalizeFirestoreSong(d.id, d.data())));
    } catch (e) { console.error(e); }
    finally { setFsLoading(false); }
  }

  function resetAudioSelection() {
    setSelectedAudioFile(null);
    setCurrentAudioAsset(null);
    setFileInputKey(prev => prev + 1);
  }

  function openCreateModal(initialTitle = '') {
    setEditId(null);
    setForm({ ...EMPTY_FORM, title: initialTitle });
    setFormError('');
    resetAudioSelection();
    setShowModal(true);
  }

  async function uploadAudioFile(file: File): Promise<UploadedAudioAsset> {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('Your admin session has expired. Please sign in again.');
    }

    setUploadingAudio(true);

    try {
      const idToken = await user.getIdToken();
      const body = new FormData();
      body.append('file', file);

      const response = await fetch(ADMIN_UPLOAD_API, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${idToken}`,
        },
        body,
      });

      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.success || !json?.data) {
        throw new Error(json?.message || 'Failed to upload MP3 file.');
      }

      return json.data as UploadedAudioAsset;
    } finally {
      setUploadingAudio(false);
    }
  }

  async function handleAudioFileSelect(file: File | null) {
    if (!file) {
      setSelectedAudioFile(null);
      setFileInputKey(prev => prev + 1);
      return;
    }

    const isMp3 = file.name.toLowerCase().endsWith('.mp3') || file.type.toLowerCase().includes('mpeg');
    if (!isMp3) {
      setFormError('Please choose an MP3 file.');
      setSelectedAudioFile(null);
      setFileInputKey(prev => prev + 1);
      return;
    }

    if (file.size > MAX_MP3_SIZE_BYTES) {
      setFormError('MP3 file must be 25 MB or smaller.');
      setSelectedAudioFile(null);
      setFileInputKey(prev => prev + 1);
      return;
    }

    setSelectedAudioFile(file);
    setFormError('');

    if (!form.title.trim()) {
      setForm(prev => ({
        ...prev,
        title: file.name.replace(/\.mp3$/i, '').replace(/[_-]+/g, ' ').trim(),
      }));
    }

    if (!form.duration.trim()) {
      const duration = await readAudioDuration(file);
      if (duration) {
        setForm(prev => prev.duration.trim() ? prev : { ...prev, duration: String(duration) });
      }
    }
  }

  // Debounced API search — searches page 0 first, then loads more
  const searchApi = useCallback(async (q: string, page = 0, append = false) => {
    if (!q.trim()) {
      setApiResults([]);
      setSearched(false);
      setApiTotal(0);
      return;
    }
    if (append) setLoadingMore(true);
    else setApiLoading(true);
    setApiError('');
    setSearched(true);
    try {
      const res = await fetch(
        `${ADMIN_SEARCH_API}?query=${encodeURIComponent(q.trim())}&page=${page}&limit=20`
      );
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const json = await res.json();
      const results: ApiSong[] = json?.data?.results || [];
      const total: number = json?.data?.total || 0;
      setApiTotal(total);
      apiPageRef.current = page;
      const normalized = results.map(normalizeApiSong);
      if (append) {
        setApiResults(prev => mergeUniqueSongs(prev, normalized));
      } else {
        setApiResults(normalized);
      }
    } catch (e: any) {
      setApiError(e.message || 'Search failed');
      if (!append) setApiResults([]);
    } finally {
      setApiLoading(false);
      setLoadingMore(false);
    }
  }, []);

  function handleSearchChange(val: string) {
    setSearchQuery(val);
    if (val.trim()) {
      setViewMode('search');
    } else {
      setViewMode('catalog');
      setApiResults([]);
      setSearched(false);
      setApiTotal(0);
      apiPageRef.current = 0;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchApi(val, 0, false), 500);
  }

  // Save an API song directly into Firestore catalog
  async function saveApiSongToFirestore(song: Song) {
    if (!song.streamUrl) {
      alert('Only direct-audio songs can be added to the catalog right now.');
      return;
    }

    setSavingApiId(song.id);
    try {
      const data = {
        title: song.title, artist: song.artist, album: song.album || null,
        genre: song.genre || null, duration: song.duration || null,
        imageUrl: song.imageUrl || null, streamUrl: song.streamUrl || null,
        audioUrl: song.streamUrl || null,
        year: song.year || null, releaseDate: song.releaseDate || null,
        source: song.source || 'api', sourceLabel: song.sourceLabel || song.source || 'api',
        externalUrl: song.externalUrl || null,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      };
      const ref = await addDoc(collection(db, 'songs'), data);
      const saved = { ...song, id: ref.id, inFirestore: true };
      setFirestoreSongs(prev => [saved, ...prev]);
      // Mark in api results
      setApiResults(prev => prev.map(s => s.id === song.id ? { ...s, inFirestore: true } : s));
    } catch (e: any) {
      alert('Failed to save: ' + e.message);
    } finally {
      setSavingApiId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this song?')) return;
    await deleteDoc(doc(db, 'songs', id));
    setFirestoreSongs(prev => prev.filter(s => s.id !== id));
  }

  async function handleSave() {
    if (!form.title.trim() || !form.artist.trim()) { setFormError('Title and Artist are required.'); return; }
    setSaving(true); setFormError('');
    try {
      let uploadedAudio = currentAudioAsset;
      if (selectedAudioFile) {
        uploadedAudio = await uploadAudioFile(selectedAudioFile);
      }

      const audioUrl = uploadedAudio?.audioUrl || uploadedAudio?.streamUrl || '';
      if (!audioUrl) {
        throw new Error('Please upload an MP3 file before saving this song.');
      }

      const data = {
        title: form.title.trim(), artist: form.artist.trim(),
        album: form.album.trim() || undefined, genre: form.genre || undefined,
        duration: form.duration ? parseInt(form.duration) : undefined,
        imageUrl: form.imageUrl.trim() || undefined,
        streamUrl: audioUrl,
        audioUrl,
        storagePath: uploadedAudio?.storagePath || null,
        fileName: uploadedAudio?.fileName || inferFileName(audioUrl),
        fileSize: uploadedAudio?.fileSize || null,
        mimeType: uploadedAudio?.mimeType || 'audio/mpeg',
        year: form.year ? parseInt(form.year) : null,
        source: 'admin', sourceLabel: 'admin upload', updatedAt: serverTimestamp(),
        ...(selectedAudioFile ? { uploadedAt: serverTimestamp() } : {}),
      };
      if (editId) {
        await updateDoc(doc(db, 'songs', editId), data);
        setFirestoreSongs(prev => prev.map(s => s.id === editId ? normalizeFirestoreSong(editId, { ...s, ...data }) : s));
      } else {
        const ref = await addDoc(collection(db, 'songs'), { ...data, createdAt: serverTimestamp() });
        setFirestoreSongs(prev => [normalizeFirestoreSong(ref.id, data), ...prev]);
      }
      closeModal();
    } catch (e: any) { setFormError(e.message || 'Failed to save.'); }
    finally { setSaving(false); }
  }

  function openEdit(song: Song) {
    setEditId(song.id);
    setForm({
      title: song.title || '', artist: song.artist || '', album: song.album || '',
      genre: song.genre || '', duration: song.duration?.toString() || '',
      imageUrl: song.imageUrl || '', year: song.year?.toString() || '',
    });
    setSelectedAudioFile(null);
    setCurrentAudioAsset(song.streamUrl ? {
      audioUrl: song.audioUrl || song.streamUrl,
      streamUrl: song.streamUrl || song.audioUrl || '',
      storagePath: song.storagePath,
      fileName: song.fileName || inferFileName(song.streamUrl || song.audioUrl),
      fileSize: song.fileSize,
      mimeType: song.mimeType,
      uploadedAt: song.uploadedAt || undefined,
    } : null);
    setFileInputKey(prev => prev + 1);
    setFormError('');
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setForm(EMPTY_FORM);
    setEditId(null);
    setFormError('');
    resetAudioSelection();
  }

  async function handlePlaySong(song: Song) {
    const audio = audioRef.current;
    if (!audio || !song.streamUrl) return;

    const sameSong = activeSongId === song.id && audio.src === song.streamUrl;

    if (sameSong && !audio.paused) {
      audio.pause();
      return;
    }

    if (!sameSong) {
      audio.src = song.streamUrl;
      setActiveSongId(song.id);
    }

    try {
      await audio.play();
    } catch (error) {
      console.error(error);
      setIsAudioPlaying(false);
      alert('This song could not be played in the admin panel.');
    }
  }

  // Catalog filter (when not searching)
  const [catalogFilter, setCatalogFilter] = useState('');
  const filteredCatalog = catalogFilter.trim()
    ? firestoreSongs.filter(s =>
        s.title?.toLowerCase().includes(catalogFilter.toLowerCase()) ||
        s.artist?.toLowerCase().includes(catalogFilter.toLowerCase()) ||
        s.album?.toLowerCase().includes(catalogFilter.toLowerCase())
      )
    : firestoreSongs;

  const displaySongs = viewMode === 'search' ? apiResults : filteredCatalog;
  const isLoading = viewMode === 'search' ? apiLoading : fsLoading;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Songs</h1>
          <p className="mt-1 text-sm text-gray-500">
            {fsLoading ? 'Loading...' : `${firestoreSongs.length} songs in catalog`}
          </p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <button type="button" onClick={fetchFirestoreSongs} disabled={fsLoading} className="btn-secondary flex items-center gap-2" title="Refresh catalog">
            <RefreshCw className={`size-4 ${fsLoading ? 'animate-spin' : ''}`} />
          </button>
          <button type="button" onClick={() => openCreateModal()} className="btn-primary flex flex-1 items-center justify-center gap-2 sm:flex-none">
            <Plus className="size-4" /> Add Song
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search full songs via JioSaavn mirrors (newest first)..."
          value={searchQuery}
          onChange={e => handleSearchChange(e.target.value)}
          className="input-field pl-10 pr-10"
        />
        {searchQuery && (
          <button type="button" onClick={() => {
            setSearchQuery(''); setViewMode('catalog');
            setApiResults([]); setSearched(false);
            setApiTotal(0); apiPageRef.current = 0;
          }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex w-full overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-1 sm:w-fit">
        <button type="button"
          onClick={() => { setViewMode('catalog'); setSearchQuery(''); setApiResults([]); setSearched(false); }}
          className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            viewMode === 'catalog' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Database className="size-4" />
          Catalog ({firestoreSongs.length})
        </button>
        <button type="button"
          onClick={() => { setViewMode('search'); if (searchQuery) searchApi(searchQuery, 0, false); }}
          className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            viewMode === 'search' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Globe className="size-4" />
          Search Results {searched && !apiLoading ? `(${apiResults.length}${apiTotal > apiResults.length ? `/${apiTotal}` : ''})` : ''}
        </button>
      </div>

      {/* Catalog filter (only in catalog mode) */}
      {viewMode === 'catalog' && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={`Filter ${firestoreSongs.length} catalog songs...`}
            value={catalogFilter}
            onChange={e => setCatalogFilter(e.target.value)}
            className="input-field pl-10 pr-10"
            disabled={fsLoading}
          />
          {catalogFilter && (
            <button type="button" onClick={() => setCatalogFilter('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="size-4" />
            </button>
          )}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Loader2 className="size-6 animate-spin text-blue-600" />
            <p className="text-sm text-gray-500">
              {viewMode === 'search' ? `Searching for "${searchQuery}"...` : 'Loading catalog...'}
            </p>
          </div>
        ) : viewMode === 'search' && !searched ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="size-10 text-gray-300" />
            <p className="mt-3 text-sm font-medium text-gray-900">Search for songs</p>
            <p className="mt-1 text-xs text-gray-500">Type in the search bar above to find full songs from the connected JioSaavn sources</p>
          </div>
        ) : apiError && viewMode === 'search' ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <X className="size-10 text-red-300" />
            <p className="mt-3 text-sm font-medium text-gray-900">Search failed</p>
            <p className="mt-1 text-xs text-gray-500">{apiError}</p>
          </div>
        ) : displaySongs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Music2 className="size-10 text-gray-300" />
            <p className="mt-3 text-sm font-medium text-gray-900">
              {viewMode === 'search' ? `No results for "${searchQuery}"` : 'No songs in catalog yet'}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {viewMode === 'catalog' ? 'Click "Add Song" to upload an MP3 or search to import from music APIs' : 'This song may not be available in the connected full-song APIs'}
            </p>
            {viewMode === 'search' && (
                <button type="button"
                  onClick={() => {
                    openCreateModal(searchQuery);
                  }}
                  className="btn-primary mt-4 flex items-center gap-2"
                >
                  <Plus className="size-4" /> Upload "{searchQuery}" manually
                </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Song</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Artist</th>
                  <th className="hidden px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 md:table-cell">Album</th>
                  <th className="hidden px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 lg:table-cell">Year</th>
                  <th className="hidden px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 lg:table-cell">Duration</th>
                  <th className="hidden px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 lg:table-cell">Source</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displaySongs.map(song => (
                  <tr key={song.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {song.imageUrl ? (
                          <Image src={song.imageUrl} alt={song.title} width={40} height={40}
                            className="size-10 flex-shrink-0 rounded-md object-cover"
                            unoptimized />
                        ) : (
                          <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-md bg-gray-100">
                            <Music2 className="size-5 text-gray-400" />
                          </div>
                        )}
                        <span className="max-w-[160px] truncate font-medium text-gray-900" title={song.title}>
                          {song.title || '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-[120px] truncate">{song.artist || '—'}</td>
                    <td className="hidden px-4 py-3 text-gray-500 md:table-cell">{song.album || '—'}</td>
                    <td className="hidden px-4 py-3 text-gray-500 lg:table-cell">{song.year || '—'}</td>
                    <td className="hidden px-4 py-3 text-gray-500 lg:table-cell">{formatDuration(song.duration)}</td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        song.source?.startsWith('jiosaavn') ? 'bg-orange-50 text-orange-700' :
                        song.source === 'admin' ? 'bg-blue-50 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {song.sourceLabel || song.source || 'unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {song.streamUrl && (
                          <button type="button"
                            onClick={() => handlePlaySong(song)}
                            className={`rounded-md p-1.5 ${
                              activeSongId === song.id && isAudioPlaying
                                ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                                : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'
                            }`}
                            title={activeSongId === song.id && isAudioPlaying ? 'Pause' : 'Play'}
                          >
                            {activeSongId === song.id && isAudioPlaying ? (
                              <Pause className="size-4" />
                            ) : (
                              <Play className="size-4" />
                            )}
                          </button>
                        )}
                        {/* API song: show "Add to Catalog" button */}
                        {viewMode === 'search' && !song.inFirestore && song.streamUrl && (
                          <button type="button"
                            onClick={() => saveApiSongToFirestore(song)}
                            disabled={savingApiId === song.id}
                            className="flex items-center gap-1 rounded-md border border-green-200 bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                            title="Add to catalog"
                          >
                            {savingApiId === song.id ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
                            Add
                          </button>
                        )}
                        {viewMode === 'search' && song.inFirestore && (
                          <span className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-400">
                            In catalog
                          </span>
                        )}
                        {/* Catalog song: edit + delete */}
                        {viewMode === 'catalog' && (
                          <>
                            <button type="button" onClick={() => openEdit(song)}
                              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700" title="Edit">
                              <Edit className="size-4" />
                            </button>
                            <button type="button" onClick={() => handleDelete(song.id)}
                              className="rounded-md p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700" title="Delete">
                              <Trash2 className="size-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <div className="border-t border-gray-100 bg-gray-50 px-4 py-2 text-xs text-gray-500">
              {viewMode === 'search'
                ? `${apiResults.length} newest-first direct-play results for "${searchQuery}"`
                : `${filteredCatalog.length} of ${firestoreSongs.length} songs${catalogFilter ? ` matching "${catalogFilter}"` : ''}`
              }
            </div>
            {/* Load more for search results */}
            {viewMode === 'search' && apiResults.length < apiTotal && (
              <div className="border-t border-gray-100 px-4 py-3 text-center">
                <button type="button"
                  onClick={() => searchApi(searchQuery, apiPageRef.current + 1, true)}
                  disabled={loadingMore}
                  className="btn-secondary flex items-center gap-2 mx-auto text-sm"
                >
                  {loadingMore ? <Loader2 className="size-4 animate-spin" /> : null}
                  Load more ({apiResults.length} of {apiTotal})
                </button>
              </div>
            )}
            {/* Not found hint */}
            {viewMode === 'search' && searched && !apiLoading && (
              <div className="border-t border-gray-100 bg-blue-50 px-4 py-3">
                <p className="text-xs text-blue-700">
                  Can't find the song? It may not be available in the connected full-song APIs.{' '}
                  <button type="button"
                    onClick={() => {
                      openCreateModal(searchQuery);
                    }}
                    className="font-semibold underline hover:no-underline"
                  >
                    Upload "{searchQuery}" manually
                  </button>
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <audio ref={audioRef} preload="none" className="hidden">
        <track kind="captions" />
      </audio>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-[max(1rem,var(--safe-top))] pb-[max(1rem,var(--safe-bottom))]">
          <button type="button" aria-label="Close modal" className="fixed inset-0 bg-black/40" onClick={closeModal} />
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">{editId ? 'Edit Song' : 'Add New Song'}</h2>
              <button type="button" onClick={closeModal} className="rounded-md p-1 text-gray-400 hover:bg-gray-100"><X className="size-5" /></button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-6 py-5 space-y-4">
              {formError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="songs-title-1" className="mb-1 block text-xs font-medium text-gray-700">Title <span className="text-red-500">*</span></label>
                  <input id="songs-title-1" className="input-field" placeholder="Song title" value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="songs-artist-2" className="mb-1 block text-xs font-medium text-gray-700">Artist <span className="text-red-500">*</span></label>
                  <input id="songs-artist-2" className="input-field" placeholder="Artist name" value={form.artist}
                    onChange={e => setForm(f => ({ ...f, artist: e.target.value }))} />
                </div>
                <div>
                  <label htmlFor="songs-album-3" className="mb-1 block text-xs font-medium text-gray-700">Album</label>
                  <input id="songs-album-3" className="input-field" placeholder="Album name" value={form.album}
                    onChange={e => setForm(f => ({ ...f, album: e.target.value }))} />
                </div>
                <div>
                  <label htmlFor="songs-genre-4" className="mb-1 block text-xs font-medium text-gray-700">Genre</label>
                  <select id="songs-genre-4" className="input-field" value={form.genre}
                    onChange={e => setForm(f => ({ ...f, genre: e.target.value }))}>
                    <option value="">Select genre</option>
                    {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="songs-duration-seconds-5" className="mb-1 block text-xs font-medium text-gray-700">Duration (seconds)</label>
                  <input id="songs-duration-seconds-5" className="input-field" type="number" placeholder="e.g. 213" value={form.duration}
                    onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} />
                </div>
                <div>
                  <label htmlFor="songs-year-6" className="mb-1 block text-xs font-medium text-gray-700">Year</label>
                  <input id="songs-year-6" className="input-field" type="number" placeholder="e.g. 2024" value={form.year}
                    onChange={e => setForm(f => ({ ...f, year: e.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="songs-artwork-url-7" className="mb-1 block text-xs font-medium text-gray-700">Artwork URL</label>
                  <input id="songs-artwork-url-7" className="input-field" placeholder="https://..." value={form.imageUrl}
                    onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <p className="mb-1 block text-xs font-medium text-gray-700">
                    MP3 File <span className="text-red-500">*</span>
                  </p>
                  <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">Upload the song file</p>
                        <p className="mt-1 text-xs text-gray-500">
                          MP3 only, up to 25 MB. The saved audio URL is used by both the web player and the app.
                        </p>
                      </div>
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:border-gray-300 hover:bg-gray-100">
                        <Upload className="size-4" />
                        Choose MP3
                        <input
                          key={fileInputKey}
                          type="file"
                          accept=".mp3,audio/mpeg"
                          className="hidden"
                          onChange={e => void handleAudioFileSelect(e.target.files?.[0] || null)}
                        />
                      </label>
                    </div>

                    {currentAudioAsset?.audioUrl && !selectedAudioFile && (
                      <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                        Current file: <span className="font-medium">{currentAudioAsset.fileName || inferFileName(currentAudioAsset.audioUrl)}</span>
                        <span className="ml-2 text-xs text-blue-600">
                          {formatFileSize(currentAudioAsset.fileSize)}
                        </span>
                      </div>
                    )}

                    {selectedAudioFile && (
                      <div className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                        Ready to upload: <span className="font-medium">{selectedAudioFile.name}</span>
                        <span className="ml-2 text-xs text-green-700">
                          {formatFileSize(selectedAudioFile.size)}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAudioFile(null);
                            setFileInputKey(prev => prev + 1);
                          }}
                          className="ml-3 text-xs font-medium text-green-700 underline hover:no-underline"
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col-reverse gap-3 border-t border-gray-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
              <button type="button" onClick={closeModal} className="btn-secondary w-full sm:w-auto">Cancel</button>
              <button type="button" onClick={handleSave} disabled={saving} className="btn-primary flex w-full items-center justify-center gap-2 sm:w-auto">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                {saving ? (uploadingAudio ? 'Uploading MP3...' : (editId ? 'Saving Changes...' : 'Adding Song...')) : (editId ? 'Save Changes' : 'Add Song')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

