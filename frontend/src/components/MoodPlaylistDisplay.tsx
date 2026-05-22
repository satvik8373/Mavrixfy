import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Heart, Share2, Music, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Song } from '@/types';

interface MoodPlaylist {
  _id: string;
  name: string;
  emotion: 'sadness' | 'joy' | 'anger' | 'love' | 'fear' | 'surprise';
  songs: Song[];
  songCount: number;
  generatedAt: string;
  cached?: boolean;
}

interface MoodPlaylistDisplayProps {
  playlist: MoodPlaylist;
  onPlay: (index?: number) => void;
  onSave: () => void;
  onShare: () => void;
  onTryAgain: () => void;
  className?: string;
}

const emotionThemes = {
  sadness: { badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  joy: { badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  anger: { badge: 'bg-red-500/20 text-red-400 border-red-500/30' },
  love: { badge: 'bg-pink-500/20 text-pink-400 border-pink-500/30' },
  fear: { badge: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  surprise: { badge: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
};

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const MoodPlaylistDisplay: React.FC<MoodPlaylistDisplayProps> = ({
  playlist,
  onPlay,
  onSave,
  onShare,
  onTryAgain,
  className,
}) => {
  const emotion = playlist.emotion && emotionThemes[playlist.emotion] ? playlist.emotion : 'joy';
  const theme = emotionThemes[emotion];

  return (
    <div
      className="mood-display-height relative w-full max-w-3xl mx-auto px-4 sm:px-6 flex flex-col"
      style={{
        paddingTop: '2.5rem',
        paddingBottom: '1rem',
      }}
    >

      {/* History Button — fixed at top-right of viewport */}
      <div className="fixed top-4 right-4 z-50">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('navigate-mood-history'))}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/8 border border-white/15 text-white/70 text-xs font-semibold backdrop-blur-md hover:bg-purple-500/25 hover:text-white hover:border-purple-500/30 transition-all duration-200 shadow-lg"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>View History</span>
        </button>
      </div>

      {/* Card — fills the remaining height of the wrapper */}
      <Card className={cn("w-full flex flex-col flex-1 min-h-0 bg-[#0a0a0a]/80 backdrop-blur-3xl border border-white/5 shadow-2xl rounded-2xl sm:rounded-3xl", className)}>


        {/* Header */}
        <CardHeader className="p-4 sm:p-5 pb-3 border-b border-white/5">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            {/* Title + badge */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-base sm:text-lg font-black text-white truncate">
                {playlist.name}
              </span>
              <Badge className={cn("px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-bold border uppercase shrink-0", theme.badge)}>
                {emotion}
              </Badge>
            </div>
            {/* Save + Share */}
            <div className="flex items-center gap-2 shrink-0">
              <Button onClick={onSave} size="icon" className="rounded-full w-8 h-8 sm:w-9 sm:h-9 bg-white/5 hover:bg-white/10 border border-white/10 text-pink-400" title="Save">
                <Heart className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </Button>
              <Button onClick={onShare} size="icon" className="rounded-full w-8 h-8 sm:w-9 sm:h-9 bg-white/5 hover:bg-white/10 border border-white/10 text-indigo-400" title="Share">
                <Share2 className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </Button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button onClick={() => onPlay(0)} className="flex-1 h-9 sm:h-10 px-4 rounded-xl bg-gradient-to-r from-green-500 to-emerald-400 hover:from-green-400 hover:to-emerald-300 text-black font-extrabold text-xs sm:text-sm">
              <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2 fill-black" />
              Play All ({playlist.songCount})
            </Button>
            <Button onClick={onTryAgain} variant="outline" className="flex-1 h-9 sm:h-10 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/20 text-white font-bold text-xs sm:text-sm">
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2 text-blue-400" />
              New Mood
            </Button>
          </div>
        </CardHeader>

        {/* Song List — flex-1, fills ALL remaining card height */}
        <CardContent className="p-0 bg-black/20 rounded-b-2xl sm:rounded-b-3xl flex-1 min-h-0 flex flex-col">
          <div
            className="px-3 sm:px-4 py-2 overflow-y-auto scrollbar-hide flex-1 min-h-0"
          >
            {playlist.songs.map((song, index) => (
              <div
                role="button"
                tabIndex={0}
                onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.click(); } }}
                key={song._id || `song-${index}`}
                onClick={() => onPlay(index)}
                className="flex items-center gap-3 p-2 hover:bg-white/10 cursor-pointer group rounded-xl border-b border-white/5 last:border-0 transition-colors"
              >
                <span className="w-5 text-center text-xs text-white/40 font-bold group-hover:text-green-400 shrink-0">
                  {index + 1}
                </span>
                <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-lg overflow-hidden bg-white/5 flex-shrink-0">
                  {song.imageUrl ? (
                    <img src={song.imageUrl} alt={song.title} className="w-full h-full object-cover" loading={index < 5 ? "eager" : "lazy"} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Music className="w-4 h-4 text-white/30" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 pr-2">
                  <div className="font-bold text-xs sm:text-sm text-white truncate group-hover:text-green-400">
                    {song.title}
                  </div>
                  <div className="text-[10px] sm:text-xs text-white/50 truncate font-medium">
                    {song.artist}
                  </div>
                </div>
                <span className="text-[10px] sm:text-xs text-white/40 font-semibold tabular-nums group-hover:text-white/80 shrink-0">
                  {formatDuration(song.duration)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
