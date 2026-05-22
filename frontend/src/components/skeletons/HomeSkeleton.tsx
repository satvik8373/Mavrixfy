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
  before:animate-[shimmer_2s_infinite]
  before:bg-gradient-to-r
  before:from-transparent before:via-white/10 before:to-transparent
`;

// Standalone component for recently played card skeleton
const RecentlyPlayedCard: React.FC = () => (
  <div className={`bg-white/5 rounded-lg p-3 backdrop-blur-sm ${SHIMMER_CLASS}`}>
    <div className="flex items-center gap-x-3">
      <div className="w-12 h-12 bg-white/10 rounded-lg flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-white/10 rounded-full w-3/4" />
        <div className="h-2 bg-white/8 rounded-full w-1/2" />
      </div>
    </div>
  </div>
);

// Standalone component for card skeleton
const Card: React.FC = () => (
  <div className={`bg-white/5 rounded-xl p-4 backdrop-blur-sm ${SHIMMER_CLASS}`}>
    <div className="space-y-3">
      <div className="w-full aspect-square bg-white/10 rounded-lg" />
      <div className="space-y-2">
        <div className="h-3 bg-white/10 rounded-full w-4/5" />
        <div className="h-2 bg-white/8 rounded-full w-3/5" />
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

  // Recently played grid
  if (type === 'recently-played') {
    return (
      <div className={`grid grid-cols-2 lg:grid-cols-4 gap-2 ${className}`}>
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

  // Horizontal scroll cards
  if (type === 'card') {
    return (
      <div className={`flex space-x-4 overflow-hidden ${className}`}>
        {Array.from({ length: Math.min(count, 6) }).map((_, index) => (
          <div 
            key={index} 
            className="flex-shrink-0 w-32"
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
