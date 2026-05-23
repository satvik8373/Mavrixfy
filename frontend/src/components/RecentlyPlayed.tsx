import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Music } from 'lucide-react';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { cn } from '@/lib/utils';

// We'll use localStorage to simulate backend-saved recently played items
interface RecentItem {
  id: string;
  title: string;
  imageUrl: string;
  type: 'song' | 'playlist' | 'album';
  date: number;
  data?: any; // Store any additional data needed when playing
}

const RECENTLY_PLAYED_KEY = 'recently_played:v1';

const readRecentlyPlayed = (): RecentItem[] => {
  const savedItems = localStorage.getItem(RECENTLY_PLAYED_KEY);
  return savedItems ? JSON.parse(savedItems) : [];
};

export function RecentlyPlayed() {
  const [recentItems, setRecentItems] = useState<RecentItem[]>(() => {
    try {
      const items = readRecentlyPlayed();
      items.sort((a, b) => b.date - a.date);
      return items.slice(0, 8);
    } catch {
      return [];
    }
  });
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const { setCurrentSong } = usePlayerStore();
  const navigate = useNavigate();

  useEffect(() => {
    const loadRecentItems = () => {
      try {
        const items = readRecentlyPlayed();
        if (items.length > 0) {
          items.sort((a, b) => b.date - a.date);
          setRecentItems(items.slice(0, 8));
        }
      } catch (error) {
        // Error loading recently played items
      }
    };

    // Listen for updates to recently played
    const handleRecentlyPlayedUpdated = () => loadRecentItems();
    window.addEventListener('recentlyPlayedUpdated', handleRecentlyPlayedUpdated);

    return () => {
      window.removeEventListener('recentlyPlayedUpdated', handleRecentlyPlayedUpdated);
    };
  }, []);

  // Add an item to recently played
  const addToRecentlyPlayed = (item: RecentItem) => {
    try {
      let items = readRecentlyPlayed();

      // Remove if already exists to prevent duplicates
      items = items.filter(i => i.id !== item.id);

      // Add to the beginning
      items.unshift({
        ...item,
        date: Date.now(),
      });

      // Keep only the most recent 20 items
      if (items.length > 20) {
        items = items.slice(0, 20);
      }

      localStorage.setItem(RECENTLY_PLAYED_KEY, JSON.stringify(items));
      window.dispatchEvent(new Event('recentlyPlayedUpdated'));
    } catch (error) {
      // Error adding to recently played
    }
  };

  const handleItemClick = (item: RecentItem) => {
    if (item.type === 'song' && item.data) {
      setCurrentSong(item.data);
      // Don't auto-play - let user decide when to play
      // setIsPlaying(true); // Removed unwanted autoplay
      addToRecentlyPlayed(item);
    } else if (item.type === 'playlist' && item.id) {
      navigate(`/playlist/${item.id}`);
    } else if (item.type === 'album' && item.id) {
      navigate(`/albums/${item.id}`);
    }
  };

  if (recentItems.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-semibold">Recently played</h2>
        {recentItems.length > 0 && (
          <button type="button"
            onClick={() => navigate('/history')}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            See all
          </button>
        )}
      </div>

      {/* Rectangular cards matching Mavrixfy design - thumbnail on left, text on right */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-1.5">
        {recentItems.map(item => (
          <div
            key={item.id}
            className="group relative h-[64px] rounded overflow-hidden transition-all duration-300 border border-border/60 hover:border-border/80"
            onMouseEnter={() => setHoveredItemId(item.id)}
            onMouseLeave={() => setHoveredItemId(null)}
          >
            <button
              type="button"
              className="absolute inset-0 w-full h-full cursor-pointer z-[1] opacity-0"
              onClick={() => handleItemClick(item)}
              aria-label={`Play ${item.title}`}
            />
            <div className="absolute inset-0 bg-muted/95 dark:bg-[#292929] scale-110 group-hover:scale-100 transition-transform duration-300" />
            <div className="relative flex items-center h-full">
              {/* Square thumbnail on the left */}
              <div className="w-[64px] h-full flex-shrink-0 rounded overflow-hidden">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                    loading="lazy"
                    onError={e => {
                      (e.target as HTMLImageElement).src =
                        'https://placehold.co/400x400/1f1f1f/959595?text=No+Image';
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-purple-600 to-purple-900 flex items-center justify-center">
                    <Music className="h-6 w-6 text-white/70" />
                  </div>
                )}
              </div>
              {/* Text on the right */}
              <div className="flex-1 min-w-0 px-2.5">
                <h3 className="font-medium text-sm leading-snug line-clamp-2 text-foreground group-hover:text-white transition-colors">
                  {item.title}
                </h3>
              </div>
              {/* Play button appears on hover */}
              <button type="button"
                className={cn(
                  'absolute right-2 p-2 bg-green-500 hover:bg-green-400 text-black rounded-full shadow-lg z-10 transition-all duration-200 ease-out',
                  hoveredItemId === item.id
                    ? 'opacity-100 translate-y-0 scale-100'
                    : 'opacity-0 translate-y-2 scale-90'
                )}
                onClick={e => {
                  e.stopPropagation();
                  handleItemClick(item);
                }}
              >
                <Play className="h-3.5 w-3.5 text-black fill-black" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


