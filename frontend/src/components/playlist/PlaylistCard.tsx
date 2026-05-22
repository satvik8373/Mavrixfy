import { useNavigate } from 'react-router-dom';
import { Playlist } from '../../types';
import { usePlayerStore } from '../../stores/usePlayerStore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Play } from 'lucide-react';
import { useMobileTapSimple } from '../../hooks/useMobileTapSimple';
import { getOptimizedArtworkUrl } from '@/services/cloudinaryService';

interface PlaylistCardProps {
  playlist: Playlist;
  showDescription?: boolean;
  className?: string;
  eagerLoad?: boolean;
}

export function PlaylistCard({
  playlist,
  showDescription = true,
  className,
  eagerLoad = false
}: PlaylistCardProps) {
  const navigate = useNavigate();
  const { setCurrentSong } = usePlayerStore();

  const handleCardClick = () => {
    if (playlist.songs.length === 0) {
      toast.error('This playlist has no songs');
      return;
    }
    navigate(`/playlist/${playlist._id}`);
  };

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (playlist.songs.length === 0) {
      toast.error('This playlist has no songs');
      return;
    }
    // Set first song in playlist but don't auto-play
    setCurrentSong(playlist.songs[0]);
    // setIsPlaying(true); // Removed unwanted autoplay
  };

  // Simple mobile tap behavior - single tap to open
  const { isMobile, handleTap, handleTouchStart } = useMobileTapSimple({
    onTap: handleCardClick,
  });
  const coverUrl = playlist.imageUrl
    ? getOptimizedArtworkUrl(playlist.imageUrl, {
        width: 192,
        height: 192,
        crop: 'fill',
      })
    : '/default-playlist.jpg';

  return (
    <div
      className={cn(
        "group relative w-full rounded-md p-1 md:p-2 transition-all duration-200 hover:bg-white/5 active:scale-95",
        className
      )}
    >
        <button
          type="button"
          className="absolute inset-0 w-full h-full cursor-pointer z-[1] opacity-0"
          onClick={!isMobile ? handleCardClick : undefined}
          onTouchStart={handleTouchStart}
          onTouchEnd={isMobile ? handleTap : undefined}
          aria-label={`Open playlist ${playlist.name}`}
        />
        <div className="relative">
          {/* Playlist Image - Consistent aspect ratio */}
          <div className="relative w-full aspect-square mb-2 md:mb-3">
            <div className="w-full h-full rounded-[4px] overflow-hidden shadow-lg">
              <img
                src={coverUrl}
                alt={playlist.name}
                className="w-full h-full object-cover rounded-[4px]"
                onError={e => ((e.target as HTMLImageElement).src = '/default-playlist.jpg')}
                loading={eagerLoad ? "eager" : "lazy"}
                ref={eagerLoad ? (el) => { if (el) (el as any).fetchPriority = 'high'; } : undefined}
              />
            </div>

            {/* Play Button - Desktop Only */}
            <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hidden md:block z-[2]">
              <button type="button"
                onClick={handlePlayClick}
                className="w-10 h-10 rounded-full bg-primary hover:bg-primary/90 hover:scale-105 flex items-center justify-center shadow-2xl transition-all duration-200"
                aria-label="Play playlist"
              >
                <Play className="w-4 h-4 ml-0.5 text-primary-foreground" fill="currentColor" stroke="none" />
              </button>
            </div>
          </div>

          {/* Playlist Info */}
          <div className="space-y-1 min-h-[62px] md:min-h-[70px]">
            <h3 className="text-foreground text-xs md:text-sm font-medium line-clamp-2 leading-tight">
              {playlist.name}
            </h3>

            {showDescription && (
              <p className="text-muted-foreground text-[10px] md:text-xs line-clamp-2">
                {playlist.songs?.length || 0} songs
                {playlist.description && ` • ${playlist.description}`}
              </p>
            )}
          </div>
        </div>
    </div>
  );
}
