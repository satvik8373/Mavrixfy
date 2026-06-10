'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronUp,
  Database,
  Link as LinkIcon,
  Loader2,
  MonitorPlay,
  Music,
  Music2,
  ListMusic,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import { auth, db } from '@/lib/firebase-client';
import { useAuth } from '@/hooks/useAuth';

interface CatalogSong {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  coverUrl: string;
  audioUrl: string;
  genre: string;
}

interface HomeHeroVideoItem {
  id: string;
  enabled: boolean;
  title: string;
  videoUrl: string;
  posterUrl: string;
  linkUrl: string;
  songId: string;
  song: CatalogSong | null;
  linkType?: 'song' | 'album' | 'playlist';
  album?: {
    id: string;
    saavnId: string;
    title: string;
    artist: string;
    coverUrl: string;
    songCount: number;
  } | null;
  playlist?: {
    id: string;
    saavnId: string;
    title: string;
    artist: string;
    coverUrl: string;
    songCount: number;
  } | null;
}

interface HomeHeroConfig {
  enabled: boolean;
  title: string;
  videoUrl: string;
  posterUrl: string;
  items: HomeHeroVideoItem[];
}

const DEFAULT_VIDEO_ITEM: HomeHeroVideoItem = {
  id: 'default-home-video',
  enabled: true,
  title: 'COCKTAIL 2',
  videoUrl:
    'https://res.cloudinary.com/djqq8kba8/video/upload/f_mp4,vc_h264,c_crop,g_center,w_1440,h_810/c_fill,w_1080,h_608,q_auto:good/v1780900137/Cocktail_2_Official_Trailer___Shahid_Kapoor_Kriti_Sanon_Rashmika_Mandanna___In_Cinemas_19th_June_1440p_dwlaum.mp4',
  posterUrl:
    'https://res.cloudinary.com/djqq8kba8/video/upload/so_2,c_crop,g_center,w_1440,h_810/c_fill,w_1080,h_608,q_auto,f_jpg/v1780900137/Cocktail_2_Official_Trailer___Shahid_Kapoor_Kriti_Sanon_Rashmika_Mandanna___In_Cinemas_19th_June_1440p_dwlaum.jpg',
  linkUrl: '',
  songId: '',
  song: null,
  linkType: 'song',
  album: null,
  playlist: null,
};

const DEFAULT_HOME_HERO_CONFIG: HomeHeroConfig = {
  enabled: true,
  title: DEFAULT_VIDEO_ITEM.title,
  videoUrl: DEFAULT_VIDEO_ITEM.videoUrl,
  posterUrl: DEFAULT_VIDEO_ITEM.posterUrl,
  items: [DEFAULT_VIDEO_ITEM],
};

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `home-video-${Date.now()}-${Math.round(Math.random() * 10000)}`;
}

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function toNumber(value: unknown) {
  const next = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(next) && next > 0 ? next : 0;
}

function normalizeSong(id: string, data: Record<string, any>): CatalogSong | null {
  const audioUrl = trimString(data.audioUrl || data.streamUrl || data.url);
  const title = trimString(data.title || data.name);
  if (!id || !title || !audioUrl) return null;

  const imageFromArray = Array.isArray(data.image)
    ? trimString(data.image[data.image.length - 1]?.url || data.image[data.image.length - 1]?.link)
    : '';

  return {
    id,
    title,
    artist: trimString(data.artist || data.primaryArtists) || 'Unknown Artist',
    album: typeof data.album === 'object' ? trimString(data.album?.name) : trimString(data.album),
    duration: toNumber(data.duration),
    coverUrl: trimString(data.coverUrl || data.imageUrl || imageFromArray),
    audioUrl,
    genre: trimString(data.genre || data.language),
  };
}

function normalizeLinkedSong(value: unknown): CatalogSong | null {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return normalizeSong(trimString(record.id), record as Record<string, any>);
}

function normalizeVideoItem(value: unknown, index: number): HomeHeroVideoItem | null {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const videoUrl = trimString(record.videoUrl);
  if (!videoUrl) return null;

  const song = normalizeLinkedSong(record.song);

  const albumRecord = record.album && typeof record.album === 'object' ? (record.album as Record<string, any>) : null;
  const album = albumRecord ? {
    id: trimString(albumRecord.id),
    saavnId: trimString(albumRecord.saavnId || albumRecord.id),
    title: trimString(albumRecord.title),
    artist: trimString(albumRecord.artist),
    coverUrl: trimString(albumRecord.coverUrl || albumRecord.imageUrl),
    songCount: toNumber(albumRecord.songCount),
  } : null;

  const playlistRecord = record.playlist && typeof record.playlist === 'object' ? (record.playlist as Record<string, any>) : null;
  const playlist = playlistRecord ? {
    id: trimString(playlistRecord.id),
    saavnId: trimString(playlistRecord.saavnId || playlistRecord.id),
    title: trimString(playlistRecord.title),
    artist: trimString(playlistRecord.artist),
    coverUrl: trimString(playlistRecord.coverUrl || playlistRecord.imageUrl),
    songCount: toNumber(playlistRecord.songCount),
  } : null;

  return {
    id: trimString(record.id) || `home-video-${index + 1}`,
    enabled: typeof record.enabled === 'boolean' ? record.enabled : true,
    title: trimString(record.title) || DEFAULT_VIDEO_ITEM.title,
    videoUrl,
    posterUrl: trimString(record.posterUrl),
    linkUrl: trimString(record.linkUrl),
    songId: trimString(record.songId) || song?.id || '',
    song,
    linkType: (record.linkType === 'album' || record.linkType === 'playlist') ? record.linkType : 'song',
    album,
    playlist,
  };
}

function normalizeConfig(data: Partial<HomeHeroConfig> | undefined): HomeHeroConfig {
  const record = data || {};
  const fallbackItem = {
    ...DEFAULT_VIDEO_ITEM,
    title: trimString(record.title) || DEFAULT_VIDEO_ITEM.title,
    videoUrl: trimString(record.videoUrl) || DEFAULT_VIDEO_ITEM.videoUrl,
    posterUrl: trimString(record.posterUrl) || DEFAULT_VIDEO_ITEM.posterUrl,
  };
  const items = Array.isArray(record.items)
    ? record.items
        .map((item, index) => normalizeVideoItem(item, index))
        .filter((item): item is HomeHeroVideoItem => Boolean(item))
    : [];
  const normalizedItems = items.length > 0 ? items : [fallbackItem];
  const firstVisibleItem = normalizedItems.find((item) => item.enabled) || normalizedItems[0] || fallbackItem;

  return {
    enabled: typeof record.enabled === 'boolean' ? record.enabled : DEFAULT_HOME_HERO_CONFIG.enabled,
    title: firstVisibleItem.title,
    videoUrl: firstVisibleItem.videoUrl,
    posterUrl: firstVisibleItem.posterUrl,
    items: normalizedItems,
  };
}

function createBlankVideoItem(): HomeHeroVideoItem {
  return {
    id: createId(),
    enabled: true,
    title: 'New showcase',
    videoUrl: '',
    posterUrl: '',
    linkUrl: '',
    songId: '',
    song: null,
    linkType: 'song',
    album: null,
    playlist: null,
  };
}

function buildSavePayload(config: HomeHeroConfig): HomeHeroConfig {
  const items = config.items
    .map((item, index) => normalizeVideoItem(item, index))
    .filter((item): item is HomeHeroVideoItem => Boolean(item));
  const normalizedItems = items.length > 0 ? items : [DEFAULT_VIDEO_ITEM];
  const firstVisibleItem = normalizedItems.find((item) => item.enabled) || normalizedItems[0];

  return {
    enabled: config.enabled,
    title: firstVisibleItem.title,
    videoUrl: firstVisibleItem.videoUrl,
    posterUrl: firstVisibleItem.posterUrl,
    items: normalizedItems,
  };
}

interface ApiSong {
  id: string;
  name?: string;
  title?: string;
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

function getMediaUrl(item?: { url?: string; link?: string }) {
  return item?.url || item?.link || '';
}

function normalizeApiSong(s: ApiSong): CatalogSong {
  const bestDownload = Array.isArray(s.downloadUrl)
    ? getMediaUrl(s.downloadUrl.find(u => u.quality === '320kbps') ||
       s.downloadUrl.find(u => u.quality === '160kbps') ||
       s.downloadUrl[s.downloadUrl.length - 1])
    : '';
  const bestAudio = bestDownload || s.streamUrl || s.url || '';

  const img = Array.isArray(s.image)
    ? (getMediaUrl(s.image[s.image.length - 1]) || getMediaUrl(s.image[0]))
    : (typeof s.image === 'string' ? s.image : s.imageUrl || '');

  const artist = s.artists?.primary?.map(a => a.name).join(', ')
    || s.primaryArtists
    || s.artist
    || '';

  const album = typeof s.album === 'object' && s.album !== null
    ? (s.album.name || '')
    : (typeof s.album === 'string' ? s.album : '');

  return {
    id: `api_${s.id}`,
    title: s.name || s.title || '',
    artist,
    album,
    genre: s.genre || s.language || '',
    duration: s.duration ? Number(s.duration) : 0,
    coverUrl: img,
    audioUrl: bestAudio || '',
  };
}

function cleanString(str: string): string {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

function areSongsSame(s1: CatalogSong | { title: string; artist: string }, s2: CatalogSong | { title: string; artist: string }): boolean {
  const cleanTitle1 = cleanString(s1.title);
  const cleanTitle2 = cleanString(s2.title);
  if (!cleanTitle1 || !cleanTitle2) return false;
  if (cleanTitle1 !== cleanTitle2) return false;

  const cleanArtist1 = cleanString(s1.artist.split(',')[0] || '');
  const cleanArtist2 = cleanString(s2.artist.split(',')[0] || '');
  return cleanArtist1 === cleanArtist2 || cleanArtist1.includes(cleanArtist2) || cleanArtist2.includes(cleanArtist1);
}

interface SearchableSongSelectProps {
  videoItem: HomeHeroVideoItem;
  songs: CatalogSong[];
  songsLoading: boolean;
  onSelectSong: (songId: string, song: CatalogSong | null) => void;
  onSelectAlbum: (album: any | null) => void;
  onSelectPlaylist: (playlist: any | null) => void;
  onClearLink: () => void;
  onAddSavedSongToCatalog: (song: CatalogSong) => void;
}

function SearchableSongSelect({
  videoItem,
  songs,
  songsLoading,
  onSelectSong,
  onSelectAlbum,
  onSelectPlaylist,
  onClearLink,
  onAddSavedSongToCatalog,
}: SearchableSongSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [searchType, setSearchType] = useState<'song' | 'album' | 'playlist'>('song');
  const [apiResults, setApiResults] = useState<any[]>([]);
  const [apiLoading, setApiLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedContainer, setSelectedContainer] = useState<{ id: string; saavnId: string; title: string; artist: string; imageUrl: string; type: 'album' | 'playlist'; songs: any[] } | null>(null);
  const [loadingContainerSongs, setLoadingContainerSongs] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const activeCoverUrl =
    videoItem.linkType === 'album' && videoItem.album?.coverUrl ? videoItem.album.coverUrl :
    videoItem.linkType === 'playlist' && videoItem.playlist?.coverUrl ? videoItem.playlist.coverUrl :
    videoItem.song?.coverUrl || '';

  const activeLabel =
    songsLoading ? 'Loading details…' :
    isImporting ? 'Importing song…' :
    videoItem.linkType === 'album' && videoItem.album ? `Album: ${videoItem.album.title}` :
    videoItem.linkType === 'playlist' && videoItem.playlist ? `Playlist: ${videoItem.playlist.title}` :
    videoItem.song ? `Song: ${videoItem.song.title} — ${videoItem.song.artist}` :
    'No attached link (click to select)';

  const selectedSong = videoItem.song;

  const openModal = () => {
    setSearch('');
    setSearchType(videoItem.linkType || 'song');
    setApiResults([]);
    setSelectedContainer(null);
    setIsOpen(true);
  };

  const closeModal = () => {
    if (isImporting || loadingContainerSongs) return;
    setIsOpen(false);
    setSearch('');
    setApiResults([]);
    setSelectedContainer(null);
  };

  const searchSongs = async (queryText: string, currentType = searchType) => {
    if (!queryText.trim()) { setApiResults([]); return; }
    setApiLoading(true);
    setSelectedContainer(null);
    try {
      const res = await fetch(`/api/music/search?query=${encodeURIComponent(queryText.trim())}&limit=12&type=${currentType}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      const results: any[] = json?.data?.results || [];
      if (currentType === 'song') {
        const normalized = results.map(normalizeApiSong);
        const unique: CatalogSong[] = [];
        for (const item of normalized) {
          if (!unique.some(u => areSongsSame(u, item))) {
            unique.push(item);
          }
        }
        setApiResults(unique);
      } else if (currentType === 'album') {
        setApiResults(results.map(item => ({
          id: item.id,
          saavnId: item.saavnId || item.id,
          title: item.title,
          artist: item.artist,
          coverUrl: item.imageUrl || '',
          type: 'album',
          songCount: item.songCount || 0,
        })));
      } else {
        setApiResults(results.map(item => ({
          id: item.id,
          saavnId: item.saavnId || item.id,
          title: item.title,
          artist: item.artist,
          coverUrl: item.imageUrl || '',
          type: 'playlist',
          songCount: item.songCount || 0,
        })));
      }
    } catch {
      setApiResults([]);
    } finally {
      setApiLoading(false);
    }
  };

  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchSongs(val), 500);
  };

  const handleSearchTypeChange = (type: 'song' | 'album' | 'playlist') => {
    setSearchType(type);
    setApiResults([]);
    setSelectedContainer(null);
    if (search.trim()) {
      searchSongs(search, type);
    }
  };

  const handleSelectContainer = async (container: { id: string; saavnId: string; title: string; artist: string; coverUrl: string; type: 'album' | 'playlist' }) => {
    setLoadingContainerSongs(true);
    try {
      const apiPath = container.type === 'album' ? 'album' : 'playlist';
      const res = await fetch(`/api/music/${apiPath}?id=${container.saavnId}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      if (json.success && json.data?.songs) {
        setSelectedContainer({
          id: container.id,
          saavnId: container.saavnId,
          title: container.title,
          artist: container.artist,
          imageUrl: container.coverUrl,
          type: container.type,
          songs: json.data.songs,
        });
      } else {
        alert('Could not find tracks in this container.');
      }
    } catch {
      alert('Failed to load tracks.');
    } finally {
      setLoadingContainerSongs(false);
    }
  };

  const handleChooseContainer = (container: any) => {
    if (searchType === 'album') {
      onSelectAlbum(container);
    } else {
      onSelectPlaylist(container);
    }
    closeModal();
  };

  const matchedCatalog = useMemo(() => {
    if (!search.trim()) return songs;
    const q = search.toLowerCase();
    return songs.filter(s => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q));
  }, [songs, search]);

  const matchedApiResults = useMemo(() => {
    if (searchType !== 'song') return [];
    return apiResults.filter(api =>
      !songs.some(c => areSongsSame(c, api))
    );
  }, [apiResults, songs, searchType]);

  const handleSelectSong = async (song: CatalogSong) => {
    if (song.id.startsWith('api_')) {
      if (!song.audioUrl) { alert('This song cannot be imported — no direct audio URL.'); return; }
      setIsImporting(true);
      try {
        const data = {
          title: song.title, artist: song.artist, album: song.album || null,
          genre: song.genre || null, duration: song.duration || null,
          imageUrl: song.coverUrl || null, streamUrl: song.audioUrl, audioUrl: song.audioUrl,
          source: 'jiosaavn', sourceLabel: 'jiosaavn',
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        };
        const ref = await addDoc(collection(db, 'songs'), data);
        const newSong: CatalogSong = { ...song, id: ref.id };
        onAddSavedSongToCatalog(newSong);
        onSelectSong(ref.id, newSong);
        closeModal();
      } catch (err: any) {
        alert('Failed to import: ' + err.message);
      } finally {
        setIsImporting(false);
      }
    } else {
      onSelectSong(song.id, song);
      closeModal();
    }
  };

  const normalizeTrackToCatalogSong = (t: any): CatalogSong => {
    const rawId = String(t.id || '');
    return {
      id: rawId.startsWith('api_') ? rawId : `api_${rawId}`,
      title: t.title,
      artist: t.artist,
      album: t.album || '',
      duration: t.duration || 0,
      coverUrl: t.imageUrl || '',
      audioUrl: t.audioUrl || t.streamUrl || '',
      genre: t.genre || '',
    };
  };

  // Song card used in both catalog and API sections
  const SongCard = ({ song, isApi }: { song: CatalogSong; isApi?: boolean }) => (
    <button
      type="button"
      onClick={() => handleSelectSong(song)}
      disabled={isImporting}
      className={`flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-gray-50 disabled:opacity-60 ${
        videoItem.linkType === 'song' && song.id === videoItem.songId ? 'bg-indigo-50 font-semibold' : ''
      }`}
    >
      {/* Art */}
      <div className="relative size-14 flex-shrink-0 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 shadow-sm">
        {song.coverUrl ? (
          <img src={song.coverUrl} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="flex size-full items-center justify-center">
            <Music2 className="size-6 text-gray-300" />
          </div>
        )}
        {videoItem.linkType === 'song' && song.id === videoItem.songId && (
          <div className="absolute inset-0 bg-indigo-600/80 flex items-center justify-center rounded-xl">
            <Check className="size-6 text-white" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-gray-900 truncate">{song.title}</p>
        <p className="text-xs text-gray-500 truncate mt-0.5">{song.artist}</p>
        {song.album && <p className="text-[11px] text-gray-400 truncate mt-0.5">{song.album}</p>}
      </div>

      {/* Badge */}
      <div className="flex-shrink-0">
        {videoItem.linkType === 'song' && song.id === videoItem.songId ? (
          <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white">
            <Check className="size-3" /> Selected
          </span>
        ) : isApi ? (
          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 border border-emerald-600 px-3 py-1.5 text-xs font-bold text-white">
            <Plus className="size-3" /> Import
          </span>
        ) : (
          <span className="inline-flex items-center rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-600">
            Select
          </span>
        )}
      </div>
    </button>
  );

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={openModal}
        disabled={songsLoading || isImporting}
        className="flex w-full items-center justify-between rounded-xl border border-gray-300 bg-white px-4 py-3 text-left text-sm transition-colors hover:border-indigo-400 hover:bg-indigo-50/30 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:bg-gray-50"
      >
        <div className="flex items-center gap-3 min-w-0">
          {activeCoverUrl ? (
            <img src={activeCoverUrl} alt="" className="size-9 rounded-lg object-cover flex-shrink-0 bg-gray-100 border border-gray-200" />
          ) : (
            <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100">
              {videoItem.linkType === 'album' ? (
                <Database className="size-4 text-gray-400" />
              ) : videoItem.linkType === 'playlist' ? (
                <ListMusic className="size-4 text-gray-400" />
              ) : (
                <Music2 className="size-4 text-gray-400" />
              )}
            </div>
          )}
          <span className="truncate font-medium text-gray-700">
            {activeLabel}
          </span>
        </div>
        <ChevronDown className="size-4 text-gray-400 flex-shrink-0 ml-2" />
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
          onKeyDown={e => { if (e.key === 'Escape') closeModal(); }}
        >
          <button type="button" className="fixed inset-0 cursor-default" onClick={closeModal} aria-label="Close" />

          <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-155"
            style={{ height: 'min(88vh, 700px)' }}>

            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200 bg-white">
              <Music2 className="size-5 text-indigo-500 flex-shrink-0" />
              <input
                type="text"
                placeholder={searchType === 'song' ? 'Search songs by title or artist…' : searchType === 'album' ? 'Search albums, movies…' : 'Search playlists…'}
                value={search}
                onChange={e => handleSearchChange(e.target.value)}
                autoFocus
                className="flex-1 bg-transparent text-base font-medium text-gray-900 outline-none placeholder-gray-400 min-w-0"
              />
              {search && (
                <button type="button" onClick={() => { setSearch(''); setApiResults([]); }}
                  className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors" aria-label="Clear">
                  ✕
                </button>
              )}
              <button type="button" onClick={closeModal} disabled={isImporting || loadingContainerSongs}
                className="ml-1 flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-400 bg-gray-100 hover:bg-gray-200 border border-gray-200 transition-colors">
                ✕ Esc
              </button>
            </div>

            {!selectedContainer && (
              <div className="flex items-center gap-2 px-5 py-2.5 border-b border-gray-100 bg-gray-50/50">
                <span className="text-xs font-semibold text-gray-400 mr-1 uppercase tracking-wide">Type:</span>
                <button
                  type="button"
                  onClick={() => handleSearchTypeChange('song')}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border transition-all ${
                    searchType === 'song'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <Music className="size-3" /> Songs
                </button>
                <button
                  type="button"
                  onClick={() => handleSearchTypeChange('album')}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border transition-all ${
                    searchType === 'album'
                      ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <Database className="size-3" /> Albums
                </button>
                <button
                  type="button"
                  onClick={() => handleSearchTypeChange('playlist')}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border transition-all ${
                    searchType === 'playlist'
                      ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <ListMusic className="size-3" /> Playlists
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">

              {(isImporting || loadingContainerSongs) && (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 className="size-8 animate-spin text-indigo-500" />
                  <p className="text-sm font-semibold text-gray-700">
                    {isImporting ? 'Importing track to catalog…' : 'Loading container tracks…'}
                  </p>
                </div>
              )}

              {!isImporting && !loadingContainerSongs && (
                <>
                  {selectedContainer ? (
                    <div>
                      <div className="bg-gray-50 px-5 py-4 border-b border-gray-200 flex items-start gap-4">
                        <button
                          type="button"
                          onClick={() => setSelectedContainer(null)}
                          className="p-1 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 transition-colors mr-1 shrink-0"
                          title="Back to results"
                        >
                          <ArrowLeft className="size-4 text-gray-600" />
                        </button>
                        <img
                          src={selectedContainer.imageUrl}
                          alt=""
                          className="size-16 rounded-xl object-cover border border-gray-200 shadow-sm shrink-0"
                          referrerPolicy="no-referrer"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                            {selectedContainer.type === 'album' ? 'Album tracks' : 'Playlist tracks'}
                          </p>
                          <p className="text-base font-bold text-gray-900 truncate mt-0.5">{selectedContainer.title}</p>
                          <p className="text-xs text-gray-500 truncate mt-0.5">{selectedContainer.artist}</p>
                        </div>
                      </div>

                      <div className="divide-y divide-gray-100">
                        {selectedContainer.songs.map((track, idx) => {
                          const normalized = normalizeTrackToCatalogSong(track);
                          const existsInCatalog = songs.some(c => areSongsSame(c, normalized));
                          const catalogMatch = songs.find(c => areSongsSame(c, normalized));
                          const target = catalogMatch || normalized;

                          return (
                            <button
                              key={track.id}
                              type="button"
                              onClick={() => handleSelectSong(target)}
                              className="flex w-full items-center gap-4 px-5 py-3.5 text-left hover:bg-gray-50 transition-colors"
                            >
                              <span className="text-xs font-bold text-gray-400 w-5 shrink-0 text-center">{idx + 1}</span>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-gray-900 truncate">{normalized.title}</p>
                                <p className="text-xs text-gray-500 truncate mt-0.5">{normalized.artist}</p>
                              </div>
                              <div className="shrink-0">
                                {existsInCatalog ? (
                                  <span className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-500">
                                    Catalog
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition-colors">
                                    <Plus className="size-3" /> Import
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Remove Option */}
                      {((videoItem.linkType === 'song' && videoItem.songId) ||
                        (videoItem.linkType === 'album' && videoItem.album) ||
                        (videoItem.linkType === 'playlist' && videoItem.playlist)) && (
                        <button type="button" onClick={() => { onClearLink(); closeModal(); }}
                          className="flex w-full items-center gap-3 px-5 py-3.5 text-left text-sm text-red-600 hover:bg-red-50 transition-colors">
                          <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-xl bg-red-50 border border-red-100">
                            <ArrowDown className="size-4 text-red-400" />
                          </div>
                          <span className="font-semibold">Remove attached link</span>
                        </button>
                      )}

                      {/* Songs list */}
                      {searchType === 'song' && (
                        <>
                          {/* Catalog */}
                          {matchedCatalog.length > 0 && (
                            <div>
                              <div className="sticky top-0 bg-gray-50 px-5 py-2 border-b border-gray-100 z-10">
                                <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
                                  In Catalog ({matchedCatalog.length})
                                </span>
                              </div>
                              {matchedCatalog.map(song => <SongCard key={song.id} song={song} />)}
                            </div>
                          )}

                          {/* API results */}
                          {matchedApiResults.length > 0 && (
                            <div>
                              <div className="sticky top-0 bg-gray-50 px-5 py-2 border-b border-gray-100 z-10">
                                <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
                                  From JioSaavn — tap to import & select
                                </span>
                              </div>
                              {matchedApiResults.map(song => <SongCard key={song.id} song={song} isApi />)}
                            </div>
                          )}
                        </>
                      )}

                      {/* Containers (Albums/Playlists) list */}
                      {(searchType === 'album' || searchType === 'playlist') && apiResults.length > 0 && (
                        <div>
                          <div className="sticky top-0 bg-gray-50 px-5 py-2 border-b border-gray-100 z-10">
                            <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
                              {searchType === 'album' ? 'Albums' : 'Playlists'} found
                            </span>
                          </div>
                          {apiResults.map(container => {
                            const isSelected =
                              searchType === 'album'
                                ? videoItem.linkType === 'album' && videoItem.album?.saavnId === container.saavnId
                                : videoItem.linkType === 'playlist' && videoItem.playlist?.saavnId === container.saavnId;

                            return (
                              <div
                                key={container.id}
                                className={`flex w-full items-center gap-4 px-5 py-4 transition-colors border-b border-gray-100 ${
                                  isSelected ? 'bg-indigo-50 font-semibold' : ''
                                }`}
                              >
                                <img
                                  src={container.coverUrl}
                                  alt=""
                                  className="size-14 rounded-xl object-cover border border-gray-200 shadow-sm shrink-0"
                                  referrerPolicy="no-referrer"
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-bold text-gray-900 truncate">{container.title}</p>
                                  <p className="text-xs text-gray-500 truncate mt-0.5">{container.artist}</p>
                                  <p className="text-[10px] text-gray-400 mt-0.5">
                                    {container.songCount > 0 ? `${container.songCount} songs` : 'Browse to view tracks'}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleSelectContainer(container)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                                  >
                                    Browse
                                  </button>
                                  {isSelected ? (
                                    <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-bold text-white shadow-sm">
                                      Selected
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleChooseContainer(container)}
                                      className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700"
                                    >
                                      Select Entire
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Loading API spinner */}
                      {apiLoading && (
                        <div className="flex items-center justify-center gap-2 py-12 text-xs text-gray-500">
                          <Loader2 className="size-4 animate-spin text-indigo-500" />
                          Searching JioSaavn…
                        </div>
                      )}

                      {/* Empty state */}
                      {!apiLoading && (searchType === 'song' ? (matchedCatalog.length === 0 && matchedApiResults.length === 0) : apiResults.length === 0) && (
                        <div className="flex flex-col items-center justify-center py-20 text-center px-8">
                          <div className="size-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                            {searchType === 'song' ? <Music2 className="size-7 text-gray-300" /> : searchType === 'album' ? <Database className="size-7 text-gray-300" /> : <ListMusic className="size-7 text-gray-300" />}
                          </div>
                          <p className="text-base font-semibold text-gray-900">
                            {search.trim() ? `No results for "${search}"` : `Search JioSaavn ${searchType}s`}
                          </p>
                          <p className="text-sm text-gray-400 mt-1">
                            {search.trim() ? 'Try a different search term' : `Type above to search JioSaavn ${searchType}s`}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 bg-gray-50 px-5 py-3 flex items-center justify-between">
              <p className="text-xs text-gray-400">
                {searchType === 'song' ? (
                  <>
                    {matchedCatalog.length} in catalog
                    {matchedApiResults.length > 0 && ` · ${matchedApiResults.length} on JioSaavn`}
                  </>
                ) : (
                  `${apiResults.length} results found`
                )}
              </p>
              {selectedSong && (
                <p className="text-xs font-semibold text-indigo-600 truncate max-w-[200px]">
                  ✓ {selectedSong.title}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function HomeVideoPage() {
  const { user } = useAuth();
  const [form, setForm] = useState<HomeHeroConfig>(DEFAULT_HOME_HERO_CONFIG);
  const [songs, setSongs] = useState<CatalogSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [songsLoading, setSongsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedItems((current) => ({
      ...current,
      [id]: !current[id],
    }));
  };

  const visibleItems = useMemo(
    () => form.items.filter((item) => item.enabled && item.videoUrl.trim()),
    [form.items]
  );

  useEffect(() => {
    const currentUser = user;
    if (!currentUser) return;

    async function loadConfig() {
      try {
        const token = await currentUser!.getIdToken();
        const response = await fetch('/api/home-video', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Could not load the current home video settings.');
        }
        setForm(normalizeConfig(result.data));
      } catch (err) {
        console.error('Failed to load home video config:', err);
        setError('Could not load the current home video settings.');
      } finally {
        setLoading(false);
      }
    }

    async function loadSongs() {
      try {
        let snapshot;
        try {
          snapshot = await getDocs(query(collection(db, 'songs'), orderBy('title')));
        } catch {
          snapshot = await getDocs(collection(db, 'songs'));
        }

        const nextSongs = snapshot.docs
          .map((songDoc) => normalizeSong(songDoc.id, songDoc.data()))
          .filter((song): song is CatalogSong => Boolean(song))
          .sort((a, b) => `${a.title} ${a.artist}`.localeCompare(`${b.title} ${b.artist}`));
        setSongs(nextSongs);
      } catch (err) {
        console.error('Failed to load songs:', err);
      } finally {
        setSongsLoading(false);
      }
    }

    void loadConfig();
    void loadSongs();
  }, [user]);

  function updateItem(itemId: string, patch: Partial<HomeHeroVideoItem>) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    }));
  }

  function selectSong(itemId: string, songId: string, songPassed?: CatalogSong | null) {
    const song = songPassed !== undefined ? songPassed : (songs.find((candidate) => candidate.id === songId) || null);
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          linkType: 'song',
          songId,
          song,
          album: null,
          playlist: null,
          title: song && (!item.title.trim() || item.title === 'New showcase') ? song.title : item.title,
          posterUrl: song?.coverUrl && !item.posterUrl.trim() ? song.coverUrl : item.posterUrl,
        };
      }),
    }));
  }

  function selectAlbum(itemId: string, album: any | null) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          linkType: 'album',
          songId: '',
          song: null,
          album: album ? {
            id: album.id,
            saavnId: album.saavnId || album.id,
            title: album.title,
            artist: album.artist,
            coverUrl: album.coverUrl,
            songCount: album.songCount || 0,
          } : null,
          playlist: null,
          title: album && (!item.title.trim() || item.title === 'New showcase') ? album.title : item.title,
          posterUrl: album?.coverUrl && !item.posterUrl.trim() ? album.coverUrl : item.posterUrl,
        };
      }),
    }));
  }

  function selectPlaylist(itemId: string, playlist: any | null) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          linkType: 'playlist',
          songId: '',
          song: null,
          album: null,
          playlist: playlist ? {
            id: playlist.id,
            saavnId: playlist.saavnId || playlist.id,
            title: playlist.title,
            artist: playlist.artist,
            coverUrl: playlist.coverUrl,
            songCount: playlist.songCount || 0,
          } : null,
          title: playlist && (!item.title.trim() || item.title === 'New showcase') ? playlist.title : item.title,
          posterUrl: playlist?.coverUrl && !item.posterUrl.trim() ? playlist.coverUrl : item.posterUrl,
        };
      }),
    }));
  }

  function clearLink(itemId: string) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          linkType: 'song',
          songId: '',
          song: null,
          album: null,
          playlist: null,
        };
      }),
    }));
  }

  function moveItem(itemId: string, direction: -1 | 1) {
    setForm((current) => {
      const fromIndex = current.items.findIndex((item) => item.id === itemId);
      const toIndex = fromIndex + direction;
      if (fromIndex < 0 || toIndex < 0 || toIndex >= current.items.length) return current;

      const nextItems = [...current.items];
      const [item] = nextItems.splice(fromIndex, 1);
      nextItems.splice(toIndex, 0, item);
      return { ...current, items: nextItems };
    });
  }

  function addItem() {
    const newItem = createBlankVideoItem();
    setForm((current) => ({ ...current, items: [...current.items, newItem] }));
    setExpandedItems((current) => ({ ...current, [newItem.id]: true }));
  }

  function removeItem(itemId: string) {
    setForm((current) => {
      const nextItems = current.items.filter((item) => item.id !== itemId);
      return { ...current, items: nextItems.length > 0 ? nextItems : [createBlankVideoItem()] };
    });
  }

  async function saveConfig(nextConfig: HomeHeroConfig = form) {
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Your admin session is not ready. Please sign in again.');
      }
      const payload = buildSavePayload(nextConfig);
      const token = await currentUser.getIdToken();
      const response = await fetch('/api/home-video', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Could not save the home video settings.');
      }
      setForm(normalizeConfig(result.data));
      setMessage('Home video lineup updated. The app will refresh this showcase automatically.');
    } catch (err) {
      console.error('Failed to save home video config:', err);
      setError('Could not save the home video settings.');
    } finally {
      setSaving(false);
    }
  }

  function resetToDefault() {
    setForm(DEFAULT_HOME_HERO_CONFIG);
    setMessage('');
    setError('');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Home Video</h1>
          <p className="mt-1 text-sm text-gray-500">Manage the app home showcase videos, tap links, and attached songs.</p>
        </div>
        <button
          type="button"
          onClick={() => saveConfig()}
          disabled={saving || loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save
        </button>
      </div>

      {message ? (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <Check className="size-4" />
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
        <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-gray-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Showcase Lineup</h2>
              <p className="mt-1 text-xs text-gray-500">{form.items.length} video{form.items.length === 1 ? '' : 's'} configured</p>
            </div>
            <button
              type="button"
              onClick={addItem}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              <Plus className="size-4" />
              Add video
            </button>
          </div>

          {loading ? (
            <div className="flex min-h-[320px] items-center justify-center text-sm text-gray-500">
              <Loader2 className="mr-2 size-4 animate-spin" />
              Loading settings
            </div>
          ) : (
            <div className="space-y-5 p-6">
              <label className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                <span>
                  <span className="block text-sm font-medium text-gray-900">Show home showcase</span>
                  <span className="block text-xs text-gray-500">Turns the complete video row on or off.</span>
                </span>
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
                  className="size-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </label>

              {form.items.map((item, index) => {
                const isExpanded = expandedItems[item.id] ?? (index === 0);
                return (
                  <div
                    key={item.id}
                    className="group rounded-xl border border-gray-200 bg-white shadow-sm transition-all duration-200 hover:border-gray-300"
                  >
                    {/* Accordion Header */}
                    <div
                      onClick={() => toggleExpand(item.id)}
                      className="flex cursor-pointer select-none items-center justify-between p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-gray-400 transition-colors group-hover:text-gray-600">
                          {isExpanded ? (
                            <ChevronUp className="size-5" />
                          ) : (
                            <ChevronDown className="size-5" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-900">
                              Video {index + 1}
                            </span>
                            {item.title.trim() && (
                              <span className="text-sm font-medium text-gray-500">
                                — {item.title}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {item.enabled ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                Visible
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                                Hidden
                              </span>
                            )}
                            {item.linkType === 'album' && item.album ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700">
                                <Database className="size-3" />
                                Album: {item.album.title}
                              </span>
                            ) : item.linkType === 'playlist' && item.playlist ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
                                <ListMusic className="size-3" />
                                Playlist: {item.playlist.title}
                              </span>
                            ) : item.songId ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                                <Music2 className="size-3" />
                                Song: {item.song?.title || 'Attached'}
                              </span>
                            ) : (
                              item.linkUrl && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold text-cyan-700">
                                  <LinkIcon className="size-3" />
                                  Link Fallback
                                </span>
                              )
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Header Actions */}
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1.5"
                      >
                        <button
                          type="button"
                          onClick={() => updateItem(item.id, { enabled: !item.enabled })}
                          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                            item.enabled
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100/80'
                              : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100/80'
                          }`}
                        >
                          {item.enabled ? 'Hide' : 'Show'}
                        </button>
                        <div className="h-6 w-px bg-gray-200 mx-1" />
                        <button
                          type="button"
                          onClick={() => moveItem(item.id, -1)}
                          disabled={index === 0}
                          className="rounded-lg border border-gray-200 p-1.5 text-gray-500 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <ArrowUp className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveItem(item.id, 1)}
                          disabled={index === form.items.length - 1}
                          className="rounded-lg border border-gray-200 p-1.5 text-gray-500 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <ArrowDown className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="rounded-lg border border-red-100 p-1.5 text-red-500 transition-colors hover:bg-red-50"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Accordion Expanded Content */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 p-4 space-y-4 animate-in fade-in duration-200">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <label htmlFor={`home-video-title-${item.id}`} className="text-xs font-bold uppercase tracking-wider text-gray-500">
                              Small title
                            </label>
                            <input
                              id={`home-video-title-${item.id}`}
                              className="input-field mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              value={item.title}
                              onChange={(event) => updateItem(item.id, { title: event.target.value })}
                              placeholder="COCKTAIL 2"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-bold uppercase tracking-wider text-gray-500">
                              Tap to play song
                            </label>
                            <SearchableSongSelect
                              videoItem={item}
                              songs={songs}
                              songsLoading={songsLoading}
                              onSelectSong={(songId, song) => selectSong(item.id, songId, song)}
                              onSelectAlbum={(album) => selectAlbum(item.id, album)}
                              onSelectPlaylist={(playlist) => selectPlaylist(item.id, playlist)}
                              onClearLink={() => clearLink(item.id)}
                              onAddSavedSongToCatalog={(newSong) => {
                                setSongs((prev) => [newSong, ...prev]);
                              }}
                            />
                          </div>
                        </div>

                        <div>
                          <label htmlFor={`home-video-url-${item.id}`} className="text-xs font-bold uppercase tracking-wider text-gray-500">
                            MP4 video URL
                          </label>
                          <textarea
                            id={`home-video-url-${item.id}`}
                            rows={2}
                            className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                            value={item.videoUrl}
                            onChange={(event) => updateItem(item.id, { videoUrl: event.target.value })}
                            placeholder="https://res.cloudinary.com/.../video.mp4"
                          />
                        </div>

                        {!item.songId && (
                          <div className="grid gap-4 sm:grid-cols-2 animate-in fade-in duration-200">
                            <div>
                              <label htmlFor={`home-video-poster-${item.id}`} className="text-xs font-bold uppercase tracking-wider text-gray-500">
                                Poster image URL
                              </label>
                              <textarea
                                id={`home-video-poster-${item.id}`}
                                rows={2}
                                className="mt-1.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                                value={item.posterUrl}
                                onChange={(event) => updateItem(item.id, { posterUrl: event.target.value })}
                                placeholder="https://res.cloudinary.com/.../poster.jpg"
                              />
                            </div>

                            <div>
                              <label htmlFor={`home-video-link-${item.id}`} className="text-xs font-bold uppercase tracking-wider text-gray-500">
                                Tap link fallback
                              </label>
                              <div className="relative mt-1.5">
                                <LinkIcon className="pointer-events-none absolute left-3 top-2.5 size-4 text-gray-400" />
                                <input
                                  id={`home-video-link-${item.id}`}
                                  className="w-full rounded-md border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  value={item.linkUrl}
                                  onChange={(event) => updateItem(item.id, { linkUrl: event.target.value })}
                                  placeholder="https://... or app link"
                                />
                              </div>
                              <p className="mt-1.5 text-[11px] text-gray-400">Used only when no song is attached.</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => saveConfig()}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  Save lineup
                </button>
                <button
                  type="button"
                  onClick={resetToDefault}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RotateCcw className="size-4" />
                  Reset default
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-sm font-semibold text-gray-900">App Preview</h2>
          </div>
          <div className="p-6">
            {form.enabled && visibleItems.length > 0 ? (
              <div className="flex flex-col gap-4">
                {visibleItems.map((item, index) => {
                  const ordinals = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'];
                  const label = ordinals[index] || `${index + 1}th`;
                  return (
                    <div key={item.id} className="space-y-1.5">
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                        {label} Video
                      </div>
                      <div className="relative h-44 w-full overflow-hidden rounded-xl bg-gray-900">
                        <video
                          className="size-full object-cover"
                          src={item.videoUrl}
                          poster={item.posterUrl}
                          muted
                          loop
                          playsInline
                          autoPlay
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent p-3">
                          <div className="inline-flex items-center gap-1.5 rounded bg-red-600 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                            Live
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            {item.song ? <Music2 className="size-4 text-white" /> : <MonitorPlay className="size-4 text-white" />}
                            <p className="truncate text-sm font-semibold text-white">{item.title || DEFAULT_VIDEO_ITEM.title}</p>
                          </div>
                          {item.song ? <p className="mt-1 truncate text-xs text-white/75">{item.song.title}</p> : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex h-44 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-500">
                Home video hidden
              </div>
            )}
            <p className="mt-3 text-xs text-gray-500">
              Users can swipe through the row. Tapping a card plays its attached song, or opens the fallback link.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
