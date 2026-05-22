import { PlaylistCard } from './PlaylistCard';
import { SwipeCard } from './SwipeCard';
import { Playlist } from '../../types';
import { cn } from '@/lib/utils';

interface PlaylistSectionProps {
  title: string;
  playlists: Playlist[];
  showSeeAll?: boolean;
  onSeeAllClick?: () => void;
  className?: string;
  limit?: number;
  enableSwipe?: boolean;
}

export function PlaylistSection({
  title,
  playlists,
  showSeeAll = true,
  onSeeAllClick,
  className,
  limit = 6,
  enableSwipe = false
}: PlaylistSectionProps) {
  const displayedPlaylists = playlists.slice(0, limit);

  if (displayedPlaylists.length === 0) {
    return null;
  }

  const handleSwipeLeft = (playlist: Playlist) => {
    // Handle swipe left action
    // Add your swipe left logic here
  };

  const handleSwipeRight = (playlist: Playlist) => {
    // Add your swipe right logic here
  };

  return (
    <section className={cn("mb-12", className)}>
      {/* Section Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-white text-2xl md:text-[30px] font-semibold tracking-tight leading-none">
          {title}
        </h2>
        {showSeeAll && onSeeAllClick && (
          <button type="button"
            onClick={onSeeAllClick}
            className="text-[#adadad] text-sm md:text-base font-bold tracking-wider uppercase hover:underline transition-all"
          >
            SEE ALL
          </button>
        )}
      </div>

      {/* Playlist Grid - Mavrixfy style */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-0">
        {displayedPlaylists.map((playlist) => (
          enableSwipe ? (
            <SwipeCard
              key={playlist._id}
              onSwipeLeft={() => handleSwipeLeft(playlist)}
              onSwipeRight={() => handleSwipeRight(playlist)}
            >
              <PlaylistCard
                playlist={playlist}
                showDescription={true}
              />
            </SwipeCard>
          ) : (
            <PlaylistCard
              key={playlist._id}
              playlist={playlist}
              showDescription={true}
            />
          )
        ))}
      </div>
    </section>
  );
}

