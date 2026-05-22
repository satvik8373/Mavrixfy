import { Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAlbumColors } from '@/hooks/useAlbumColors';
import { useMobileTapSimple } from '@/hooks/useMobileTapSimple';
import { getOptimizedArtworkUrl } from '@/services/cloudinaryService';

interface RecentlyPlayedCardProps {
  id: string;
  title: string;
  imageUrl?: string;
  subtitle?: string;
  type?: 'playlist' | 'album' | 'song';
  onClick?: () => void;
  onPlay?: () => void;
  onHoverChange?: (gradient: string | null) => void;
}

export function RecentlyPlayedCard({
  id,
  title,
  imageUrl,
  // subtitle, // Unused in this compact design
  // type = 'playlist', // Unused in this compact design
  onClick,
  onPlay,
  onHoverChange,
}: RecentlyPlayedCardProps) {
  // Extract colors from the image - special processing for Liked Songs
  const colors = useAlbumColors(imageUrl, id === 'liked-songs');
  const optimizedImageUrl = getOptimizedArtworkUrl(imageUrl, {
    width: 96,
    height: 96,
    crop: 'fill',
  });

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPlay?.();
  };

  const handleCardClick = () => {
    onClick?.();
  };

  // Simple mobile tap behavior - single tap to open
  const { isMobile, handleTap, handleTouchStart } = useMobileTapSimple({
    onTap: handleCardClick,
  });

  // Simple background - no gradient, no glow

  return (
    <div
      className={cn(
        'group relative h-[48px] md:h-[44px] w-full rounded-[4px] overflow-hidden transition-all duration-300 ease-in-out',
        'recently-played-card bg-white/10 hover:bg-white/20'
      )}
      onMouseEnter={() => {
        if (colors?.primary) {
          onHoverChange?.(colors.primary);
        }
      }}
      onMouseLeave={() => onHoverChange?.(null)}
    >
      <button
        type="button"
        className="absolute inset-0 w-full h-full cursor-pointer z-[1] opacity-0"
        onClick={!isMobile ? handleCardClick : undefined}
        onTouchStart={handleTouchStart}
        onTouchEnd={isMobile ? handleTap : undefined}
        aria-label={`Open ${title}`}
      />

      {/* Content */}
      <div className="relative flex items-center h-full z-10">
        {/* Image */}
        <div className="relative w-[48px] md:w-[44px] h-full flex-shrink-0">
          <div className="relative w-full h-full rounded-[4px] overflow-hidden shadow-md">
            {optimizedImageUrl ? (
              <img
                src={optimizedImageUrl}
                alt={title}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://placehold.co/400x400/1f1f1f/959595?text=No+Image';
                }}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-purple-600 to-purple-900 flex items-center justify-center">
                <span className="text-white text-[10px] font-bold">M</span>
              </div>
            )}
          </div>
        </div>

        {/* Text content */}
        <div className="flex-1 min-w-0 pl-2.5 pr-2 py-1 flex items-center">
          <h3
            className={cn(
              'font-bold text-[11px] md:text-[12.5px] leading-[1.2] line-clamp-2 transition-colors duration-300',
              'text-white'
            )}
            title={title}
          >
            {title}
          </h3>
        </div>

        {/* Action buttons */}
        <div className="hidden md:flex items-center pr-2">
          {/* Play button */}
          <button type="button"
            className={cn(
              'w-7 h-7 flex items-center justify-center rounded-full',
              'bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-105',
              'shadow-[0_4px_12px_rgba(0,0,0,0.5)]',
              'transition-all duration-300 ease-out z-20',
              'opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0'
            )}
            onClick={handlePlayClick}
            aria-label="Play"
          >
            <Play className="h-3.5 w-3.5 ml-0.5 text-black fill-black" />
          </button>
        </div>
      </div>

    </div>
  );
}
