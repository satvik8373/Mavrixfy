import { Clock, TrendingUp, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { readRecentSearches } from '@/utils/searchUtils';

interface SearchSuggestionsProps {
  onSelect?: (query: string) => void;
  currentQuery?: string;
  // Backward compatibility props
  query?: string;
  isVisible?: boolean;
  onSelectSong?: (query: string) => void;
  onSelectPlaylist?: (id: string) => void;
}



export const SearchSuggestions = ({
  onSelect,
  currentQuery,
  query,
  isVisible,
  onSelectSong
}: SearchSuggestionsProps) => {
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      return readRecentSearches().slice(0, 5); // Keep only last 5
    } catch {
      return [];
    }
  });
  const [trendingSearches] = useState<string[]>([
    'Arijit Singh',
    'Bollywood Hits',
    'Romantic Songs',
    'Party Songs',
    'Punjabi Music',
    'AR Rahman',
    'Atif Aslam',
    'Shreya Ghoshal'
  ]);

  // Support both prop names for backward compatibility
  const searchQuery = currentQuery ?? query ?? '';
  const handleSelect = onSelect ?? onSelectSong ?? (() => { });

  // If isVisible prop is provided and false, don't render
  // This must be after all hooks to follow the Rules of Hooks
  if (isVisible === false) {
    return null;
  }

  // Filter suggestions based on current query
  const filteredSuggestions = searchQuery.trim()
    ? trendingSearches.filter(s =>
      s.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 5)
    : [];

  const showRecentSearches = !searchQuery.trim() && recentSearches.length > 0;
  const showTrendingSearches = !searchQuery.trim() && recentSearches.length === 0;
  const showFilteredSuggestions = searchQuery.trim() && filteredSuggestions.length > 0;

  if (!showRecentSearches && !showTrendingSearches && !showFilteredSuggestions) {
    return null;
  }

  return (
    <div className="bg-[#242424] rounded-lg p-4 mb-6">
      {/* Recent Searches */}
      {showRecentSearches && (
        <div>
          <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
            <Clock size={16} />
            Recent Searches
          </h3>
          <div className="space-y-2">
            {recentSearches.map((search) => (
              <button type="button"
                key={search}
                onClick={() => handleSelect(search)}
                className="w-full text-left px-3 py-2 rounded-md hover:bg-[#282828] transition-colors flex items-center gap-3 group"
              >
                <Search size={16} className="text-gray-400" />
                <span className="text-white">{search}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Trending Searches */}
      {showTrendingSearches && (
        <div>
          <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
            <TrendingUp size={16} />
            Trending Searches
          </h3>
          <div className="flex flex-wrap gap-2">
            {trendingSearches.slice(0, 8).map((search) => (
              <button type="button"
                key={search}
                onClick={() => handleSelect(search)}
                className="px-4 py-2 bg-[#282828] hover:bg-[#3e3e3e] rounded-full text-sm transition-colors"
              >
                {search}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filtered Suggestions */}
      {showFilteredSuggestions && (
        <div>
          <h3 className="text-sm font-semibold text-gray-400 mb-3">
            Suggestions
          </h3>
          <div className="space-y-2">
            {filteredSuggestions.map((search) => (
              <button type="button"
                key={search}
                onClick={() => handleSelect(search)}
                className="w-full text-left px-3 py-2 rounded-md hover:bg-[#282828] transition-colors flex items-center gap-3"
              >
                <Search size={16} className="text-gray-400" />
                <span className="text-white">{search}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};



// Default export for backward compatibility
export default SearchSuggestions;

