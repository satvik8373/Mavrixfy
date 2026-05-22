import { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { m } from 'framer-motion';

interface Song {
  id: string;
  title: string;
  artist: string;
  duration: number;
}

interface EmbedPreviewProps {
  playlistId: string;
  playlistTitle: string;
  playlistSubtitle: string;
  playlistCover: string;
  songs: Song[];
  colorTheme: 'green' | 'dark';
  height: string;
}

const EmbedPreview = ({
  playlistTitle,
  playlistSubtitle,
  playlistCover,
  songs,
  colorTheme,
  height,
}: EmbedPreviewProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const bgColor = colorTheme === 'green' ? '#1DB954' : '#282828';
  const currentSong = songs[currentSongIndex];
  const duration = currentSong?.duration || 180;

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= duration) {
            handleNext();
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, duration]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handlePrevious = () => {
    if (currentSongIndex > 0) {
      setCurrentSongIndex((index) => index - 1);
      setCurrentTime(0);
    }
  };

  const handleNext = () => {
    if (currentSongIndex < songs.length - 1) {
      setCurrentSongIndex((index) => index + 1);
      setCurrentTime(0);
    } else {
      setIsPlaying(false);
      setCurrentTime(0);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = (currentTime / duration) * 100;

  return (
    <div
      className="rounded-xl overflow-hidden shadow-2xl"
      style={{
        height: `${height}px`,
        backgroundColor: bgColor,
      }}
    >
      <div className="h-full flex flex-col">
        {/* Header Section */}
        <div className="p-4 flex items-start gap-4">
          <img
            src={playlistCover}
            alt={playlistTitle}
            className="w-20 h-20 rounded-lg shadow-lg object-cover"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-semibold text-lg truncate">{playlistTitle}</h3>
                <p className="text-white/70 text-sm truncate">{playlistSubtitle}</p>
                <div className="flex items-center gap-1 mt-1">
                  <svg
                    className="w-4 h-4 text-white/70"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                  >
                    <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8z" />
                    <path d="M11.75 8a.75.75 0 0 1-.75.75H8.75V11a.75.75 0 0 1-1.5 0V8.75H5a.75.75 0 0 1 0-1.5h2.25V5a.75.75 0 0 1 1.5 0v2.25H11a.75.75 0 0 1 .75.75z" />
                  </svg>
                  <span className="text-white/70 text-xs">Saved on Mavrixfy</span>
                </div>
              </div>
              <svg
                className="w-6 h-6 text-white flex-shrink-0"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 1a11 11 0 1 0 0 22 11 11 0 0 0 0-22zm0 20a9 9 0 1 1 0-18 9 9 0 0 1 0 18z" />
                <path d="M12 6.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zm0 9a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Player Controls */}
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <button type="button"
                onClick={handlePrevious}
                disabled={currentSongIndex === 0}
                className="text-white/70 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <SkipBack className="h-5 w-5" fill="currentColor" />
              </button>
              <button type="button"
                onClick={handlePlayPause}
                className="w-10 h-10 rounded-full bg-white flex items-center justify-center hover:scale-105 transition-transform shadow-lg"
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5 text-black" fill="currentColor" />
                ) : (
                  <Play className="h-5 w-5 text-black ml-0.5" fill="currentColor" />
                )}
              </button>
              <button type="button"
                onClick={handleNext}
                disabled={currentSongIndex === songs.length - 1}
                className="text-white/70 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <SkipForward className="h-5 w-5" fill="currentColor" />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-white/70 text-xs font-medium">{formatTime(currentTime)}</span>
              <button type="button" className="text-white/70 hover:text-white transition-colors">
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="relative h-1 bg-white/20 rounded-full overflow-hidden">
            <m.div
              className="absolute left-0 top-0 h-full bg-white rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
        </div>

        {/* Song List */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 scrollbar-hide">
          {songs.map((song, index) => (
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.click(); } }}
              key={song.id}
              className={cn(
                'flex items-center gap-3 p-2 rounded hover:bg-white/10 transition-colors cursor-pointer group',
                index === currentSongIndex && 'bg-white/10'
              )}
              onClick={() => {
                setCurrentSongIndex(index);
                setCurrentTime(0);
                setIsPlaying(true);
              }}
            >
              <span className="text-white/50 text-sm w-4 text-right">{index + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{song.title}</p>
                <p className="text-white/60 text-xs truncate">{song.artist}</p>
              </div>
              <span className="text-white/50 text-xs">{formatTime(song.duration)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EmbedPreview;
