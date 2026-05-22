import axios from 'axios';
import {
  TrendingUp, Clapperboard, Heart, Music, PartyPopper, Dumbbell,
  BookMarked, Radio, Globe, Globe2
} from 'lucide-react';
import { SONG_API_BASE_URL } from '@/lib/apiConfig';
import { getHighestQualityAudioUrl } from '@/utils/jiosaavnAudio';

const BASE_URL = SONG_API_BASE_URL;

export interface JioSaavnImage {
  quality: string;
  url: string;
}

export interface JioSaavnPlaylist {
  id: string;
  name: string;
  type: string;
  image: JioSaavnImage[];
  url: string;
  songCount: number;
  language: string;
  explicitContent: boolean;
}

export interface JioSaavnPlaylistResponse {
  success: boolean;
  data: {
    total: number;
    start: number;
    results: JioSaavnPlaylist[];
  };
}

export interface JioSaavnSong {
  id: string;
  name: string;
  type: string;
  year: string;
  releaseDate: string;
  duration: number;
  label: string;
  explicitContent: boolean;
  playCount: number;
  language: string;
  hasLyrics: boolean;
  lyricsId: string;
  url: string;
  copyright: string;
  album: {
    id: string;
    name: string;
    url: string;
  };
  artists: {
    primary: Array<{
      id: string;
      name: string;
      role: string;
      type: string;
      image: JioSaavnImage[];
      url: string;
    }>;
    featured: Array<{
      id: string;
      name: string;
      role: string;
      type: string;
      image: JioSaavnImage[];
      url: string;
    }>;
    all: Array<{
      id: string;
      name: string;
      role: string;
      type: string;
      image: JioSaavnImage[];
      url: string;
    }>;
  };
  image: JioSaavnImage[];
  downloadUrl: Array<{
    quality: string;
    url: string;
  }>;
}

export interface JioSaavnPlaylistDetails {
  success: boolean;
  data: {
    id: string;
    name: string;
    description: string;
    type: string;
    year: string;
    playCount: number;
    language: string;
    explicitContent: boolean;
    songCount: number;
    url: string;
    image: JioSaavnImage[];
    songs: JioSaavnSong[];
  };
}

// Map of category id → Lucide React icon component
export const CATEGORY_ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  trending: TrendingUp,
  'most-viral': TrendingUp,
  'most-played': TrendingUp,
  'top-dhurandhar': Clapperboard,
  'new-arrivals': Music,
  bollywood: Clapperboard,
  romantic: Heart,
  punjabi: Music,
  party: PartyPopper,
  workout: Dumbbell,
  devotional: BookMarked,
  retro: Radio,
  regional: Globe,
  international: Globe2
};

// Enhanced category system with 2026-focused search terms and better trending logic
export interface PlaylistCategory {
  id: string;
  name: string;
  icon: string; // lucide icon name key (maps to CATEGORY_ICON_MAP)
  searchTerms: string[];
  description: string;
  priority: number; // Higher priority categories show first
  color: string; // Theme color for the category
}

export type AutoRefreshTimeSlot = 'morning' | 'afternoon' | 'evening' | 'night';

export interface HomeRefreshContext {
  timestamp: number;
  slot: AutoRefreshTimeSlot;
  isWeekend: boolean;
  languageBias: 'hindi' | 'punjabi' | 'english';
  signature: string;
}

export interface HomeJioSaavnCategoryData {
  id: string;
  title: string;
  results: JioSaavnPlaylist[];
}

const HOME_CACHE_PREFIX = '@mavrixfy_jiosaavn_home';
const HOME_CATEGORY_DEFAULT_TTL_MS = 30 * 60 * 1000;
const HOME_CATEGORY_TTL_MS: Record<string, number> = {
  trending: 30 * 60 * 1000,
  'most-viral': 45 * 60 * 1000,
  'most-played': 60 * 60 * 1000,
  'top-dhurandhar': 60 * 60 * 1000,
  'new-arrivals': 45 * 60 * 1000,
};
const HOME_CATEGORY_IDS = ['trending', 'most-viral', 'most-played', 'top-dhurandhar', 'new-arrivals'];
const HOME_LIVE_CATEGORY_IDS = ['trending', 'most-viral', 'most-played', 'new-arrivals'];

export const PLAYLIST_CATEGORIES: PlaylistCategory[] = [
  {
    id: 'trending',
    name: 'Trending Now',
    icon: 'trending',
    searchTerms: [
      'trending now 2026', 'top 50 2026', 'superhits 2026', 'chartbusters 2026',
      'viral hits 2026', 'most played 2026', 'popular songs 2026', 'hit songs 2026',
      'latest hits 2026', 'trending songs 2026', 'new hits 2026', 'fresh hits 2026',
      'latest trending', 'trending hindi', 'trending bollywood', 'top charts 2026',
      'weekly top 50', 'monthly hits', 'current hits', 'now playing'
    ],
    description: 'Most popular songs right now in 2026',
    priority: 10,
    color: '#ff4444'
  },
  {
    id: 'most-viral',
    name: 'Most Viral',
    icon: 'most-viral',
    searchTerms: [
      'viral songs 2026', 'viral hits', 'instagram reels songs', 'youtube shorts songs',
      'viral bollywood', 'viral hindi', 'viral now', 'reels trending songs'
    ],
    description: 'Fast-rising songs blowing up on short-video platforms',
    priority: 9,
    color: '#ff4f6d'
  },
  {
    id: 'most-played',
    name: 'Most Played',
    icon: 'most-played',
    searchTerms: [
      'most played songs 2026', 'most streamed songs', 'top played songs',
      'popular this week', 'most listened songs', 'top chart songs'
    ],
    description: 'Songs with the highest repeat and stream momentum',
    priority: 8,
    color: '#3dd6ff'
  },
  {
    id: 'top-dhurandhar',
    name: 'Top Dhurandhar',
    icon: 'top-dhurandhar',
    searchTerms: [
      'hindi superhits',
      'desi chart hits',
      'bollywood power hits',
      'top hindi songs',
      'indian chartbusters'
    ],
    description: 'Power-packed desi superhits and chart dominators',
    priority: 7,
    color: '#8cd95f'
  },
  {
    id: 'new-arrivals',
    name: 'New Arrivals',
    icon: 'new-arrivals',
    searchTerms: [
      'new movie songs 2026', 'latest songs 2026', 'new arrivals music',
      'social media trending songs', 'instagram reels new songs', 'hype songs',
      'upcoming movie hits'
    ],
    description: 'Fresh drops, movie releases, social hype and new buzz',
    priority: 6,
    color: '#57b0ff'
  },
  {
    id: 'bollywood',
    name: 'Bollywood',
    icon: 'bollywood',
    searchTerms: [
      'bollywood hits', 'hindi songs', 'bollywood superhits', 'hindi hit songs',
      'bollywood chartbusters', 'bollywood collection', 'best of bollywood',
      'latest bollywood', 'new bollywood', 'bollywood 2026', 'fresh bollywood',
      'bollywood top', 'hindi latest', 'bollywood new releases', 'hindi new releases',
      'bollywood trending', 'hindi trending', 'bollywood popular', 'hindi popular',
      'bollywood evergreen', 'hindi classics', 'bollywood melodies'
    ],
    description: 'Latest and classic Bollywood music for 2026',
    priority: 5,
    color: '#ff6b35'
  },
  {
    id: 'romantic',
    name: 'Romantic',
    icon: 'romantic',
    searchTerms: [
      'romantic songs', 'love songs', 'romantic hits', 'love ballads',
      'romantic collection', 'bollywood romantic',
      'latest romantic', 'new love songs', 'romantic 2026', 'fresh romantic',
      'romantic latest', 'love latest', 'romantic trending', 'love trending',
      'romantic popular', 'love popular', 'romantic new', 'love new',
      'romantic melodies', 'love classics', 'heart touching songs'
    ],
    description: 'Love songs for every mood in 2026',
    priority: 4,
    color: '#ff69b4'
  },
  {
    id: 'punjabi',
    name: 'Punjabi',
    icon: 'punjabi',
    searchTerms: [
      'punjabi hits', 'punjabi songs', 'punjabi superhits', 'punjabi collection',
      'best of punjabi', 'punjabi chartbusters', 'punjabi top',
      'latest punjabi', 'new punjabi', 'punjabi 2026', 'fresh punjabi',
      'punjabi latest', 'punjabi new releases', 'punjabi popular', 'punjabi trending',
      'punjabi classics', 'punjabi melodies', 'punjabi evergreen'
    ],
    description: 'Best of Punjabi music for 2026',
    priority: 3,
    color: '#ffa500'
  },
  {
    id: 'party',
    name: 'Party',
    icon: 'party',
    searchTerms: [
      'latest party 2026', 'new party songs 2026', 'party 2026', 'fresh party 2026',
      'party songs 2026', 'dance hits 2026', 'party music 2026', 'club songs 2026',
      'dance party 2026', 'party collection 2026', 'bollywood party 2026',
      'party latest', 'dance latest', 'party trending', 'dance trending'
    ],
    description: 'Get the party started in 2026',
    priority: 6,
    color: '#00ff88'
  },
  {
    id: 'workout',
    name: 'Workout',
    icon: 'workout',
    searchTerms: [
      'latest workout 2026', 'new gym songs 2026', 'workout 2026', 'fresh fitness 2026',
      'workout songs 2026', 'gym music 2026', 'fitness songs 2026', 'motivation songs 2026',
      'workout latest', 'gym latest', 'fitness latest', 'workout trending'
    ],
    description: 'High-energy workout music for 2026',
    priority: 5,
    color: '#ff4757'
  },
  {
    id: 'devotional',
    name: 'Devotional',
    icon: 'devotional',
    searchTerms: [
      'latest devotional 2026', 'new bhakti 2026', 'devotional 2026', 'fresh spiritual 2026',
      'devotional songs 2026', 'bhakti songs 2026', 'spiritual music 2026', 'religious songs 2026',
      'devotional latest', 'bhakti latest', 'spiritual latest', 'devotional trending'
    ],
    description: 'Spiritual and devotional songs for 2026',
    priority: 4,
    color: '#ffa726'
  },
  {
    id: 'retro',
    name: 'Retro Hits',
    icon: 'retro',
    searchTerms: [
      '90s hits', '2000s hits', '80s songs', 'old hits', 'retro bollywood',
      'classic songs', 'golden hits', 'evergreen songs', 'vintage hits',
      'nostalgic songs', 'retro collection', 'classic collection'
    ],
    description: 'Golden oldies and retro classics',
    priority: 3,
    color: '#ab47bc'
  },
  {
    id: 'regional',
    name: 'Regional',
    icon: 'regional',
    searchTerms: [
      'latest tamil 2026', 'new telugu 2026', 'fresh kannada 2026', 'latest malayalam 2026',
      'tamil hits 2026', 'telugu songs 2026', 'kannada songs 2026', 'malayalam songs 2026',
      'marathi songs 2026', 'bengali songs 2026', 'south indian 2026', 'regional 2026',
      'tamil latest', 'telugu latest', 'kannada latest', 'malayalam latest'
    ],
    description: 'Regional language hits for 2026',
    priority: 2,
    color: '#26a69a'
  },
  {
    id: 'international',
    name: 'International',
    icon: 'international',
    searchTerms: [
      'latest english 2026', 'new international 2026', 'english 2026', 'fresh pop 2026',
      'english songs 2026', 'international hits 2026', 'pop songs 2026', 'western music 2026',
      'english hits 2026', 'global hits 2026', 'english latest', 'international latest'
    ],
    description: 'International and English hits for 2026',
    priority: 1,
    color: '#42a5f5'
  }
];

class JioSaavnService {
  private axiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: BASE_URL,
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });
  }

  private buildCategoryCacheKey(categoryId: string): string {
    return `${HOME_CACHE_PREFIX}:${categoryId}`;
  }

  private buildCategoryCacheTimeKey(categoryId: string): string {
    return `${HOME_CACHE_PREFIX}:${categoryId}:time`;
  }

  private buildCategoryCacheSignatureKey(categoryId: string): string {
    return `${HOME_CACHE_PREFIX}:${categoryId}:signature`;
  }

  private getCategoryTtlMs(categoryId: string): number {
    return HOME_CATEGORY_TTL_MS[categoryId] ?? HOME_CATEGORY_DEFAULT_TTL_MS;
  }

  private getCurrentRefreshContext(now: Date = new Date()): HomeRefreshContext {
    const hour = now.getHours();
    let slot: AutoRefreshTimeSlot = 'night';

    if (hour >= 5 && hour < 12) slot = 'morning';
    else if (hour >= 12 && hour < 17) slot = 'afternoon';
    else if (hour >= 17 && hour < 22) slot = 'evening';

    const day = now.getDay();
    const isWeekend = day === 0 || day === 6;

    let locale = 'en';
    try {
      locale = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase();
    } catch {
      // Keep fallback locale.
    }

    let languageBias: HomeRefreshContext['languageBias'] = 'english';
    if (isWeekend) {
      languageBias = 'punjabi';
    } else if (locale.startsWith('hi') || locale.startsWith('pa')) {
      languageBias = 'hindi';
    }

    const signature = `v5|${slot}|${isWeekend ? 'weekend' : 'weekday'}|${languageBias}`;

    return {
      timestamp: now.getTime(),
      slot,
      isWeekend,
      languageBias,
      signature,
    };
  }

  private readCategoryCache(categoryId: string, context: HomeRefreshContext): JioSaavnPlaylist[] | null {
    try {
      const rawData = localStorage.getItem(this.buildCategoryCacheKey(categoryId));
      const rawTime = localStorage.getItem(this.buildCategoryCacheTimeKey(categoryId));
      const rawSignature = localStorage.getItem(this.buildCategoryCacheSignatureKey(categoryId));

      if (!rawData || !rawTime || !rawSignature) return null;
      if (rawSignature !== context.signature) return null;

      const cachedAt = Number(rawTime);
      if (!Number.isFinite(cachedAt)) return null;

      const ageMs = Date.now() - cachedAt;
      if (ageMs > this.getCategoryTtlMs(categoryId)) return null;

      const parsed = JSON.parse(rawData) as JioSaavnPlaylist[];
      if (!Array.isArray(parsed) || parsed.length === 0) return null;

      return this.removeDuplicatePlaylists(parsed);
    } catch {
      return null;
    }
  }

  private writeCategoryCache(categoryId: string, playlists: JioSaavnPlaylist[], contextSignature: string): void {
    if (!playlists.length) return;

    try {
      localStorage.setItem(this.buildCategoryCacheKey(categoryId), JSON.stringify(playlists));
      localStorage.setItem(this.buildCategoryCacheTimeKey(categoryId), String(Date.now()));
      localStorage.setItem(this.buildCategoryCacheSignatureKey(categoryId), contextSignature);
    } catch {
      // Silent cache write failure.
    }
  }

  clearHomeCategoryCache(categoryId?: string): void {
    try {
      if (categoryId) {
        localStorage.removeItem(this.buildCategoryCacheKey(categoryId));
        localStorage.removeItem(this.buildCategoryCacheTimeKey(categoryId));
        localStorage.removeItem(this.buildCategoryCacheSignatureKey(categoryId));
        return;
      }

      for (const key of Object.keys(localStorage)) {
        if (key.startsWith(`${HOME_CACHE_PREFIX}:`)) {
          localStorage.removeItem(key);
        }
      }
    } catch {
      // Silent cache clear failure.
    }
  }

  // Try multiple API endpoints with fallbacks for better reliability
  private async tryMultipleEndpoints<T>(
    endpoint: string,
    params: any = {},
    method: 'GET' | 'POST' = 'GET'
  ): Promise<T> {
    const response = await this.axiosInstance.request({
      method,
      url: endpoint,
      params: method === 'GET' ? params : undefined,
      data: method === 'POST' ? params : undefined,
    });

    if (response.data && response.data.success !== false) {
      return response.data;
    }

    throw new Error('API endpoint failed');
  }

  // Get trending playlists with enhanced search terms and charts
  async get2026TrendingPlaylists(forceRefresh: boolean = false): Promise<JioSaavnPlaylist[]> {
    try {
      // Get both trending and latest chart content
      const [trendingRealtime, latestCharts] = await Promise.allSettled([
        this.get2026SpecificTrending(forceRefresh),
        this.getLatestCharts2026(forceRefresh)
      ]);

      const allPlaylists: JioSaavnPlaylist[] = [];

      // Add realtime trending results
      if (trendingRealtime.status === 'fulfilled') {
        allPlaylists.push(...trendingRealtime.value);
      }

      // Add latest charts results
      if (latestCharts.status === 'fulfilled') {
        allPlaylists.push(...latestCharts.value);
      }

      // If we don't have enough results, add fallback searches
      if (allPlaylists.length < 8) {
        try {
          const fallbackResults = await this.searchPlaylists('trending now', 8, forceRefresh);
          allPlaylists.push(...fallbackResults);
        } catch (error) {
          // Fallback search failed
        }
      }

      // Remove duplicates and prioritize realtime trend content
      const uniquePlaylists = this.removeDuplicatePlaylists(allPlaylists);

      const filtered = uniquePlaylists
        .filter(playlist => playlist.songCount >= 8)
        .sort((a, b) => {
          // Prioritize trending keywords
          const trendingKeywords = ['trending', 'top', 'hit', 'superhit', 'latest', 'viral', 'chart'];
          const aTrending = trendingKeywords.some(keyword =>
            a.name.toLowerCase().includes(keyword)) ? 100 : 0;
          const bTrending = trendingKeywords.some(keyword =>
            b.name.toLowerCase().includes(keyword)) ? 100 : 0;

          if (aTrending !== bTrending) return bTrending - aTrending;

          // Finally sort by song count
          return b.songCount - a.songCount;
        });

      // If refreshing, shuffle the results to show different content
      return forceRefresh ? this.shuffleArray(filtered).slice(0, 12) : filtered.slice(0, 12);
    } catch (error) {
      // Fallback to regular trending search
      return this.searchPlaylists('trending now', 12, forceRefresh);
    }
  }

  // Get realtime trending content
  private async get2026SpecificTrending(forceRefresh: boolean = false): Promise<JioSaavnPlaylist[]> {
    let trending2026Terms = [
      'trending now',
      'top 50',
      'superhits',
      'latest hits',
      'viral hits',
      'bollywood hits',
      'hindi hits'
    ];

    // If refreshing, randomize the terms
    if (forceRefresh) {
      trending2026Terms = this.shuffleArray(trending2026Terms);
    }

    const trendingResults = await Promise.allSettled(
      trending2026Terms.slice(0, 4).map((term) =>
        this.tryMultipleEndpoints<JioSaavnPlaylistResponse>(
          '/search/playlists',
          {
            query: term,
            limit: 6,
            page: forceRefresh ? Math.floor(Math.random() * 3) + 1 : 1
          }
        )
      )
    );

    const allPlaylists = trendingResults.flatMap((result) =>
      result.status === 'fulfilled' && result.value.success && result.value.data?.results
        ? result.value.data.results
        : []
    );

    return allPlaylists;
  }

  // Get trending playlists that match JioSaavn's trending section (optimized for speed)
  async getTrendingPlaylists(limit: number = 20): Promise<JioSaavnPlaylist[]> {
    try {
      // Use fewer, more targeted search terms for faster loading
      const trendingTerms = [
        'trending now',
        'top 50',
        'superhits',
        'hit songs'
      ];

      const results = await Promise.allSettled(
        trendingTerms.slice(0, 2).map((term) => this.searchPlaylists(term, limit))
      );
      const allPlaylists = results.flatMap((result) =>
        result.status === 'fulfilled' ? result.value : []
      );

      // Remove duplicates and prioritize trending content
      const uniquePlaylists = this.removeDuplicatePlaylists(allPlaylists);

      // Sort by trending criteria (simplified for speed)
      return uniquePlaylists
        .sort((a, b) => {
          // Quick trending keyword check
          const trendingKeywords = ['trending', 'top', 'hit', 'superhit'];
          const aHasTrending = trendingKeywords.some(keyword =>
            a.name.toLowerCase().includes(keyword));
          const bHasTrending = trendingKeywords.some(keyword =>
            b.name.toLowerCase().includes(keyword));

          if (aHasTrending && !bHasTrending) return -1;
          if (!aHasTrending && bHasTrending) return 1;

          // Then sort by song count (more songs = more popular)
          return b.songCount - a.songCount;
        })
        .slice(0, limit);
    } catch (error) {
      // Fast fallback to regular trending search
      return this.searchPlaylists('trending now', limit);
    }
  }

  // Enhanced search with realtime-focused logic and minimum results guarantee
  async searchPlaylists(query: string = 'bollywood', limit: number = 20, forceRefresh: boolean = false): Promise<JioSaavnPlaylist[]> {
    try {
      let enhancedQuery = this.cleanRealtimeQuery(query).toLowerCase();

      // Add randomization for refresh to get different results
      if (forceRefresh) {
        const refreshVariations = [
          enhancedQuery,
          `${enhancedQuery} fresh`,
          `${enhancedQuery} updated`,
          `${enhancedQuery} latest`,
          `new ${enhancedQuery}`,
          `fresh ${enhancedQuery}`
        ];
        enhancedQuery = refreshVariations[Math.floor(Math.random() * refreshVariations.length)];
      }

      let results: JioSaavnPlaylist[] = [];

      // Try the enhanced query first
      try {
        const response = await this.tryMultipleEndpoints<JioSaavnPlaylistResponse>(
          '/search/playlists',
          {
            query: enhancedQuery,
            limit: forceRefresh ? limit + 10 : limit, // Get more results when refreshing
            page: forceRefresh ? Math.floor(Math.random() * 3) + 1 : 1 // Random page for refresh
          }
        );

        if (response.success && response.data?.results) {
          results = this.filterAndSortPlaylists(response.data.results, enhancedQuery);
        }
      } catch (error) {
        // Primary search failed
      }

      // If we don't have enough results, try the original query
      if (results.length < Math.min(limit, 5)) {
        try {
          const fallbackResponse = await this.tryMultipleEndpoints<JioSaavnPlaylistResponse>(
            '/search/playlists',
            {
              query: this.cleanRealtimeQuery(query),
              limit: limit,
              page: 1
            }
          );

          if (fallbackResponse.success && fallbackResponse.data?.results) {
            const fallbackResults = this.filterAndSortPlaylists(
              fallbackResponse.data.results,
              this.cleanRealtimeQuery(query)
            );
            // Merge results, avoiding duplicates
            const existingIds = new Set(results.map(p => p.id));
            const newResults = fallbackResults.filter(p => !existingIds.has(p.id));
            results = [...results, ...newResults];
          }
        } catch (error) {
          // Fallback search failed
        }
      }

      const finalResults = forceRefresh ? this.shuffleArray(results).slice(0, limit) : results.slice(0, limit);

      return finalResults;
    } catch (error) {
      throw error;
    }
  }

  // Shuffle array for refresh randomization
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private stripNoiseTags(term: string): string {
    return term
      .replace(/\b20\d{2}\b/g, ' ')
      .replace(/\b(award|awards|grammy|grammys|oscar|oscars|yearly|annual)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private cleanRealtimeQuery(query: string): string {
    const normalized = this.stripNoiseTags(query);
    return normalized || query.trim();
  }

  private getCategoryIntentKeywords(categoryId: string): string[] {
    switch (categoryId) {
      case 'trending':
        return ['popular', 'chart', 'top', 'hits', 'weekly', 'india'];
      case 'most-viral':
        return ['viral', 'reels', 'shorts', 'social', 'hot', 'buzz'];
      case 'most-played':
        return ['most played', 'streamed', 'popular', 'top', 'chart'];
      case 'top-dhurandhar':
        return ['hindi', 'superhit', 'desi', 'bollywood', 'chart'];
      case 'new-arrivals':
        return ['new', 'latest', 'release', 'movie', 'hype', 'fresh'];
      default:
        return [];
    }
  }

  private buildCategorySearchTermPool(category: PlaylistCategory): string[] {
    const rawTerms = [...category.searchTerms, ...this.getCategoryIntentKeywords(category.id)];
    const seen = new Set<string>();

    return rawTerms.flatMap((rawTerm) => {
      const term = this.stripNoiseTags(rawTerm);
      const normalized = term.toLowerCase();
      if (!normalized || seen.has(normalized)) return [];
      seen.add(normalized);
      return [term];
    });
  }

  private getNameFingerprint(name: string): string {
    const stopwords = new Set([
      'the', 'and', 'for', 'with', 'from', 'songs', 'song', 'hits', 'top', 'best',
      'trending', 'viral', 'most', 'played', 'playlist', 'mix', 'music', 'new', 'latest',
      'hindi', 'bollywood', 'dhurandhar', 'collection', 'charts', 'chart',
    ]);

    const tokens = name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 2 && !/^\d+$/.test(token) && !stopwords.has(token));

    return tokens.slice(0, 3).join('|');
  }

  private diversifyPlaylistsByName(playlists: JioSaavnPlaylist[], limit: number): JioSaavnPlaylist[] {
    const selected: JioSaavnPlaylist[] = [];
    const usedByFingerprint = new Set<string>();

    for (const playlist of playlists) {
      const fingerprint = this.getNameFingerprint(playlist.name);
      const key = fingerprint || playlist.id;
      if (usedByFingerprint.has(key)) continue;

      usedByFingerprint.add(key);
      selected.push(playlist);
      if (selected.length >= limit) return selected;
    }

    for (const playlist of playlists) {
      if (selected.some((item) => item.id === playlist.id)) continue;
      selected.push(playlist);
      if (selected.length >= limit) break;
    }

    return selected;
  }

  // Smart playlist filtering and sorting logic for realtime relevance
  private filterAndSortPlaylists(playlists: JioSaavnPlaylist[], query: string): JioSaavnPlaylist[] {
    return playlists
      .filter(playlist => {
        // Be much more lenient for popular categories
        const isPopularCategory = ['bollywood', 'romantic', 'punjabi', 'hindi', 'love'].some(term =>
          query.toLowerCase().includes(term)
        );

        // Much lower minimum song requirements
        const minSongs = isPopularCategory ? 3 : // Very lenient for popular categories
          query.toLowerCase().includes('trending') ? 5 :
            query.toLowerCase().includes('latest') || query.toLowerCase().includes('new') ? 3 : 5;

        if (playlist.songCount < minSongs) return false;

        // Filter out obviously bad playlists
        const name = playlist.name.toLowerCase();
        if (name.includes('test') || name.includes('temp') || name.length < 3) {
          return false;
        }

        if (/\b(award|awards|grammy|grammys|oscar|oscars)\b/i.test(name)) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Priority 1: Latest/Fresh content gets high priority
        const freshKeywords = ['latest', 'new', 'fresh', 'updated', 'recent', 'release', 'now'];
        const aHasFresh = freshKeywords.some(keyword =>
          a.name.toLowerCase().includes(keyword)) ? 150 : 0;
        const bHasFresh = freshKeywords.some(keyword =>
          b.name.toLowerCase().includes(keyword)) ? 150 : 0;

        if (aHasFresh !== bHasFresh) return bHasFresh - aHasFresh;

        // Priority 2: Query relevance - exact matches get priority
        const queryWords = query.toLowerCase().split(' ');
        const aMatches = queryWords.filter(word => word.length > 2 && a.name.toLowerCase().includes(word)).length;
        const bMatches = queryWords.filter(word => word.length > 2 && b.name.toLowerCase().includes(word)).length;

        if (aMatches !== bMatches) return bMatches - aMatches;

        // Priority 3: Official/Curated playlists
        const officialKeywords = ['hit songs', 'top', 'best of', 'superhits', 'chartbusters', 'collection', 'hits'];
        const aHasOfficial = officialKeywords.some(keyword =>
          a.name.toLowerCase().includes(keyword)) ? 50 : 0;
        const bHasOfficial = officialKeywords.some(keyword =>
          b.name.toLowerCase().includes(keyword)) ? 50 : 0;

        if (aHasOfficial !== bHasOfficial) return bHasOfficial - aHasOfficial;

        // Priority 4: Song count (more songs = more comprehensive) - but don't over-prioritize
        const songCountDiff = b.songCount - a.songCount;
        if (Math.abs(songCountDiff) > 20) return Math.sign(songCountDiff) * 10; // Reduced impact

        // Priority 5: Alphabetical for consistency
        return a.name.localeCompare(b.name);
      });
  }

  // Get fresh playlists for any category with latest content prioritized
  async getFreshPlaylistsByCategory(categoryId: string, limit: number = 20, forceRefresh: boolean = false): Promise<JioSaavnPlaylist[]> {
    const category = PLAYLIST_CATEGORIES.find(cat => cat.id === categoryId);
    if (!category) {
      throw new Error(`Category ${categoryId} not found`);
    }

    try {
      // For popular categories, use optimized search strategy
      if (['bollywood', 'romantic', 'punjabi'].includes(categoryId)) {
        return this.getPopularCategoryPlaylists(categoryId, limit, forceRefresh);
      }

      let searchTerms = this.buildCategorySearchTermPool(category);
      const freshTerms = searchTerms.filter((term) =>
        term.includes('latest') || term.includes('new') || term.includes('fresh') || term.includes('release')
      );
      const freshTermSet = new Set(freshTerms);
      searchTerms = [...freshTerms, ...searchTerms.filter((term) => !freshTermSet.has(term))];

      // If refreshing, randomize the search terms
      if (forceRefresh) {
        searchTerms = this.shuffleArray(searchTerms);
      }

      searchTerms = searchTerms.slice(0, 6);

      const searchResults = await Promise.allSettled(
        searchTerms.map((term) => this.searchPlaylists(term, Math.ceil(limit / 3), forceRefresh))
      );
      const allPlaylists = searchResults.flatMap((result) =>
        result.status === 'fulfilled' ? result.value : []
      );

      // Remove duplicates and sort by freshness
      const uniquePlaylists = this.removeDuplicatePlaylists(allPlaylists);
      const sorted = this.sortPlaylistsByFreshness(uniquePlaylists, categoryId);
      const diversified = this.diversifyPlaylistsByName(sorted, limit);

      return forceRefresh ? this.shuffleArray(diversified).slice(0, limit) : diversified.slice(0, limit);
    } catch (error) {
      // Fallback to regular category search
      return this.getPlaylistsByCategory(categoryId, limit, forceRefresh);
    }
  }

  // Get playlists by category with smart search terms and fresh content
  async getPlaylistsByCategory(categoryId: string, limit: number = 20, forceRefresh: boolean = false): Promise<JioSaavnPlaylist[]> {
    const category = PLAYLIST_CATEGORIES.find(cat => cat.id === categoryId);
    if (!category) {
      throw new Error(`Category ${categoryId} not found`);
    }

    try {
      // For popular categories, use optimized search strategy
      if (['bollywood', 'romantic', 'punjabi'].includes(categoryId)) {
        return this.getPopularCategoryPlaylists(categoryId, limit, forceRefresh);
      }

      // Use category + intent pool for better category spread
      let searchTerms = this.buildCategorySearchTermPool(category).slice(0, 5);

      // If refreshing, randomize and use different terms
      if (forceRefresh) {
        searchTerms = this.shuffleArray(this.buildCategorySearchTermPool(category)).slice(0, 5);
      }

      const results = await Promise.allSettled(
        searchTerms.map((term) => this.searchPlaylists(term, Math.ceil(limit / 2), forceRefresh))
      );
      const allPlaylists = results.flatMap((result) =>
        result.status === 'fulfilled' ? result.value : []
      );

      // Remove duplicates and sort by freshness and relevance
      const uniquePlaylists = this.removeDuplicatePlaylists(allPlaylists);
      const sorted = this.sortPlaylistsByFreshness(uniquePlaylists, categoryId);
      const diversified = this.diversifyPlaylistsByName(sorted, limit);

      return forceRefresh ? this.shuffleArray(diversified).slice(0, limit) : diversified.slice(0, limit);
    } catch (error) {
      // Fallback to first search term
      return this.searchPlaylists(category.searchTerms[0], limit, forceRefresh);
    }
  }

  // Optimized method for popular categories (Bollywood, Romantic, Punjabi)
  private async getPopularCategoryPlaylists(categoryId: string, limit: number = 20, forceRefresh: boolean = false): Promise<JioSaavnPlaylist[]> {
    const category = PLAYLIST_CATEGORIES.find(cat => cat.id === categoryId);
    if (!category) return [];

    try {
      // Use more search terms and be more aggressive
      const cleanedTerms = this.buildCategorySearchTermPool(category);
      const primaryTerms = cleanedTerms.filter(term =>
        !term.includes('latest') && !term.includes('new') && !term.includes('fresh') && !term.includes('release')
      );

      const secondaryTerms = cleanedTerms.filter(term =>
        term.includes('latest') || term.includes('new') || term.includes('fresh') || term.includes('release')
      );

      let searchTerms = [...primaryTerms, ...secondaryTerms];

      if (forceRefresh) {
        searchTerms = this.shuffleArray(searchTerms);
      }

      const primaryResults = await Promise.allSettled(
        searchTerms.slice(0, 8).map((term) => this.searchPlaylists(term, 15, forceRefresh))
      );
      const allPlaylists = primaryResults.flatMap((result) =>
        result.status === 'fulfilled' ? result.value : []
      );

      // If still not enough results, try additional generic searches
      if (allPlaylists.length < limit) {
        const additionalResults = await Promise.allSettled(
          this.getAdditionalSearchTerms(categoryId).map((term) => this.searchPlaylists(term, 10, forceRefresh))
        );
        allPlaylists.push(...additionalResults.flatMap((result) =>
          result.status === 'fulfilled' ? result.value : []
        ));
      }

      // Remove duplicates and sort
      const uniquePlaylists = this.removeDuplicatePlaylists(allPlaylists);

      const sorted = this.sortPlaylistsByFreshness(uniquePlaylists, categoryId);

      const diversified = this.diversifyPlaylistsByName(sorted, limit);
      const result = forceRefresh ? this.shuffleArray(diversified).slice(0, limit) : diversified.slice(0, limit);

      return result;
    } catch (error) {
      // Final fallback - use the most basic search term with higher limit
      const basicTerm = categoryId === 'bollywood' ? 'bollywood' :
        categoryId === 'romantic' ? 'romantic' :
          'punjabi';
      return this.searchPlaylists(basicTerm, limit, forceRefresh);
    }
  }

  // Get additional search terms for better coverage
  private getAdditionalSearchTerms(categoryId: string): string[] {
    switch (categoryId) {
      case 'bollywood':
        return ['hindi', 'bollywood music', 'hindi music', 'indian songs', 'filmi songs'];
      case 'romantic':
        return ['love', 'romantic music', 'love music', 'heart touching'];
      case 'punjabi':
        return ['punjabi music', 'punjabi gana', 'punjabi bhangra', 'punjabi folk'];
      default:
        return [];
    }
  }

  // Sort playlists by freshness and relevance
  private sortPlaylistsByFreshness(playlists: JioSaavnPlaylist[], categoryId: string): JioSaavnPlaylist[] {
    const intentKeywords = this.getCategoryIntentKeywords(categoryId);
    const freshKeywords = ['latest', 'new', 'fresh', 'updated', 'recent', 'release', 'now'];
    const officialKeywords = ['top', 'best', 'hit', 'superhit', 'collection', 'chartbuster'];

    const computeScore = (playlist: JioSaavnPlaylist): number => {
      const name = playlist.name.toLowerCase();

      const freshness = freshKeywords.reduce((score, keyword) => {
        return name.includes(keyword) ? score + 10 : score;
      }, 0);

      const intent = intentKeywords.reduce((score, keyword) => {
        return name.includes(keyword) ? score + 8 : score;
      }, 0);

      const official = officialKeywords.some((keyword) => name.includes(keyword)) ? 8 : 0;
      const density = Math.min(playlist.songCount, 200) / 25;

      return freshness + intent + official + density;
    };

    return playlists.toSorted((a, b) => {
      const scoreDiff = computeScore(b) - computeScore(a);
      if (Math.abs(scoreDiff) > 0.5) return scoreDiff;

      const songCountDiff = b.songCount - a.songCount;
      if (Math.abs(songCountDiff) > 5) return songCountDiff;

      return a.name.localeCompare(b.name);
    });
  }

  // Remove duplicate playlists based on ID
  private removeDuplicatePlaylists(playlists: JioSaavnPlaylist[]): JioSaavnPlaylist[] {
    const seen = new Set<string>();
    return playlists.filter(playlist => {
      if (seen.has(playlist.id)) {
        return false;
      }
      seen.add(playlist.id);
      return true;
    });
  }

  // Get featured playlists for homepage with 2026 focus
  async getFeaturedPlaylists(): Promise<{ [categoryId: string]: JioSaavnPlaylist[] }> {
    const results: { [categoryId: string]: JioSaavnPlaylist[] } = {};

    try {
      // Get 2026-specific trending playlists
      const trendingPlaylists = await this.get2026TrendingPlaylists();
      results['trending'] = trendingPlaylists;

      // Get other high priority categories with 2026 focus
      const otherCategories = PLAYLIST_CATEGORIES
        .filter(cat => cat.priority >= 7 && cat.id !== 'trending') // Exclude trending as we handle it separately
        .slice(0, 3); // Limit to 3 other categories

      await Promise.all(
        otherCategories.map(async (category) => {
          try {
            const playlists = await this.getFreshPlaylistsByCategory(category.id, 8);
            results[category.id] = playlists;
          } catch (error) {
            results[category.id] = [];
          }
        })
      );
    } catch (error) {
      // Fallback to original method
      const featuredCategories = PLAYLIST_CATEGORIES
        .filter(cat => cat.priority >= 7)
        .slice(0, 4);

      await Promise.all(
        featuredCategories.map(async (category) => {
          try {
            const playlists = await this.getPlaylistsByCategory(category.id, 8);
            results[category.id] = playlists;
          } catch (error) {
            results[category.id] = [];
          }
        })
      );
    }

    return results;
  }

  // Get playlist details with songs, overcoming the 10-count API limit
  async getPlaylistDetails(playlistId: string): Promise<JioSaavnPlaylistDetails['data']> {
    try {
      const limit = 50;
      let page = 1;

      // First try to fetch the playlist
      const response = await this.tryMultipleEndpoints<{ success: boolean, data: JioSaavnPlaylistDetails['data'] }>(
        `/playlists`,
        { id: playlistId, limit, page }
      );

      if (!response.success || !response.data) {
        throw new Error('Failed to fetch playlist details');
      }

      const playlistData = response.data;
      let allSongs = playlistData.songs || [];
      const totalSongs = playlistData.songCount || allSongs.length;

      // If we got all songs, return as is
      if (allSongs.length >= totalSongs) {
        return playlistData;
      }

      // If there are more songs, try pagination (up to 500 songs max to be safe)
      const maxPages = Math.min(Math.ceil(totalSongs / limit), 10);

      const pageResults = await Promise.allSettled(
        Array.from({ length: Math.max(0, maxPages - 1) }, (_, index) => index + 2).map((pageNumber) =>
          this.tryMultipleEndpoints<{ success: boolean, data: JioSaavnPlaylistDetails['data'] }>(
            `/playlists`,
            { id: playlistId, limit, page: pageNumber }
          )
        )
      );

      for (const result of pageResults) {
        if (result.status !== 'fulfilled' || !result.value.success || !result.value.data?.songs) {
          break;
        }

        const newSongs = result.value.data.songs;
        if (newSongs.length === 0) break;

        // Add unique songs only
        const existingIds = new Set(allSongs.map(s => s.id));
        const uniqueNewSongs = newSongs.filter(s => !existingIds.has(s.id));
        allSongs = [...allSongs, ...uniqueNewSongs];

        if (allSongs.length >= totalSongs) break;
      }

      playlistData.songs = allSongs;
      return playlistData;

    } catch (error) {
      console.error('Error fetching comprehensive playlist:', error);
      throw error;
    }
  }

  // Get popular playlists by category (legacy method for backward compatibility)
  async getPopularPlaylists(category: string = 'hindi'): Promise<JioSaavnPlaylist[]> {
    const categoryMap: { [key: string]: string } = {
      hindi: 'bollywood',
      punjabi: 'punjabi',
      tamil: 'regional',
      telugu: 'regional',
      english: 'international',
      romantic: 'romantic',
      party: 'party',
      workout: 'workout',
    };

    const categoryId = categoryMap[category] || 'bollywood';
    return this.getPlaylistsByCategory(categoryId, 15);
  }

  // Get latest JioSaavn charts and trending content
  async getLatestCharts2026(forceRefresh: boolean = false): Promise<JioSaavnPlaylist[]> {
    try {
      // Use specific chart and trending terms that JioSaavn uses
      let chartTerms = [
        'Top 50 This Week',
        'Trending This Week',
        'Weekly Top Songs',
        'Hindi Top 50',
        'Bollywood Top Charts',
        'Most Popular This Week',
        'Viral This Week',
        'Top Hits'
      ];

      // If refreshing, randomize the chart terms
      if (forceRefresh) {
        chartTerms = this.shuffleArray(chartTerms);
      }

      const allPlaylists: JioSaavnPlaylist[] = [];

      // Search for official chart playlists
      const chartResults = await Promise.allSettled(
        chartTerms.slice(0, 5).map((term) =>
          this.tryMultipleEndpoints<JioSaavnPlaylistResponse>(
            '/search/playlists',
            {
              query: term,
              limit: 4,
              page: forceRefresh ? Math.floor(Math.random() * 2) + 1 : 1
            }
          )
        )
      );

      for (const result of chartResults) {
        if (result.status === 'fulfilled' && result.value.success && result.value.data?.results) {
          const officialPlaylists = result.value.data.results.filter(playlist => {
            const name = playlist.name.toLowerCase();
            return playlist.songCount >= 15 && /\b(top|chart|trending|hit|popular|viral)\b/.test(name);
          });

          allPlaylists.push(...officialPlaylists);
        }
      }

      // Remove duplicates and sort by relevance
      const uniquePlaylists = this.removeDuplicatePlaylists(allPlaylists);

      const sorted = uniquePlaylists
        .sort((a, b) => {
          // Prioritize official chart keywords
          const chartKeywordPattern = /\b(top 50|top|chart|trending|weekly|popular)\b/;
          const aHasChart = chartKeywordPattern.test(a.name.toLowerCase()) ? 100 : 0;
          const bHasChart = chartKeywordPattern.test(b.name.toLowerCase()) ? 100 : 0;

          if (aHasChart !== bHasChart) return bHasChart - aHasChart;

          // Then by song count
          return b.songCount - a.songCount;
        });

      return forceRefresh ? this.shuffleArray(sorted).slice(0, 10) : sorted.slice(0, 10);
    } catch (error) {
      return [];
    }
  }

  // Get best quality image URL
  getBestImageUrl(images: JioSaavnImage[]): string {
    if (!images || images.length === 0) {
      return '/placeholder-playlist.jpg';
    }

    // Prefer 500x500, then 150x150, then 50x50
    const preferred = images.find(img => img.quality === '500x500') ||
      images.find(img => img.quality === '150x150') ||
      images[0];

    return preferred?.url || '/placeholder-playlist.jpg';
  }

  // Convert JioSaavn song to app song format
  convertToAppSong(jioSong: JioSaavnSong): any {
    const primaryArtist = jioSong.artists.primary[0];
    const bestImageUrl = this.getBestImageUrl(jioSong.image);
    const bestDownloadUrl = getHighestQualityAudioUrl(jioSong.downloadUrl);

    return {
      _id: `jiosaavn_${jioSong.id}`,
      title: jioSong.name,
      artist: primaryArtist?.name || 'Unknown Artist',
      albumId: jioSong.album.name,
      duration: jioSong.duration,
      imageUrl: bestImageUrl,
      audioUrl: bestDownloadUrl || '',
      source: 'jiosaavn',
      language: jioSong.language,
      year: jioSong.year,
      playCount: jioSong.playCount,
      hasLyrics: jioSong.hasLyrics,
      explicitContent: jioSong.explicitContent,
      originalData: jioSong,
    };
  }

  // Get category by ID
  getCategoryById(categoryId: string): PlaylistCategory | undefined {
    return PLAYLIST_CATEGORIES.find(cat => cat.id === categoryId);
  }

  // Get all categories sorted by priority
  getAllCategories(): PlaylistCategory[] {
    return PLAYLIST_CATEGORIES.toSorted((a, b) => b.priority - a.priority);
  }

  // App-style home flow: category cache + context signature + cross-category de-dupe.
  async getHomeJioSaavnCategories(options?: {
    forceRefresh?: boolean;
    limitPerCategory?: number;
    realtime?: boolean;
  }): Promise<HomeJioSaavnCategoryData[]> {
    const forceRefresh = options?.forceRefresh ?? false;
    const limitPerCategory = options?.limitPerCategory ?? 15;
    const realtime = options?.realtime ?? false;
    const context = this.getCurrentRefreshContext();

    const homeCategories = HOME_CATEGORY_IDS.flatMap((id) => {
      const category = this.getCategoryById(id);
      return category ? [category] : [];
    });

    const categoryResults = await Promise.all(
      homeCategories.map(async (category) => {
        const isLiveCategory = HOME_LIVE_CATEGORY_IDS.includes(category.id);
        const shouldBypassCache = forceRefresh || (realtime && isLiveCategory);
        const shouldForceCategoryRefresh = forceRefresh || (realtime && isLiveCategory);

        if (!shouldBypassCache) {
          const cached = this.readCategoryCache(category.id, context);
          if (cached && cached.length > 0) {
            return {
              id: category.id,
              title: category.name,
              results: cached.slice(0, limitPerCategory),
            };
          }
        }

        const fresh = await this.getFreshPlaylistsByCategory(
          category.id,
          limitPerCategory,
          shouldForceCategoryRefresh
        );
        this.writeCategoryCache(category.id, fresh, context.signature);

        return {
          id: category.id,
          title: category.name,
          results: fresh,
        };
      })
    );

    const usedPlaylistIds: Record<string, true> = {};
    return categoryResults.flatMap((category) => {
      const uniqueResults = category.results.filter((playlist) => {
        if (!playlist?.id || usedPlaylistIds[playlist.id]) return false;
        usedPlaylistIds[playlist.id] = true;
        return true;
      });

      return uniqueResults.length > 0 ? [{
        ...category,
        results: uniqueResults,
      }] : [];
    });
  }

  // Smart search with category detection
  async smartSearch(query: string, limit: number = 20): Promise<{
    playlists: JioSaavnPlaylist[];
    detectedCategory?: PlaylistCategory;
    suggestions: string[];
  }> {
    const lowerQuery = query.toLowerCase();

    // Try to detect category from query
    const detectedCategory = PLAYLIST_CATEGORIES.find(category =>
      category.searchTerms.some(term => lowerQuery.includes(term.toLowerCase())) ||
      lowerQuery.includes(category.name.toLowerCase())
    );

    let playlists: JioSaavnPlaylist[] = [];

    if (detectedCategory) {
      // Use category-specific search for better results
      playlists = await this.getPlaylistsByCategory(detectedCategory.id, limit);
    } else {
      // Regular search
      playlists = await this.searchPlaylists(query, limit);
    }

    // Generate search suggestions
    const suggestions = this.generateSearchSuggestions(query);

    return {
      playlists,
      detectedCategory,
      suggestions
    };
  }

  // Generate search suggestions based on popular terms
  private generateSearchSuggestions(query: string): string[] {
    const popularTerms = [
      'bollywood hits', 'punjabi songs', 'romantic songs', 'party music',
      'workout songs', '90s hits', 'arijit singh', 'trending songs',
      'devotional songs', 'tamil hits', 'telugu songs', 'english songs'
    ];

    return popularTerms
      .filter(term => term.toLowerCase().includes(query.toLowerCase()) ||
        query.toLowerCase().includes(term.toLowerCase()))
      .slice(0, 5);
  }
}

export const jioSaavnService = new JioSaavnService();
export default jioSaavnService;
