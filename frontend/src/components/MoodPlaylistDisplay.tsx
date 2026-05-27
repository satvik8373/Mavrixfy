import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Heart, Share2, Music, Sparkles, History, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Song } from '@/types';

interface MoodPlaylist {
  _id: string;
  name: string;
  emotion: string;
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
type EmotionThemeKey = keyof typeof emotionThemes;

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
  const emotion = playlist.emotion || 'mood';
  const themeKey = emotionThemes[emotion as EmotionThemeKey] ? emotion as EmotionThemeKey : 'joy';
  const theme = emotionThemes[themeKey];

  return (
    <div
      className="mood-display-height relative w-full max-w-5xl mx-auto px-4 sm:px-6 flex flex-col"
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
          className="inline-flex h-9 items-center gap-2 rounded-full border border-white/10 bg-black/45 px-3 text-xs font-semibold text-white/75 shadow-lg backdrop-blur-xl transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
          aria-label="View mood history"
        >
          <History className="h-4 w-4" />
          <span>History</span>
        </button>
      </div>

      <Card className={cn("w-full flex flex-col flex-1 min-h-0 bg-[#101014]/90 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-[28px]", className)}>
        <CardHeader className="p-4 sm:p-5 pb-4 border-b border-white/10">
          <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300 sm:flex">
                <Radio className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <span className="block truncate text-xl font-semibold tracking-tight text-white sm:text-2xl">
                {playlist.name}
                </span>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge className={cn("px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold border uppercase shrink-0", theme.badge)}>
                    {emotion}
                  </Badge>
                  <span className="text-xs font-medium text-white/45">{playlist.songCount} Gemini-picked songs</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button onClick={onSave} size="icon" className="rounded-full w-9 h-9 bg-white/[0.04] hover:bg-white/10 border border-white/10 text-pink-300" title="Save">
                <Heart className="w-4 h-4" />
              </Button>
              <Button onClick={onShare} size="icon" className="rounded-full w-9 h-9 bg-white/[0.04] hover:bg-white/10 border border-white/10 text-indigo-300" title="Share">
                <Share2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => onPlay(0)} className="flex-1 h-11 px-4 rounded-full bg-emerald-400 hover:bg-emerald-300 text-black font-extrabold text-sm">
              <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2 fill-black" />
              Play All ({playlist.songCount})
            </Button>
            <Button onClick={onTryAgain} variant="outline" className="flex-1 h-11 px-4 rounded-full bg-white/[0.04] hover:bg-white/10 border border-white/10 text-white font-bold text-sm">
              <Sparkles className="w-4 h-4 mr-2 text-emerald-300" />
              New Mood
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0 bg-black/20 rounded-b-[28px] flex-1 min-h-0 flex flex-col">
          <div
            className="px-3 sm:px-4 py-2 overflow-y-auto scrollbar-hide flex-1 min-h-0"
          >
            {playlist.songs.map((song, index) => (
              <button
                type="button"
                key={song._id || `song-${index}`}
                onClick={() => onPlay(index)}
                className="flex w-full items-center gap-3 p-2.5 text-left hover:bg-white/[0.07] cursor-pointer group rounded-2xl border-b border-white/5 last:border-0 transition-colors"
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
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
