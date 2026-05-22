import React from 'react';

interface HomeSkeletonProps {
  className?: string;
  count?: number;
  type?: 'card' | 'list' | 'grid' | 'recently-played';
}

// Professional shimmer animation
const SHIMMER_CLASS = `
  relative overflow-hidden
  before:absolute before:inset-0
  before:-translate-x-full
  before:before-shimmer
  before:animate-[shimmer_2s_infinite]
  before:bg-gradient-to-r
  before:from-transparent before:via-white/10 before:to-transparent
`;

// Standalone component for recently played card skeleton
const RecentlyPlayedCard: React.FC = () => (
  <div className={`h-[48px] md:h-[44px] w-full rounded-[4px] overflow-hidden bg-white/10 ${SHIMMER_CLASS}`}>
    <div className="relative flex items-center h-full z-10">
      <div className="relative w-[48px] md:w-[44px] h-full flex-shrink-0">
        <div className="w-full h-full bg-white/5 rounded-[4px]" />
      </div>
      <div className="flex-1 min-w-0 pl-2.5 pr-2 py-1 flex items-center">
        <div className="h-3 bg-white/10 rounded w-3/4 animate-pulse" />
      </div>
    </div>
  </div>
);

// Standalone component for card skeleton (matches PlaylistCard and JioSaavnPlaylistCard)
const Card: React.FC = () => (
  <div className={`w-full rounded-md p-1 md:p-2 bg-transparent ${SHIMMER_CLASS}`}>
    <div className="relative w-full aspect-square mb-2 md:mb-3">
      <div className="w-full h-full rounded-[4px] bg-white/10 animate-pulse shadow-lg" />
    </div>
    {/* Playlist Info skeleton with matching heights to prevent CLS */}
    <div className="space-y-1 min-h-[62px] md:min-h-[70px]">
      <div className="space-y-1">
        <div className="h-3 bg-white/10 rounded animate-pulse w-5/6" />
        <div className="h-3 bg-white/10 rounded animate-pulse w-2/3" />
      </div>
      <div className="pt-1">
        <div className="h-2.5 bg-white/5 rounded animate-pulse w-1/2" />
      </div>
    </div>
  </div>
);

// Standalone component for list skeleton
const List: React.FC = () => (
  <div className={`flex items-center space-x-4 p-3 bg-white/5 rounded-lg backdrop-blur-sm ${SHIMMER_CLASS}`}>
    <div className="w-14 h-14 bg-white/10 rounded-lg flex-shrink-0" />
    <div className="flex-1 space-y-2">
      <div className="h-4 bg-white/10 rounded-full w-4/5" />
      <div className="h-3 bg-white/8 rounded-full w-3/5" />
      <div className="h-2 bg-white/6 rounded-full w-2/5" />
    </div>
  </div>
);

const HomeSkeleton: React.FC<HomeSkeletonProps> = ({
  className = '',
  count = 3,
  type = 'card'
}) => {
  // Grid skeleton
  if (type === 'grid') {
    return (
      <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 ${className}`}>
        {Array.from({ length: Math.min(count, 8) }).map((_, index) => (
          <div 
            key={index} 
            className={`bg-white/5 rounded-xl p-3 backdrop-blur-sm ${SHIMMER_CLASS}`}
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <div className="space-y-3">
              <div className="w-full aspect-square bg-white/10 rounded-lg" />
              <div className="h-2 bg-white/10 rounded-full w-4/5" />
              <div className="h-2 bg-white/8 rounded-full w-3/5" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Recently played grid (matches RecentlyPlayedCard grid layout gap)
  if (type === 'recently-played') {
    return (
      <div className={`grid grid-cols-2 lg:grid-cols-4 gap-[6px] ${className}`}>
        {Array.from({ length: Math.min(count, 4) }).map((_, index) => (
          <div 
            key={index}
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <RecentlyPlayedCard />
          </div>
        ))}
      </div>
    );
  }

  // Horizontal scroll cards (width must match active playlist item width to prevent horizontal/vertical shifting)
  if (type === 'card') {
    return (
      <div className={`flex space-x-4 overflow-hidden ${className}`}>
        {Array.from({ length: Math.min(count, 6) }).map((_, index) => (
          <div 
            key={index} 
            className="flex-shrink-0 w-[160px]"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <Card />
          </div>
        ))}
      </div>
    );
  }

  // List view
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: Math.min(count, 5) }).map((_, index) => (
        <div 
          key={index}
          style={{ animationDelay: `${index * 0.1}s` }}
        >
          <List />
        </div>
      ))}
    </div>
  );
};

export default HomeSkeleton;
