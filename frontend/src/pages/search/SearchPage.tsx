import { useEffect, useState, useCallback, useRef, useReducer } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { usePlayerStore } from '@/stores/usePlayerStore';
import {
  Play, Search, XCircle, Sparkles, Music, Zap,
  Smile, Frown, Angry, Heart, CloudRain, Skull,
  Sunset, Flower, Flame, PartyPopper, Waves, HeartCrack,
  Moon, Star, Coffee, BookOpen, Dumbbell, Film, Music2, Mountain, SearchX
} from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { SearchSkeleton } from '@/components/SearchSkeleton';
import { SearchSuggestions } from '@/components/SearchSuggestions';
import { saveRecentSearch } from '@/utils/searchUtils';
import { runSmartSearch, SmartSearchResult, SmartSearchSong } from '@/services/smartSearchService';
import { trackRecommendationEvent } from '@/services/recommendationService';
import { cn } from '@/lib/utils';

const formatDuration = (seconds: number) => {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const EMOTION_ICONS: Record<string, any> = {
  joy: Smile, sadness: Frown, anger: Angry, love: Heart, fear: Skull,
  surprise: Star, calm: CloudRain, nostalgic: Sunset, romantic: Flower,
  motivated: Flame, energetic: Zap, party: PartyPopper, chill: Waves,
  lonely: Moon, heartbreak: HeartCrack, dreamy: Sparkles, sleepy: Coffee,
  focused: BookOpen, workout: Dumbbell, filmy: Film, sufi: Music2,
  devotional: Heart, desi: Zap, melancholy: Waves, dark: Mountain
};

interface SongRowProps {
  allSongs: SmartSearchSong[];
  index: number;
  onPlay: (song: SmartSearchSong, allSongs: SmartSearchSong[]) => void;
  song: SmartSearchSong;
}

interface SearchUiState {
  showSuggestions: boolean;
  isSearching: boolean;
  smartResult: SmartSearchResult | null;
}

type SearchUiAction =
  | { type: 'empty_query' }
  | { type: 'search_started' }
  | { type: 'search_succeeded'; result: SmartSearchResult }
  | { type: 'search_finished' }
  | { type: 'suggestions'; visible: boolean }
  | { type: 'clear' };

const searchUiReducer = (state: SearchUiState, action: SearchUiAction): SearchUiState => {
  switch (action.type) {
    case 'empty_query':
      return { ...state, smartResult: null };
    case 'search_started':
      return { ...state, isSearching: true, showSuggestions: false };
    case 'search_succeeded':
      return { ...state, smartResult: action.result };
    case 'search_finished':
      return { ...state, isSearching: false };
    case 'suggestions':
      return { ...state, showSuggestions: action.visible };
    case 'clear':
      return { ...state, showSuggestions: false, smartResult: null };
    default:
      return state;
  }
};

const SongRow = ({ song, index, allSongs, onPlay }: SongRowProps) => (
  <button
    type="button"
    onClick={() => onPlay(song, allSongs)}
    className="flex w-full items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-all cursor-pointer group text-left"
  >
    <span className="w-6 text-center text-xs text-white/30 group-hover:hidden font-mono">{index + 1}</span>
    <div className="w-6 h-6 hidden group-hover:flex items-center justify-center">
      <Play className="w-3.5 h-3.5 text-green-400 fill-green-400" />
    </div>
    <div className="w-10 h-10 rounded-md overflow-hidden bg-white/5 flex-shrink-0">
      {song.imageUrl
        ? <img src={song.imageUrl} alt={song.title} className="w-full h-full object-cover" loading={index < 5 ? "eager" : "lazy"} ref={index < 5 ? (el) => { if (el) (el as any).fetchPriority = 'high'; } : undefined} />
        : <div className="w-full h-full flex items-center justify-center"><Music className="w-4 h-4 text-white/20" /></div>
      }
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-semibold text-sm text-white truncate group-hover:text-green-400 transition-colors">{song.title}</p>
      <p className="text-xs text-white/40 truncate">{song.artist}</p>
    </div>
    <span className="text-xs text-white/30 tabular-nums flex-shrink-0">{formatDuration(song.duration)}</span>
  </button>
);

const SearchPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const query = searchParams.get('q') || '';
  const [{ showSuggestions, isSearching, smartResult }, dispatchSearchUi] = useReducer(searchUiReducer, {
    showSuggestions: false,
    isSearching: false,
    smartResult: null,
  });
  const hasSearched = useRef(false);
  const { playAlbum, setIsPlaying, setUserInteracted } = usePlayerStore();

  const convertSong = (s: SmartSearchSong) => ({
    _id: s.id,
    title: s.title,
    artist: s.artist,
    album: s.album,
    imageUrl: s.imageUrl,
    audioUrl: s.audioUrl,
    duration: s.duration,
    albumId: null,
    year: s.year || new Date().getFullYear(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  // Perform smart search on query change
  useEffect(() => {
    if (!query?.trim()) {
      hasSearched.current = false;
      dispatchSearchUi({ type: 'empty_query' });
      return;
    }

    hasSearched.current = true;
    dispatchSearchUi({ type: 'search_started' });

    runSmartSearch(query.trim())
      .then((result) => {
        dispatchSearchUi({ type: 'search_succeeded', result });
        saveRecentSearch(query.trim());
        void trackRecommendationEvent({
          eventType: 'search_query',
          query: query.trim(),
          context: { surface: 'search' },
        });
      })
      .catch((err) => {
        console.error('Smart search failed:', err);
        toast.error('Search failed, please try again.');
      })
      .finally(() => dispatchSearchUi({ type: 'search_finished' }));
  }, [query]);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      dispatchSearchUi({ type: 'suggestions', visible: false });
    }
  }, [searchQuery, navigate]);

  const handleSuggestionSelect = useCallback((s: string) => {
    setSearchQuery(s);
    navigate(`/search?q=${encodeURIComponent(s)}`);
    dispatchSearchUi({ type: 'suggestions', visible: false });
  }, [navigate]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    navigate('/search');
    dispatchSearchUi({ type: 'clear' });
  }, [navigate]);

  // Play a song from smart results
  const playSong = useCallback((song: SmartSearchSong, allSongs: SmartSearchSong[]) => {
    if (!song.audioUrl) { toast.error('Song not available'); return; }
    setUserInteracted?.();
    const converted = allSongs.flatMap(s => {
      const convertedSong = convertSong(s);
      return convertedSong.audioUrl ? [convertedSong] : [];
    });
    const idx = converted.findIndex(s => s._id === song.id);
    playAlbum(converted, idx >= 0 ? idx : 0);
    setIsPlaying(true);
    toast.success(`Now playing: ${song.title}`);
  }, [playAlbum, setIsPlaying]);

  const playTopResult = useCallback(() => {
    if (!smartResult?.topResult) return;
    const allSongs = [
      smartResult.topResult,
      ...smartResult.results,
      ...smartResult.similarSongs
    ].filter(s => s.audioUrl);
    playSong(smartResult.topResult, allSongs);
  }, [smartResult, playSong]);

  // Redirect to mood page with pre-filled prompt
  const openVibeMode = useCallback((mood: string) => {
    navigate(`/mood?preset=${encodeURIComponent(mood)}`);
  }, [navigate]);

  const allSimilar = smartResult ? [...(smartResult.results || []), ...(smartResult.similarSongs || [])] : [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0e0e0e] via-[#111] to-black text-white">
      <div className="max-w-6xl mx-auto p-4 md:p-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-1">Search</h1>
          <p className="text-white/40 text-sm">Find songs, artists, or describe a vibe</p>
        </div>

        {/* Search Box */}
        <form onSubmit={handleSearch} className="mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40 pointer-events-none z-10" />
            <Input
              type="search"
              placeholder="Song, artist, or describe a mood..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => { if (!query) dispatchSearchUi({ type: 'suggestions', visible: true }); }}
              onBlur={() => setTimeout(() => dispatchSearchUi({ type: 'suggestions', visible: false }), 200)}
              className="w-full h-14 pl-12 pr-12 bg-white/5 border border-white/10 text-white placeholder:text-white/30 text-base rounded-2xl focus:ring-2 focus:ring-green-500/50 focus:border-green-500/30 transition-all backdrop-blur-xl"
              autoComplete="off"
            />
            {searchQuery && (
              <button type="button" onClick={clearSearch}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors z-10">
                <XCircle size={20} />
              </button>
            )}
          </div>
        </form>

        {showSuggestions && (
          <SearchSuggestions onSelect={handleSuggestionSelect} currentQuery={searchQuery} />
        )}

        {/* Loading */}
        {isSearching && (
          <div>
            <div className="flex items-center gap-3 mb-6 animate-pulse">
              <div className="h-7 w-48 bg-white/10 rounded-lg" />
            </div>
            <SearchSkeleton />
          </div>
        )}

        {/* Smart Results */}
        {!isSearching && smartResult && (
          <div className="space-y-8">

            {/* ── Detected Mood Badge ── */}
            {smartResult.detectedMood && (() => {
              const DetectedIcon = EMOTION_ICONS[smartResult.detectedMood.emotion] || Music;
              return (
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-white/50">Detected vibe:</span>
                  <Badge className="bg-green-500/10 text-green-400 border border-green-500/20 text-xs px-2 py-0.5 rounded-full capitalize flex items-center gap-1.5">
                    <DetectedIcon className="w-3.5 h-3.5" /> {smartResult.detectedMood.emotion}
                    {smartResult.detectedMood.context ? ` • ${smartResult.detectedMood.context}` : ''}
                  </Badge>
                </div>
              );
            })()}

            {/* ── TOP RESULT ── */}
            {smartResult.topResult && (
              <section>
                <h2 className="text-lg font-semibold mb-3 text-white/80">Top Result</h2>
                <div className="relative rounded-2xl bg-gradient-to-br from-white/8 to-white/3 border border-white/8 p-5 flex flex-col sm:flex-row gap-5 items-start sm:items-center hover:from-white/12 transition-all group overflow-hidden">
                  {/* Ambient glow */}
                  <div className="absolute -top-20 -left-20 w-56 h-56 bg-green-500/10 rounded-full blur-3xl pointer-events-none" />

                  <div className="relative w-28 h-28 rounded-xl overflow-hidden shadow-2xl flex-shrink-0">
                    {smartResult.topResult.imageUrl
                      ? <img src={smartResult.topResult.imageUrl} alt={smartResult.topResult.title} className="w-full h-full object-cover" loading="eager" ref={(el) => { if (el) (el as any).fetchPriority = 'high'; }} />
                      : <div className="w-full h-full bg-white/5 flex items-center justify-center"><Music className="w-10 h-10 text-white/20" /></div>
                    }
                  </div>

                  <div className="flex-1 min-w-0 relative z-10">
                    <p className="text-xs text-green-400 font-semibold uppercase tracking-widest mb-1">{smartResult.intent}</p>
                    <h3 className="text-2xl md:text-3xl font-semibold text-white truncate mb-1">{smartResult.topResult.title}</h3>
                    <p className="text-white/50 text-sm truncate mb-4">{smartResult.topResult.artist}
                      {smartResult.topResult.year ? ` • ${smartResult.topResult.year}` : ''}
                    </p>
                    <Button
                      onClick={playTopResult}
                      className="h-10 px-6 rounded-full bg-green-500 hover:bg-green-400 text-black font-extrabold text-sm transition-all hover:scale-105 shadow-lg shadow-green-500/20"
                    >
                      <Play className="w-4 h-4 mr-1.5 fill-black" /> Play
                    </Button>
                  </div>
                </div>
              </section>
            )}

            {/* ── SIMILAR SONGS ── */}
            {allSimilar.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-3 text-white/80">
                  {smartResult.intent === 'mood' ? 'Songs matching this vibe' : 'Similar Songs'}
                </h2>
                <div className="rounded-2xl bg-white/3 border border-white/6 divide-y divide-white/5">
                  {allSimilar.slice(0, 15).map((song, i) => (
                    <SongRow key={song.id || i} song={song} index={i} allSongs={allSimilar} onPlay={playSong} />
                  ))}
                </div>
              </section>
            )}

            {/* ── VIBE MODE ── */}
            {smartResult.vibeMode && smartResult.vibeMode.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-orange-400" />
                  <h2 className="text-lg font-semibold text-white/80">Vibe Mode</h2>
                  <span className="text-xs text-white/30">Generate a full mood playlist</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {smartResult.vibeMode.map((vibe, i) => (
                    <button type="button"
                      key={vibe.mood}
                      onClick={() => openVibeMode(vibe.mood)}
                      className={cn(
                        "px-4 py-2 rounded-full text-sm font-semibold transition-all hover:scale-105 border",
                        i === 0
                          ? "bg-orange-500/15 border-orange-500/30 text-orange-400 hover:bg-orange-500/25"
                          : i === 1
                            ? "bg-purple-500/15 border-purple-500/30 text-purple-400 hover:bg-purple-500/25"
                            : "bg-blue-500/15 border-blue-500/30 text-blue-400 hover:bg-blue-500/25"
                      )}
                    >
                      {vibe.label}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Empty state */}
            {!smartResult.topResult && allSimilar.length === 0 && (
              <div className="text-center py-16">
                <div className="mb-4"><SearchX className="w-12 h-12 mx-auto text-white/50" /></div>
                <h3 className="text-xl font-semibold mb-2">No results found</h3>
                <p className="text-white/40 text-sm">Try different keywords or describe a mood</p>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!query && !isSearching && (
          <div className="text-center py-20">
            <div className="mb-6"><Music className="w-16 h-16 mx-auto text-white/40" /></div>
            <h3 className="text-xl font-semibold mb-2">Search for music</h3>
            <p className="text-white/40 text-sm">Search a song, artist, or try <span className="text-green-400">"late night sad bollywood songs"</span></p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchPage;
