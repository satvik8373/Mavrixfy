import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type MediaUrl = {
  quality?: string;
  url?: string;
  link?: string;
};

type JioSaavnSong = {
  id?: string | number;
  name?: string;
  title?: string;
  album?: string | { id?: string | number | null; name?: string | null; url?: string | null; link?: string | null };
  artists?: { primary?: Array<{ name?: string | null }> };
  primaryArtists?: string;
  artist?: string;
  image?: string | MediaUrl[];
  imageUrl?: string;
  downloadUrl?: MediaUrl[] | { downloadUrl?: MediaUrl[] };
  streamUrl?: string;
  url?: string;
  duration?: string | number | null;
  year?: string | number | null;
  releaseDate?: string | null;
  language?: string;
  genre?: string;
  songCount?: string | number | null;
  type?: string;
};

type NormalizedSong = {
  id: string;
  saavnId: string;
  name: string;
  title: string;
  artist: string;
  primaryArtists: string;
  album: { id: string | null; name: string | null; url: string | null };
  image: Array<{ quality: string; url: string }>;
  imageUrl: string;
  downloadUrl: Array<{ quality: string; url: string }>;
  streamUrl: string;
  url: string;
  duration?: number;
  year?: number;
  releaseDate?: string | null;
  language?: string;
  genre?: string;
  source: string;
  sourceLabel: string;
  playbackType?: 'audio';
  externalUrl?: string;
};

type ProviderConfig = {
  source: string;
  label: string;
  searchUrl: string;
  globalUrl: string;
};

type ProviderQueryResult = {
  provider: string;
  label: string;
  queryVariant: string;
  mode: 'search' | 'global';
  total: number;
  results: NormalizedSong[];
};

const SONG_API_BASE_URL = (
  process.env.JIOSAAVN_API_BASE_URL ||
  process.env.VITE_SONG_API_URL ||
  'https://mavrixfy-song-api.vercel.app/api'
).replace(/\/+$/, '');

const JIOSAAVN_PROVIDERS: ProviderConfig[] = [
  {
    source: 'jiosaavn',
    label: 'Mavrixfy Song API',
    searchUrl: `${SONG_API_BASE_URL}/search/songs`,
    globalUrl: `${SONG_API_BASE_URL}/search`,
  },
];

const SONG_DETAILS_URL = `${SONG_API_BASE_URL}/songs`;

const QUERY_QUALIFIER_TOKENS = new Set([
  'acoustic',
  'cover',
  'edit',
  'female',
  'ft',
  'live',
  'lofi',
  'lo',
  'male',
  'mix',
  'official',
  'reprise',
  'reverb',
  'remix',
  'session',
  'slowed',
  'sped',
  'unplugged',
  'version',
]);

const NOISY_RESULT_TOKEN_PENALTIES: Record<string, number> = {
  audio: 20,
  editz: 20,
  lyrics: 20,
  mashup: 60,
  mix: 25,
  mp3: 40,
  official: 20,
  repost: 25,
  slowed: 25,
  status: 20,
  trim: 40,
  video: 15,
};

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function decodeHtmlEntities(value: unknown): string {
  return String(value ?? '')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function yearFrom(value: unknown): number | undefined {
  const direct = asNumber(value);
  if (direct && direct >= 1900) return direct;

  const text = asString(value);
  const match = text.match(/\b(19|20)\d{2}\b/);
  if (match) return Number.parseInt(match[0], 10);

  const date = text ? new Date(text) : null;
  const year = date && !Number.isNaN(date.getTime()) ? date.getUTCFullYear() : undefined;
  return year && year >= 1900 ? year : undefined;
}

function mediaUrl(item?: MediaUrl): string {
  return item?.url || item?.link || '';
}

function parseDownloadUrls(downloadUrl?: JioSaavnSong['downloadUrl']): MediaUrl[] {
  if (Array.isArray(downloadUrl)) return downloadUrl;
  if (Array.isArray(downloadUrl?.downloadUrl)) return downloadUrl.downloadUrl;
  return [];
}

function normalizeImages(image: JioSaavnSong['image'], imageUrl?: string): Array<{ quality: string; url: string }> {
  if (Array.isArray(image)) {
    const result: Array<{ quality: string; url: string }> = [];
    image.forEach((item, index) => {
      const url = mediaUrl(item);
      if (url) {
        result.push({
          quality: item.quality || `${index + 1}`,
          url,
        });
      }
    });
    return result;
  }

  const url = typeof image === 'string' ? image : imageUrl || '';
  return url ? [{ quality: '500x500', url }] : [];
}

function normalizeDownloads(downloadUrl?: JioSaavnSong['downloadUrl']): Array<{ quality: string; url: string }> {
  const result: Array<{ quality: string; url: string }> = [];
  parseDownloadUrls(downloadUrl).forEach((item, index) => {
    const url = mediaUrl(item);
    if (url) {
      result.push({
        quality: item.quality || `${index + 1}`,
        url,
      });
    }
  });
  return result;
}

function bestAudio(downloads: Array<{ quality: string; url: string }>, fallback = ''): string {
  return (
    downloads.find(item => item.quality === '320kbps')?.url ||
    downloads.find(item => item.quality === '160kbps')?.url ||
    downloads.find(item => item.quality === '96kbps')?.url ||
    downloads[downloads.length - 1]?.url ||
    fallback
  );
}

function albumName(album: JioSaavnSong['album']): string {
  if (typeof album === 'string') return decodeHtmlEntities(album);
  return decodeHtmlEntities(album?.name || '');
}

function albumUrl(album: JioSaavnSong['album']): string | null {
  if (!album || typeof album === 'string') return null;
  return album.url || album.link || null;
}

function comparable(value: string): string {
  return decodeHtmlEntities(value)
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/\band\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value: string): string[] {
  return comparable(value).split(' ').filter(Boolean);
}

function splitArtists(value: string): string[] {
  return decodeHtmlEntities(value)
    .split(/\s*(?:,|;|\/|\||&|feat(?:uring)?|ft\.?)\s*/i)
    .flatMap(part => {
      const s = asString(part);
      return s ? [s] : [];
    });
}

function normalizePrimaryArtists(song: JioSaavnSong): string {
  const fromStructured = song.artists?.primary?.flatMap(item => {
    const name = decodeHtmlEntities(item.name || '');
    return name ? [name] : [];
  }) || [];
  if (fromStructured.length > 0) return fromStructured.join(', ');

  const fromFlat = splitArtists(song.primaryArtists || song.artist || '');
  return fromFlat.join(', ');
}

function generateQueryVariants(query: string): string[] {
  const normalized = query.replace(/[\(\)\[\]\{\}"'`]+/g, ' ').replace(/\s+/g, ' ').trim();
  const tokens = tokenize(normalized);
  const withoutQualifiers = tokens.filter(token => !QUERY_QUALIFIER_TOKENS.has(token));
  const withoutTrailingVersion = withoutQualifiers.filter(token => token !== 'ver');

  const prefixes = [5, 4, 3, 2].flatMap(size => {
    const prefix = tokens.slice(0, size).join(' ');
    return prefix ? [prefix] : [];
  });

  return Array.from(
    new Set(
      [
        query.trim(),
        normalized,
        withoutQualifiers.join(' '),
        withoutTrailingVersion.join(' '),
        ...prefixes,
      ].flatMap(value => {
        const v = value.trim();
        return v ? [v] : [];
      })
    )
  );
}

function normalizeJioSaavnSong(song: JioSaavnSong, source: string, sourceLabel: string): NormalizedSong | null {
  const title = decodeHtmlEntities(song.name || song.title || '');
  const artist = normalizePrimaryArtists(song);

  if (!title || !artist) return null;

  const images = normalizeImages(song.image, song.imageUrl);
  const downloads = normalizeDownloads(song.downloadUrl);
  const streamUrl = bestAudio(downloads, song.streamUrl || '');
  const year = yearFrom(song.year) || yearFrom(song.releaseDate);
  const album = albumName(song.album);
  const saavnId = asString(song.id);
  const fallbackId = `${title}-${artist}-${album}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const externalUrl = asString(song.url);

  return {
    id: `${source}_${saavnId || fallbackId}`,
    saavnId,
    name: title,
    title,
    artist,
    primaryArtists: artist,
    album: {
      id: song.album && typeof song.album !== 'string' && song.album.id != null ? String(song.album.id) : null,
      name: album || null,
      url: albumUrl(song.album),
    },
    image: images,
    imageUrl: images[images.length - 1]?.url || '',
    downloadUrl: downloads,
    streamUrl,
    url: streamUrl || externalUrl,
    duration: asNumber(song.duration),
    year,
    releaseDate: song.releaseDate || null,
    language: song.language,
    genre: song.genre || song.language,
    source,
    sourceLabel,
    playbackType: streamUrl ? 'audio' : undefined,
    externalUrl,
  };
}

function extractJioSaavnData(json: any): { total: number; results: JioSaavnSong[] } {
  const data = json?.data || json;
  const results = Array.isArray(data?.results)
    ? data.results
    : Array.isArray(json?.results)
      ? json.results
      : Array.isArray(data)
        ? data
        : [];

  return {
    total: asNumber(data?.total) || asNumber(json?.total) || results.length,
    results,
  };
}

function normalizeSearchResults(payload: any, provider: ProviderConfig): NormalizedSong[] {
  const { results } = extractJioSaavnData(payload);

  return results.flatMap((song: JioSaavnSong) => {
    const norm = normalizeJioSaavnSong(song, provider.source, provider.label);
    return norm ? [norm] : [];
  });
}

function normalizeGlobalSearchResults(payload: any, provider: ProviderConfig): NormalizedSong[] {
  const combined = [
    ...(payload?.data?.topQuery?.results || []),
    ...(payload?.data?.songs?.results || []),
    ...(payload?.topQuery?.results || []),
    ...(payload?.songs?.results || []),
  ];

  if (combined.length === 0) {
    return normalizeSearchResults(payload, provider);
  }

  return combined.flatMap((song: JioSaavnSong) => {
    const norm = normalizeJioSaavnSong(song, provider.source, provider.label);
    return norm ? [norm] : [];
  });
}

async function fetchJson(url: string): Promise<any> {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      accept: 'application/json',
      'user-agent': 'MavrixfyAdmin/1.0 (+https://mavrixfy.site)',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function fetchProviderSearch(
  provider: ProviderConfig,
  query: string,
  pageNumber: number,
  limit: number
): Promise<ProviderQueryResult> {
  const url = new URL(provider.searchUrl);
  url.searchParams.set('query', query);
  url.searchParams.set('page', String(pageNumber));
  url.searchParams.set('limit', String(limit));

  const payload = await fetchJson(url.toString());

  return {
    provider: provider.source,
    label: provider.label,
    queryVariant: query,
    mode: 'search',
    total: extractJioSaavnData(payload).total,
    results: normalizeSearchResults(payload, provider),
  };
}

async function fetchProviderGlobal(provider: ProviderConfig, query: string): Promise<ProviderQueryResult> {
  const url = new URL(provider.globalUrl);
  url.searchParams.set('query', query);

  const payload = await fetchJson(url.toString());
  const results = normalizeGlobalSearchResults(payload, provider);

  return {
    provider: provider.source,
    label: provider.label,
    queryVariant: query,
    mode: 'global',
    total: results.length,
    results,
  };
}

async function fetchSongDetailsByIds(ids: string[]): Promise<Map<string, JioSaavnSong>> {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean))).slice(0, 12);
  if (uniqueIds.length === 0) return new Map();

  try {
    const url = new URL(SONG_DETAILS_URL);
    url.searchParams.set('ids', uniqueIds.join(','));
    const payload = await fetchJson(url.toString());

    const rawResults = payload?.data ?? payload?.songs ?? [];
    const songs = Array.isArray(rawResults)
      ? rawResults
      : Object.values(rawResults || {});

    const byId = new Map<string, JioSaavnSong>();
    for (const song of songs as JioSaavnSong[]) {
      const id = asString(song?.id);
      if (id) byId.set(id, song);
    }

    return byId;
  } catch {
    return new Map();
  }
}

function dedupeKey(song: NormalizedSong): string {
  return song.saavnId || [song.title, song.artist].map(comparable).join('|');
}

function sourceScore(song: NormalizedSong): number {
  if (song.source.startsWith('jiosaavn') && song.streamUrl) return 4;
  if (song.source.startsWith('jiosaavn')) return 2;
  if (song.streamUrl) return 1;
  return 0;
}

function dedupeSongs(songs: NormalizedSong[]): NormalizedSong[] {
  const byKey = new Map<string, NormalizedSong>();

  for (const song of songs) {
    const key = dedupeKey(song);
    const existing = byKey.get(key);

    if (!existing || sourceScore(song) > sourceScore(existing)) {
      byKey.set(key, song);
    }
  }

  return Array.from(byKey.values());
}

function releaseTime(song: NormalizedSong): number {
  if (!song.releaseDate) return song.year || 0;
  const time = new Date(song.releaseDate).getTime();
  return Number.isNaN(time) ? song.year || 0 : time;
}

function strIncludes(str: string, search: string): boolean {
  return str.indexOf(search) !== -1;
}

function searchScore(song: NormalizedSong, query: string): number {
  const original = comparable(query);
  const originalTokens = tokenize(query);
  const originalTokensSet = new Set(originalTokens);
  const baseTokens = originalTokens.filter(token => !QUERY_QUALIFIER_TOKENS.has(token));
  const qualifierTokens = originalTokens.filter(token => QUERY_QUALIFIER_TOKENS.has(token));
  const qualifierTokensSet = new Set(qualifierTokens);
  const title = comparable(song.title);
  const artist = comparable(song.artist);
  const album = comparable(song.album.name || '');
  const titleTokens = tokenize(song.title);
  const corpus = [title, artist, album, comparable(song.genre || ''), comparable(song.language || '')]
    .filter(Boolean)
    .join(' ');

  let score = sourceScore(song) * 10;

  if (title === original) score += 200;
  if (title.startsWith(original) && original) score += 120;
  if (strIncludes(corpus, original) && original) score += 30;
  if (baseTokens.length > 0 && baseTokens.every(token => strIncludes(title, token))) score += 20;
  if (baseTokens.length > 0 && baseTokens.every(token => strIncludes(corpus, token))) score += 16;

  for (const token of baseTokens) {
    if (title === token) score += 40;
    else if (strIncludes(title, token)) score += 24;
    else if (strIncludes(artist, token)) score += 8;
    else if (strIncludes(album, token)) score += 6;
    else if (strIncludes(corpus, token)) score += 4;
  }

  for (const token of qualifierTokens) {
    if (strIncludes(title, token)) score += 35;
    else if (strIncludes(album, token)) score += 18;
    else if (strIncludes(corpus, token)) score += 10;
    else score -= 10;
  }

  for (const token of titleTokens) {
    if (QUERY_QUALIFIER_TOKENS.has(token) && !qualifierTokensSet.has(token)) {
      score -= 35;
    }
  }

  for (const token of titleTokens) {
    const penalty = NOISY_RESULT_TOKEN_PENALTIES[token];
    if (penalty && !originalTokensSet.has(token)) score -= penalty;
  }

  return score;
}

function sortSongs(songs: NormalizedSong[], query: string): NormalizedSong[] {
  return songs.slice().sort((a, b) => {
    const byScore = searchScore(b, query) - searchScore(a, query);
    if (byScore !== 0) return byScore;

    const byYear = (b.year || 0) - (a.year || 0);
    if (byYear !== 0) return byYear;

    const bySource = sourceScore(b) - sourceScore(a);
    if (bySource !== 0) return bySource;

    return releaseTime(b) - releaseTime(a);
  });
}

async function hydrateSongsWithAudio(candidates: NormalizedSong[], limit: number): Promise<NormalizedSong[]> {
  const unresolvedIds = candidates.flatMap(song =>
    (!song.streamUrl && song.saavnId) ? [song.saavnId] : []
  );

  if (unresolvedIds.length === 0) return [];

  const detailsById = await fetchSongDetailsByIds(unresolvedIds.slice(0, limit));
  const hydrated: NormalizedSong[] = [];

  for (const candidate of candidates) {
    if (candidate.streamUrl || !candidate.saavnId) continue;

    const detail = detailsById.get(candidate.saavnId);
    if (!detail) continue;

    const normalized = normalizeJioSaavnSong(detail, candidate.source, candidate.sourceLabel);
    if (normalized?.streamUrl) hydrated.push(normalized);
  }

  return hydrated;
}

function shouldUseGlobalSearch(results: NormalizedSong[], query: string, limit: number): boolean {
  if (results.length < Math.min(limit, 10)) return true;
  const topResult = sortSongs(results, query)[0];
  return !topResult || searchScore(topResult, query) < 160;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = (searchParams.get('query') || searchParams.get('q') || '').trim();
  const page = Math.max(0, asNumber(searchParams.get('page')) || 0);
  const limit = Math.min(50, Math.max(1, asNumber(searchParams.get('limit')) || 20));
  const type = searchParams.get('type') || 'song';

  if (!query) {
    return NextResponse.json(
      { success: false, message: 'Search query is required' },
      { status: 400 }
    );
  }

  if (type === 'playlist') {
    const apiPage = page + 1;
    try {
      const url = `${SONG_API_BASE_URL}/search/playlists?query=${encodeURIComponent(query)}&page=${apiPage}&limit=${limit}`;
      const response = await fetch(url, {
        cache: 'no-store',
        headers: {
          accept: 'application/json',
          'user-agent': 'MavrixfyAdmin/1.0 (+https://mavrixfy.site)',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`Failed to search playlists from JioSaavn: ${response.statusText}`);
      }

      const payload = await response.json();
      const { results } = extractJioSaavnData(payload);
      
      const normalizedPlaylists = results.map((playlist: any) => {
        const title = decodeHtmlEntities(playlist.name || playlist.title || '');
        const artist = playlist.firstname || playlist.lastname || playlist.username || 'JioSaavn';
        const images = normalizeImages(playlist.image, playlist.imageUrl);
        return {
          id: `api_playlist_${playlist.id}`,
          saavnId: String(playlist.id),
          title,
          artist,
          album: playlist.description || 'Playlist',
          imageUrl: images[images.length - 1]?.url || '',
          songCount: asNumber(playlist.songCount) || asNumber(playlist.songsCount) || 0,
          type: 'playlist',
        };
      });

      return NextResponse.json({
        success: true,
        data: {
          total: normalizedPlaylists.length,
          start: page * limit + 1,
          results: normalizedPlaylists,
        },
      });
    } catch (error: any) {
      console.error('[playlist-search]', error);
      return NextResponse.json(
        { success: false, message: error.message || 'Failed to search playlists.' },
        { status: 500 }
      );
    }
  }

  if (type === 'album') {
    const apiPage = page + 1;
    try {
      const url = `${SONG_API_BASE_URL}/search/albums?query=${encodeURIComponent(query)}&page=${apiPage}&limit=${limit}`;
      const response = await fetch(url, {
        cache: 'no-store',
        headers: {
          accept: 'application/json',
          'user-agent': 'MavrixfyAdmin/1.0 (+https://mavrixfy.site)',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`Failed to search albums from JioSaavn: ${response.statusText}`);
      }

      const payload = await response.json();
      const { results } = extractJioSaavnData(payload);
      
      const normalizedAlbums = results.map((album: JioSaavnSong) => {
        const title = decodeHtmlEntities(album.name || album.title || '');
        const artist = normalizePrimaryArtists(album);
        const images = normalizeImages(album.image, album.imageUrl);
        return {
          id: `api_album_${album.id}`,
          saavnId: String(album.id),
          title,
          artist,
          album: title,
          imageUrl: images[images.length - 1]?.url || '',
          year: yearFrom(album.year),
          songCount: asNumber(album.songCount) || 0,
          type: 'album',
        };
      });

      return NextResponse.json({
        success: true,
        data: {
          total: normalizedAlbums.length,
          start: page * limit + 1,
          results: normalizedAlbums,
        },
      });
    } catch (error: any) {
      console.error('[album-search]', error);
      return NextResponse.json(
        { success: false, message: error.message || 'Failed to search albums.' },
        { status: 500 }
      );
    }
  }

  const apiPage = page + 1;
  const queryVariants = generateQueryVariants(query);
  const perVariantLimit = Math.min(Math.max(limit, 10), 25);

  const searchCalls = queryVariants.flatMap(queryVariant =>
    JIOSAAVN_PROVIDERS.map(provider => fetchProviderSearch(provider, queryVariant, apiPage, perVariantLimit))
  );

  const searchSettled = await Promise.allSettled(searchCalls);
  const searchFulfilled = searchSettled
    .filter((result): result is PromiseFulfilledResult<ProviderQueryResult> => result.status === 'fulfilled')
    .map(result => result.value);

  const warnings = searchSettled
    .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    .map(result => result.reason instanceof Error ? result.reason.message : 'Unknown provider error');

  const searchCandidates = dedupeSongs(searchFulfilled.flatMap(provider => provider.results));
  const hydratedSearchResults = await hydrateSongsWithAudio(sortSongs(searchCandidates, query), 8);

  let combinedResults = dedupeSongs([...searchCandidates, ...hydratedSearchResults]);
  let globalFulfilled: ProviderQueryResult[] = [];

  if (page === 0 && shouldUseGlobalSearch(combinedResults, query, limit)) {
    const globalQueryVariants = queryVariants.slice(0, Math.min(3, queryVariants.length));
    const globalCalls = globalQueryVariants.flatMap(queryVariant =>
      JIOSAAVN_PROVIDERS.map(provider => fetchProviderGlobal(provider, queryVariant))
    );

    const globalSettled = await Promise.allSettled(globalCalls);
    globalFulfilled = globalSettled
      .filter((result): result is PromiseFulfilledResult<ProviderQueryResult> => result.status === 'fulfilled')
      .map(result => result.value);

    warnings.push(
      ...globalSettled
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map(result => result.reason instanceof Error ? result.reason.message : 'Unknown provider error')
    );

    const globalCandidates = dedupeSongs(globalFulfilled.flatMap(provider => provider.results));
    const hydratedGlobalResults = await hydrateSongsWithAudio(sortSongs(globalCandidates, query), 12);
    combinedResults = dedupeSongs([...combinedResults, ...globalCandidates, ...hydratedGlobalResults]);
  }

  const results = sortSongs(combinedResults, query)
    .filter(song => Boolean(song.streamUrl))
    .slice(0, limit);

  return NextResponse.json({
    success: true,
    data: {
      total: results.length,
      start: page * limit + 1,
      results,
    },
    providers: [...searchFulfilled, ...globalFulfilled].map(provider => ({
      source: provider.provider,
      label: provider.label,
      queryVariant: provider.queryVariant,
      mode: provider.mode,
      total: provider.total,
      returned: provider.results.length,
    })),
    warnings,
  });
}
