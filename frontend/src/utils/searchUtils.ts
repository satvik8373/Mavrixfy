export const RECENT_SEARCHES_KEY = 'recent_searches:v1';

export const readRecentSearches = (): string[] => {
  const saved = localStorage.getItem(RECENT_SEARCHES_KEY);
  return saved ? JSON.parse(saved) : [];
};

export const saveRecentSearch = (query: string) => {
  if (!query.trim()) return;

  try {
    let searches = readRecentSearches();

    // Remove if already exists
    searches = searches.filter(s => s.toLowerCase() !== query.toLowerCase());

    // Add to beginning
    searches.unshift(query.trim());

    // Keep only last 10
    searches = searches.slice(0, 10);

    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches));
  } catch (error) {
    // Failed to save recent search
  }
};
