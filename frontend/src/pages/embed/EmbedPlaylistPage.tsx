import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildApiUrl } from '@/lib/apiConfig';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { usePlayerSync } from '@/hooks/usePlayerSync';

interface Song {
  _id: string;
  title: string;
  artist: string;
  duration: number;
  audioUrl: string;
  imageUrl: string;
}

interface Playlist {
  _id: string;
  name: string;
  description: string;
  imageUrl: string;
  songs: Song[];
  user: {
    clerkId: string;
    fullName: string;
  };
}

const formatTime = (seconds: number) => {
  if (!isFinite(seconds)) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const EmbedPlaylistPage = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const theme = searchParams.get('theme') || 'green';

  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSongIndex, setSelectedSongIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const lastNonZeroVolumeRef = useRef(100);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const volumeSliderRef = useRef<HTMLDivElement>(null);

  const {
    playAlbum,
    togglePlay,
    playNext,
    playPrevious,
    seekTo,
    setVolume,
  } = usePlayerStore();
  const { currentSong, isPlaying } = usePlayerSync();
  const currentTime = usePlayerStore((state) => state.currentTime);
  const duration = usePlayerStore((state) => state.duration);
  const volume = usePlayerStore((state) => state.volume);

  const bgColor = theme === 'dark' ? '#282828' : '#1DB954';
  const isMuted = volume <= 0;

  const activePlaylistSongIndex = useMemo(() => {
    if (!playlist || !currentSong) return -1;
    return playlist.songs.findIndex((song) => song._id === currentSong._id);
  }, [playlist, currentSong]);

  const isCurrentPlaylistActive = activePlaylistSongIndex >= 0;

  useEffect(() => {
    if (activePlaylistSongIndex >= 0) {
      setSelectedSongIndex(activePlaylistSongIndex);
    }
  }, [activePlaylistSongIndex]);

  useEffect(() => {
    const fetchPlaylist = async () => {
      try {
        const response = await fetch(buildApiUrl(`/playlists/${id}`), {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }

        const data = await response.json();
        setPlaylist(data);
      } catch {
        setPlaylist(null);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      void fetchPlaylist();
    }
  }, [id]);

  useEffect(() => {
    if (volume > 0) {
      lastNonZeroVolumeRef.current = volume;
    }
  }, [volume]);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };

    if (!isDragging) return;

    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging]);

  const selectedSong = playlist?.songs[selectedSongIndex] ?? null;
  const displaySong = isCurrentPlaylistActive ? currentSong : selectedSong;
  const displayCurrentTime = isCurrentPlaylistActive ? currentTime : 0;
  const displayDuration = isCurrentPlaylistActive ? duration : (selectedSong?.duration ?? 0);
  const progress = displayDuration > 0 ? (displayCurrentTime / displayDuration) * 100 : 0;

  const startPlaybackAtIndex = (index: number) => {
    if (!playlist || playlist.songs.length === 0) return;

    const nextIndex = Math.max(0, Math.min(index, playlist.songs.length - 1));
    setSelectedSongIndex(nextIndex);
    playAlbum(playlist.songs as any, nextIndex);
  };

  const handlePlayPause = () => {
    if (!playlist || playlist.songs.length === 0) return;

    if (isCurrentPlaylistActive) {
      togglePlay();
      return;
    }

    startPlaybackAtIndex(selectedSongIndex);
  };

  const handlePrevious = () => {
    if (!playlist || playlist.songs.length === 0) return;

    if (isCurrentPlaylistActive) {
      playPrevious();
      return;
    }

    setSelectedSongIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    if (!playlist || playlist.songs.length === 0) return;

    if (isCurrentPlaylistActive) {
      playNext();
      return;
    }

    setSelectedSongIndex((prev) => Math.min(playlist.songs.length - 1, prev + 1));
  };

  const handleSongClick = (index: number) => {
    startPlaybackAtIndex(index);
  };

  const handleProgressClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isCurrentPlaylistActive || !progressBarRef.current || displayDuration <= 0) return;

    const rect = progressBarRef.current.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const ratio = Math.max(0, Math.min(offsetX / rect.width, 1));
    seekTo(ratio * displayDuration);
  };

  const handleProgressMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    handleProgressClick(event);
  };

  const handleProgressMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    handleProgressClick(event);
  };

  const handleVolumeToggle = () => {
    if (isMuted) {
      setVolume(lastNonZeroVolumeRef.current || 100);
      return;
    }

    lastNonZeroVolumeRef.current = volume || 100;
    setVolume(0);
  };

  const handleVolumeChange = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!volumeSliderRef.current) return;

    const rect = volumeSliderRef.current.getBoundingClientRect();
    const y = event.clientY - rect.top;
    const ratio = Math.max(0, Math.min(1 - (y / rect.height), 1));
    const nextVolume = Math.round(ratio * 100);
    setVolume(nextVolume);
  };

  if (loading) {
    return (
      <div
        className="w-full h-full flex items-center justify-center"
        style={{ backgroundColor: bgColor }}
      >
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent" />
      </div>
    );
  }

  if (!playlist) {
    return (
      <div
        className="w-full h-full flex items-center justify-center"
        style={{ backgroundColor: bgColor }}
      >
        <p className="text-white text-lg">Playlist not found</p>
      </div>
    );
  }

  return (
    <div
      className="w-full h-screen overflow-hidden"
      style={{ backgroundColor: bgColor }}
    >
      <div className="h-full flex flex-col">
        <div className="p-4 flex items-start gap-4 flex-shrink-0">
          <img
            src={playlist.imageUrl}
            alt={playlist.name}
            className="w-20 h-20 rounded-lg shadow-lg object-cover"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-bold text-lg truncate">{playlist.name}</h3>
                <p className="text-white/70 text-sm truncate">
                  {playlist.description || `Made for ${playlist.user.fullName}`}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  <img
                    src="/mavrixfy.png"
                    alt="Mavrixfy"
                    className="w-4 h-4 rounded-sm"
                  />
                  <span className="text-white/70 text-xs">Saved on Mavrixfy</span>
                </div>
              </div>
              <img
                src="/mavrixfy.png"
                alt="Mavrixfy Logo"
                className="w-8 h-8 rounded-lg flex-shrink-0"
              />
            </div>
          </div>
        </div>

        <div className="px-4 pb-3 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <button
                onClick={handlePrevious}
                disabled={selectedSongIndex === 0 && !isCurrentPlaylistActive}
                className="text-white/70 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <SkipBack className="h-5 w-5" fill="currentColor" />
              </button>
              <button
                onClick={handlePlayPause}
                className="w-10 h-10 rounded-full bg-white flex items-center justify-center hover:scale-105 transition-transform shadow-lg"
              >
                {isCurrentPlaylistActive && isPlaying ? (
                  <Pause className="h-5 w-5 text-black" fill="currentColor" />
                ) : (
                  <Play className="h-5 w-5 text-black ml-0.5" fill="currentColor" />
                )}
              </button>
              <button
                onClick={handleNext}
                disabled={selectedSongIndex === playlist.songs.length - 1 && !isCurrentPlaylistActive}
                className="text-white/70 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <SkipForward className="h-5 w-5" fill="currentColor" />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-white/70 text-xs font-medium">
                {formatTime(displayCurrentTime)}
              </span>

              <div
                className="relative"
                onMouseEnter={() => setShowVolumeSlider(true)}
                onMouseLeave={() => setShowVolumeSlider(false)}
              >
                <button
                  onClick={handleVolumeToggle}
                  className="text-white/70 hover:text-white transition-colors"
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? (
                    <VolumeX className="h-5 w-5" />
                  ) : (
                    <Volume2 className="h-5 w-5" />
                  )}
                </button>

                {showVolumeSlider && (
                  <div className="absolute bottom-full right-0 mb-2 p-2 bg-black/90 rounded-lg shadow-lg">
                    <div
                      ref={volumeSliderRef}
                      className="relative w-8 h-24 bg-white/20 rounded-full cursor-pointer"
                      onClick={handleVolumeChange}
                    >
                      <div
                        className="absolute bottom-0 left-0 right-0 bg-white rounded-full transition-all"
                        style={{ height: `${volume}%` }}
                      />
                      <div
                        className="absolute left-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full shadow-lg"
                        style={{ bottom: `${volume}%`, marginBottom: '-6px' }}
                      />
                    </div>
                    <div className="text-white text-xs text-center mt-1">
                      {volume}%
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div
            ref={progressBarRef}
            className="relative h-1 bg-white/20 rounded-full overflow-visible cursor-pointer group"
            onClick={handleProgressClick}
            onMouseDown={handleProgressMouseDown}
            onMouseMove={handleProgressMouseMove}
            onMouseUp={() => setIsDragging(false)}
            onMouseLeave={() => setIsDragging(false)}
          >
            <div
              className="absolute left-0 top-0 h-full bg-white rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
            <div
              className={cn(
                'absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg transition-opacity',
                'group-hover:opacity-100',
                isDragging ? 'opacity-100 scale-125' : 'opacity-0',
              )}
              style={{ left: `${progress}%`, marginLeft: '-6px' }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 scrollbar-hide">
          {playlist.songs.map((song, index) => {
            const isActiveSong = currentSong?._id === song._id && isCurrentPlaylistActive;

            return (
              <div
                key={song._id}
                className={cn(
                  'flex items-center gap-3 py-2 px-2 rounded hover:bg-white/10 transition-colors cursor-pointer group',
                  isActiveSong && 'bg-white/10',
                )}
                onClick={() => handleSongClick(index)}
                title={song.audioUrl ? `Play: ${song.title}` : `No audio available for: ${song.title}`}
              >
                <span className="text-white/50 text-sm w-4 text-right">{index + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    'text-sm font-medium truncate',
                    song.audioUrl ? 'text-white' : 'text-white/30',
                  )}>
                    {song.title}
                    {!song.audioUrl && <span className="text-red-400 ml-2">(No audio)</span>}
                  </p>
                  <p className="text-white/60 text-xs truncate">{song.artist}</p>
                </div>
                <span className="text-white/50 text-xs">{formatTime(song.duration)}</span>
              </div>
            );
          })}
        </div>

        {displaySong && (
          <div className="px-4 pb-4 text-white/75 text-sm flex items-center justify-between">
            <span className="truncate pr-3">{displaySong.title}</span>
            <span>{formatTime(displayDuration)}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmbedPlaylistPage;
