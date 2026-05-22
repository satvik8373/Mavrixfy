import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Heart,
  Music,
  Play,
  Pause,
  Clock,
  MoreHorizontal,
  ArrowDownUp,
  Search,
  ListPlus,
  User,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ShuffleButton } from '@/components/ShuffleButton';
import { Input } from '@/components/ui/input';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { usePlayerSync } from '@/hooks/usePlayerSync';
import { useAuthStore } from '@/stores/useAuthStore';
import { useLikedSongsStore } from '@/stores/useLikedSongsStore';
import { Song } from '@/types';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { getHighestQualityAudioUrl } from '@/utils/jiosaavnAudio';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LikeButton } from '@/components/LikeButton';

// ─── helpers ────────────────────────────────────────────────────────────────

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec < 10 ? '0' : ''}${sec}`;
};

const INVALID = new Set(['', 'null', 'undefined', '[object object]']);
const OID = /^[a-f\d]{24}$/i;

const safe = (v: unknown): string => {
  if (v == null) return '';
  const s = String(v).trim();
  return INVALID.has(s.toLowerCase()) ? '' : s;
};

const albumLabel = (song: Song): string => {
  const a = safe((song as any).album);
  if (a) return a;
  const id = safe(song.albumId);
  if (id && !OID.test(id)) return id;
  return 'Unknown Album';
};

const parseDate = (v: unknown): Date | null => {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === 'string' || typeof v === 'number') {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === 'object') {
    const t = v as any;
    if (typeof t.toDate === 'function') return parseDate(t.toDate());
    const sec = t.seconds ?? t._seconds;
    if (typeof sec === 'number') return parseDate(sec * 1000);
  }
  return null;
};

const dateLabel = (song: Song): string => {
  const d = parseDate(song.likedAt) ?? parseDate(song.createdAt);
  if (!d) return 'Recently added';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: new Date().getFullYear() !== d.getFullYear() ? 'numeric' : undefined,
  });
};

const timestamp = (song: Song): number =>
  (parseDate(song.likedAt) ?? parseDate(song.createdAt))?.getTime() ?? 0;

// ─── SongRow ────────────────────────────────────────────────────────────────

interface RowProps {
  song: Song;
  index: number;
  isMobile: boolean;
  playing: boolean;
  onPlay: (song: Song, index: number) => void;
  onToggle: () => void;
  onQueue: (song: Song) => void;
  onUnlike: (songId: string) => void;
}

const SongRow = React.memo(
  ({ song, index, isMobile, playing, onPlay, onToggle, onQueue, onUnlike }: RowProps) => {
    const handlePlayClick = React.useCallback((e: React.MouseEvent) => {
      e.stopPropagation();
      onPlay(song, index);
    }, [song, index, onPlay]);

    const handleToggleClick = React.useCallback((e: React.MouseEvent) => {
      e.stopPropagation();
      onToggle();
    }, [onToggle]);

    const handleUnlikeClick = React.useCallback(() => {
      onUnlike(song._id);
    }, [song._id, onUnlike]);

    const handleQueueClick = React.useCallback(() => {
      onQueue(song);
    }, [song, onQueue]);

    return (
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.click(); } }}
        onClick={handlePlayClick}
        className={cn(
          'group relative rounded-md cursor-pointer items-center',
          isMobile
            ? 'flex gap-3 px-4 py-2.5 active:bg-white/5'
            : 'grid grid-cols-[16px_4fr_3fr_2fr_40px_1fr_48px] gap-4 p-2 px-4 hover:bg-white/5 transition-colors',
        )}
      >
        {/* Desktop: index / play */}
        {!isMobile && (
          <div className="flex items-center justify-center text-sm text-muted-foreground group-hover:text-foreground">
            {playing ? (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={handleToggleClick}>
                <Pause className="h-4 w-4 fill-current" />
              </Button>
            ) : (
              <>
                <span className="group-hover:hidden">{index + 1}</span>
                <Button variant="ghost" size="icon" className="h-8 w-8 hidden group-hover:flex" onClick={handlePlayClick}>
                  <Play className="h-4 w-4 fill-current" />
                </Button>
              </>
            )}
          </div>
        )}

        {/* Artwork + title/artist */}
        <div className="flex items-center min-w-0 flex-1">
          <div className={cn('flex-shrink-0 overflow-hidden rounded shadow-md mr-3', isMobile ? 'w-12 h-12' : 'w-10 h-10')}>
            <img
              src={song.imageUrl || '/mavrixfy.png'}
              alt={song.title}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
              onError={e => { (e.currentTarget as HTMLImageElement).src = '/mavrixfy.png'; }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className={cn('font-medium text-sm leading-tight truncate', playing ? 'text-primary' : 'text-foreground')}>
              {song.title}
            </div>
            <div className="text-muted-foreground text-xs truncate mt-0.5">{song.artist}</div>
          </div>
        </div>

        {/* Mobile: like + menu */}
        {isMobile && (
          <div className="flex-shrink-0 flex items-center gap-1">
            <LikeButton isLiked onToggle={handleUnlikeClick} iconSize={20} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-50" onClick={e => e.stopPropagation()}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleQueueClick}>
                  <ListPlus className="h-4 w-4 mr-2" /> Add to Queue
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleUnlikeClick} className="text-red-400">
                  <Heart className="h-4 w-4 mr-2" /> Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Desktop: album */}
        {!isMobile && <div className="text-muted-foreground text-sm truncate">{albumLabel(song)}</div>}
        {/* Desktop: date */}
        {!isMobile && <div className="text-muted-foreground text-sm">{dateLabel(song)}</div>}
        {/* Desktop: like */}
        {!isMobile && (
          <div className="flex items-center justify-center">
            <LikeButton isLiked onToggle={handleUnlikeClick} iconSize={18} />
          </div>
        )}
        {/* Desktop: duration */}
        {!isMobile && <div className="text-muted-foreground text-sm text-right">{formatTime(song.duration || 0)}</div>}
        {/* Desktop: menu */}
        {!isMobile && (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100" onClick={e => e.stopPropagation()}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleQueueClick}>
                  <ListPlus className="h-4 w-4 mr-2" /> Add to Queue
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleUnlikeClick} className="text-red-400">
                  <Heart className="h-4 w-4 mr-2" /> Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    );
  },
  (p, n) => p.song._id === n.song._id && p.playing === n.playing && p.index === n.index && p.isMobile === n.isMobile,
);
SongRow.displayName = 'SongRow';

// ─── Page ────────────────────────────────────────────────────────────────────


interface LikedSongsHeroProps {
  isMobile: boolean;
  likedSongsCount: number;
  isPlaylistPlaying: boolean;
  handleMainPlay: () => void;
  setSort: (sort: 'recent' | 'title' | 'artist') => void;
  navigate: any;
}

const LikedSongsHero = ({
  isMobile,
  likedSongsCount,
  isPlaylistPlaying,
  handleMainPlay,
  setSort,
  navigate,
}: LikedSongsHeroProps) => {
  return isMobile ? (
    <>
      {/* Gradient hero */}
      <div className="bg-gradient-to-b from-purple-700/90 via-purple-800/60 to-background px-4 pt-4 pb-5">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-purple-400 via-purple-500
                          to-purple-700 flex items-center justify-center shadow-2xl flex-shrink-0 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-black/20" />
            <Heart className="h-10 w-10 text-white fill-white relative z-10" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white/60 uppercase tracking-widest mb-1">Playlist</p>
            <h1 className="text-2xl font-semibold text-white leading-tight">Liked Songs</h1>
            <div className="flex items-center gap-1 text-xs text-white/60 mt-1">
              <User className="h-3 w-3" />
              <span>{likedSongsCount} songs</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky bar */}
      <div
        className="sticky top-0 z-20 flex items-center justify-between px-4 py-2.5
                   bg-[#120820]/95 backdrop-blur-xl border-b border-white/[0.06]"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-purple-400 to-purple-700
                          flex items-center justify-center flex-shrink-0 shadow">
            <Heart className="h-3.5 w-3.5 text-white fill-white" />
          </div>
          <span className="text-[15px] font-bold text-white truncate">Liked Songs</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <ShuffleButton size="sm" className="h-8 w-8 text-white/70" accentColor="#1ed760" />
          <button type="button"
            onClick={handleMainPlay}
            disabled={!likedSongsCount}
            className="h-9 w-9 rounded-full bg-green-500 hover:bg-green-400 active:scale-95
                       flex items-center justify-center shadow-lg disabled:opacity-40 transition-all"
          >
            {isPlaylistPlaying
              ? <Pause className="h-4 w-4 fill-black text-black" />
              : <Play className="h-4 w-4 fill-black text-black ml-0.5" />}
          </button>
        </div>
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between px-4 py-3
                      bg-gradient-to-b from-background/30 to-background">
        <div className="flex items-center gap-3">
          <Button
            size="icon"
            onClick={handleMainPlay}
            disabled={!likedSongsCount}
            className="rounded-full bg-green-500 hover:bg-green-400 shadow-xl hover:scale-105 transition-all"
            style={{ width: 52, height: 52 }}
          >
            {isPlaylistPlaying
              ? <Pause className="h-6 w-6 fill-black text-black" />
              : <Play className="h-6 w-6 fill-black text-black ml-0.5" />}
          </Button>
          <ShuffleButton
            size="md"
            className="h-10 w-10 text-white/70 hover:text-white hover:bg-white/10 transition-all"
            accentColor="#1ed760"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-white/60">
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setSort('recent')}><Clock className="h-4 w-4 mr-2" />Recently Added</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSort('title')}><ArrowDownUp className="h-4 w-4 mr-2" />Title</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSort('artist')}><Music className="h-4 w-4 mr-2" />Artist</DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/liked-songs/import')}><Upload className="h-4 w-4 mr-2" />Import Tool</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  ) : (
    /* ── Desktop hero ─────────────────────────────────────────────── */
    <div className="relative">
      <div className="bg-gradient-to-b from-purple-700/60 via-purple-800/40 to-background p-8 pb-6">
        <div className="flex items-end gap-6">
          <div className="w-56 h-56 rounded-md bg-gradient-to-br from-purple-400 via-purple-500
                          to-purple-700 flex items-center justify-center shadow-2xl relative overflow-hidden flex-shrink-0">
            <div className="absolute inset-0 bg-gradient-to-br from-white/15 to-black/25" />
            <Heart className="h-24 w-24 text-white fill-white relative z-10" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white/80 mb-3">Playlist</p>
            <h1 className="text-6xl font-semibold text-white mb-5 tracking-tight">Liked Songs</h1>
            <div className="flex items-center gap-2 text-sm text-white/70">
              <User className="h-4 w-4" />
              <span>{likedSongsCount} songs</span>
            </div>
          </div>
        </div>
      </div>
      <div className="px-8 pb-6 flex items-center gap-6 bg-gradient-to-b from-background/20 to-background">
        <Button
          size="icon"
          onClick={handleMainPlay}
          disabled={!likedSongsCount}
          className="h-16 w-16 rounded-full bg-green-500 hover:bg-green-400 shadow-xl hover:scale-105 transition-all"
        >
          {isPlaylistPlaying
            ? <Pause className="h-7 w-7 fill-black text-black" />
            : <Play className="h-7 w-7 fill-black text-black ml-0.5" />}
        </Button>
        <ShuffleButton size="lg" className="h-12 w-12 text-white/70 hover:text-white hover:bg-white/10 transition-all" accentColor="#1ed760" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-12 w-12 text-white/60">
              <MoreHorizontal className="h-6 w-6" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setSort('recent')}><Clock className="h-4 w-4 mr-2" />Recently Added</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSort('title')}><ArrowDownUp className="h-4 w-4 mr-2" />Title</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSort('artist')}><Music className="h-4 w-4 mr-2" />Artist</DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/liked-songs/import')}><Upload className="h-4 w-4 mr-2" />Import Tool</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

const LikedSongsPage = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [sort, setSort] = useState<'recent' | 'title' | 'artist'>('recent');
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const { togglePlay, playAlbum, setIsPlaying, setUserInteracted } = usePlayerStore();
  const { currentSong, isPlaying } = usePlayerSync();
  const { isAuthenticated } = useAuthStore();
  const { likedSongs, loadLikedSongs, removeLikedSong } = useLikedSongsStore();

  // ── resize ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h, { passive: true });
    return () => window.removeEventListener('resize', h);
  }, []);

  // ── load ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isAuthenticated) loadLikedSongs().catch(() => {});
  }, [isAuthenticated]);

  // ── sort / filter ────────────────────────────────────────────────────────
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = q
      ? likedSongs.filter(s => `${s.title} ${s.artist}`.toLowerCase().includes(q))
      : [...likedSongs];
    if (sort === 'recent') list.sort((a, b) => timestamp(b) - timestamp(a));
    else if (sort === 'title') list.sort((a, b) => a.title.localeCompare(b.title));
    else list.sort((a, b) => a.artist.localeCompare(b.artist));
    return list;
  }, [likedSongs, query, sort]);

  // ── playing state ────────────────────────────────────────────────────────
  const isSongPlaying = useCallback(
    (song: Song) => {
      if (!isPlaying || !currentSong) return false;
      if (currentSong._id && song._id) return currentSong._id === song._id;
      return (
        currentSong.title?.toLowerCase() === song.title?.toLowerCase() &&
        currentSong.artist?.toLowerCase() === song.artist?.toLowerCase()
      );
    },
    [isPlaying, currentSong],
  );

  const isPlaylistPlaying = useMemo(
    () => isPlaying && likedSongs.some(s => isSongPlaying(s)),
    [isPlaying, likedSongs, isSongPlaying],
  );

  // ── actions ──────────────────────────────────────────────────────────────
  const handlePlay = useCallback(
    async (song: Song, idx: number) => {
      if (isSongPlaying(song)) { togglePlay(); return; }

      let toPlay = song;
      if (!song.audioUrl) {
        const id = song._id?.replace(/^(indian-song-|liked-)/, '').split('-')[0];
        if (!id || id.length < 5) { toast.error('Cannot play this song'); return; }
        try {
          toast.loading('Loading…', { id: 'ls-load' });
          const res = await fetch(`/api/jiosaavn/songs/${id}`);
          const data = await res.json();
          const url = data?.success && getHighestQualityAudioUrl(data.data?.downloadUrl);
          if (url) toPlay = { ...song, audioUrl: url };
          toast.dismiss('ls-load');
        } catch {
          toast.dismiss('ls-load');
          toast.error('Failed to load song');
          return;
        }
      }
      if (!toPlay.audioUrl) { toast.error('Song not available'); return; }

      const updated = visible.map(s => s._id === toPlay._id ? toPlay : s);
      playAlbum(updated, idx);
      setIsPlaying(true);
      setUserInteracted();
    },
    [isSongPlaying, togglePlay, visible, playAlbum, setIsPlaying, setUserInteracted],
  );

  const handleQueue = useCallback((song: Song) => {
    usePlayerStore.getState().addToQueue(song);
    toast.success(`Added "${song.title}" to queue`, { duration: 2000 });
  }, []);

  const handleUnlike = useCallback(
    async (songId: string) => {
      if (!songId || songId === 'undefined') { toast.error('Invalid song ID'); return; }
      try {
        await removeLikedSong(songId);
        toast.success('Removed from Liked Songs');
      } catch {
        toast.error('Failed to remove song');
      }
    },
    [removeLikedSong],
  );

  const handleMainPlay = useCallback(() => {
    if (isPlaylistPlaying) { setIsPlaying(false); return; }
    if (!likedSongs.length) return;
    playAlbum(likedSongs, 0);
    setIsPlaying(true);
    setUserInteracted();
  }, [isPlaylistPlaying, likedSongs, playAlbum, setIsPlaying, setUserInteracted]);

  const handlePlayRow = useCallback((song: Song, index: number) => {
    void handlePlay(song, index);
  }, [handlePlay]);

  const handleQueueRow = useCallback((song: Song) => {
    handleQueue(song);
  }, [handleQueue]);

  const handleUnlikeRow = useCallback((songId: string) => {
    void handleUnlike(songId);
  }, [handleUnlike]);

  // ── auth guard ───────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <Heart className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold mb-2">Sign in to see your liked songs</h2>
        <p className="text-muted-foreground">Create an account to save your favourite music</p>
      </div>
    );
  }

  // ── render ───────────────────────────────────────────────────────────────
  return (
    <div className="bg-background text-foreground">

      {/* ── Mobile hero ─────────────────────────────────────────────────── */}
      <LikedSongsHero
        isMobile={isMobile}
        likedSongsCount={likedSongs.length}
        isPlaylistPlaying={isPlaylistPlaying}
        handleMainPlay={handleMainPlay}
        setSort={setSort}
        navigate={navigate}
      />

      {/* ── Search ──────────────────────────────────────────────────────── */}
      {likedSongs.length > 0 && (
        <div className={cn('pb-3', isMobile ? 'px-4' : 'px-8')}>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
            <Input
              placeholder="Search in liked songs"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/50
                         focus:bg-white/15 h-10 text-sm"
            />
          </div>
        </div>
      )}

      {/* ── Song list ───────────────────────────────────────────────────── */}
      <div className={cn(isMobile ? 'pb-36' : 'px-8 pb-8')}>
        {likedSongs.length > 0 ? (
          <>
            {/* Desktop column headers */}
            {!isMobile && (
              <div className="grid grid-cols-[16px_4fr_3fr_2fr_40px_1fr_48px] gap-4 px-4 py-2
                              text-xs text-muted-foreground border-b border-white/10 mb-1">
                <div>#</div>
                <div>Title</div>
                <div>Album</div>
                <div>Date added</div>
                <div />
                <div><Clock className="h-3.5 w-3.5" /></div>
                <div />
              </div>
            )}

            {visible.map((song, i) => (
              <SongRow
                key={song._id || `${song.title}-${song.artist}`}
                song={song}
                index={i}
                isMobile={isMobile}
                playing={isSongPlaying(song)}
                onPlay={handlePlayRow}
                onToggle={togglePlay}
                onQueue={handleQueueRow}
                onUnlike={handleUnlikeRow}
              />
            ))}

            {visible.length === 0 && query && (
              <div className="text-center py-12 text-muted-foreground">
                No songs match "{query}"
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <Heart className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No liked songs yet</h3>
            <p className="text-muted-foreground mb-6">Songs you like will appear here</p>
            <Button onClick={() => navigate('/liked-songs/import')}>
              <Upload className="h-4 w-4 mr-2" /> Import Tool
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LikedSongsPage;
