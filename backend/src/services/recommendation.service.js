import crypto from 'crypto';
import admin from '../config/firebase.js';
import * as jiosaavnService from './jiosaavn.service.js';

const db = admin.firestore();

export const RECOMMENDATION_EVENT_TYPES = new Set([
  'song_play',
  'song_complete',
  'song_skip',
  'song_replay',
  'playlist_save',
  'artist_follow',
  'search_query',
  'session_start',
  'session_end',
  'share_song',
]);

const EVENT_COLLECTION = 'recommendation_events';
const PROFILE_COLLECTION = 'recommendation_profiles';
const CACHE_COLLECTION = 'recommendation_feed_cache';
const FEED_CACHE_VERSION = 4;
const FEED_CACHE_TTL_MS = 15 * 60 * 1000;
const SMART_REFRESH_MS = 30 * 60 * 1000;
const EVENT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_PROFILE_EVENTS = 80;
const MAX_RECENT_EXPOSURES = 120;
const SECTION_LIMIT = 12;

const SECTION_ORDER = [
  'continueListening',
  'recommendedForYou',
  'freshDiscoveries',
  'popularNearYou',
  'basedOnActivity',
  'newReleases',
];

const SECTION_META = {
  continueListening: {
    title: 'Continue Listening',
    subtitle: 'Pick up the songs you touched recently',
  },
  recommendedForYou: {
    title: 'Recommended For You',
    subtitle: 'Ranked from your listening activity',
  },
  freshDiscoveries: {
    title: 'Fresh Discoveries',
    subtitle: 'New tracks outside your recent loop',
  },
  popularNearYou: {
    title: 'Popular Near You',
    subtitle: 'Regional momentum and trending picks',
  },
  basedOnActivity: {
    title: 'Based On Your Activity',
    subtitle: 'Familiar sounds with room to wander',
  },
  newReleases: {
    title: 'New Releases',
    subtitle: 'Fresh drops matching your feed',
  },
};

const SOURCE_WEIGHTS = {
  liked: 0.94,
  history: 0.88,
  catalog: 0.72,
  trending: 0.68,
  fresh: 0.64,
  regional: 0.6,
  jiosaavn: 0.58,
};

const SCORE_WEIGHTS = {
  personalization: 0.4,
  engagement: 0.2,
  freshness: 0.15,
  diversity: 0.1,
  exploration: 0.1,
  regional: 0.05,
};

const EVENT_WEIGHTS = {
  song_play: 1,
  song_complete: 3,
  song_skip: -2,
  song_replay: 4,
  playlist_save: 3,
  share_song: 2,
  search_query: 1,
  artist_follow: 3,
};

const asArray = (value) => Array.isArray(value) ? value : [];
const clamp01 = (value) => Math.max(0, Math.min(Number(value) || 0, 1));
const lower = (value) => String(value || '').trim().toLowerCase();
const nowIso = () => new Date().toISOString();

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Date.parse(value) || 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  return 0;
};

const splitTokens = (...values) => {
  return values
    .flatMap((value) => String(value || '').split(/[\s,/|]+/))
    .map((value) => lower(value).replace(/[^a-z0-9_-]/g, ''))
    .filter((value) => value.length > 1)
    .slice(0, 24);
};

const stableId = (source, rawId, fallback) => {
  const safeId = String(rawId || fallback || '').trim();
  if (safeId) return `${source}:${safeId.replace(/\s+/g, '_')}`;
  return `${source}:${crypto.createHash('sha1').update(String(fallback || source)).digest('hex').slice(0, 16)}`;
};

const getImageUrl = (value) => {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return '';
  return value.at(-1)?.url || value.at(0)?.url || value.at(-1)?.link || '';
};

const getAudioUrl = (song) => {
  if (typeof song?.audioUrl === 'string') return song.audioUrl;
  if (typeof song?.streamUrl === 'string') return song.streamUrl;
  if (!Array.isArray(song?.downloadUrl)) return '';
  return song.downloadUrl.at(-1)?.url || song.downloadUrl.at(0)?.url || '';
};

const getArtistName = (song) => {
  if (typeof song?.artist === 'string') return song.artist;
  if (typeof song?.primaryArtists === 'string') return song.primaryArtists;
  if (Array.isArray(song?.artists?.primary)) {
    return song.artists.primary.map((artist) => artist?.name).filter(Boolean).join(', ');
  }
  return 'Unknown Artist';
};

const getAlbumName = (song) => {
  if (typeof song?.album === 'string') return song.album;
  if (typeof song?.album?.name === 'string') return song.album.name;
  if (typeof song?.albumName === 'string') return song.albumName;
  return '';
};

const INDIAN_DISCOVERY_TERMS = /\b(india|indian|hindi|bollywood|punjabi|tamil|telugu|malayalam|kannada|marathi|gujarati|bengali|bhojpuri|rajasthani|sufi|ghazal|desi)\b/i;

const hasIndianDiscoverySignal = (item) => {
  return INDIAN_DISCOVERY_TERMS.test([
    item.title,
    item.subtitle,
    item.artist,
    item.album,
    item.language,
    item.genre,
    ...asArray(item.moodTags),
  ].filter(Boolean).join(' '));
};

export const normalizeRecommendationItem = (raw, source = 'catalog', kind = 'song') => {
  if (!raw) return null;

  if (kind === 'playlist') {
    const rawId = raw._id || raw.id;
    const title = raw.name || raw.title;
    if (!rawId || !title) return null;

    return {
      id: stableId(source, rawId, title),
      contentId: String(rawId),
      kind: 'playlist',
      source,
      title,
      subtitle: raw.description || raw.language || `${Number(raw.songCount || raw.songs?.length || 0)} songs`,
      imageUrl: raw.imageUrl || getImageUrl(raw.image),
      routePath: source === 'jiosaavn' || raw.type === 'jiosaavn-playlist'
        ? `/jiosaavn/playlist/${rawId}`
        : `/playlist/${rawId}`,
      playlist: {
        ...raw,
        _id: raw._id || raw.id,
        imageUrl: raw.imageUrl || getImageUrl(raw.image),
      },
      artist: '',
      album: '',
      language: raw.language || '',
      year: Number(raw.year || 0) || null,
      playCount: Number(raw.playCount || 0) || 0,
      createdAt: raw.createdAt || raw.releaseDate || null,
    };
  }

  const contentId = raw._id || raw.id || raw.songId;
  const title = raw.title || raw.name;
  const audioUrl = getAudioUrl(raw);
  if (!contentId || !title || !audioUrl) return null;

  const artist = getArtistName(raw);
  const album = getAlbumName(raw);
  return {
    id: stableId(source, contentId, `${title}|${artist}`),
    contentId: String(contentId),
    kind: 'song',
    source,
    title,
    subtitle: artist,
    imageUrl: raw.imageUrl || getImageUrl(raw.image),
    routePath: `/songs/${String(contentId).replace(/^jiosaavn_/, '')}`,
    song: {
      _id: String(contentId),
      title,
      artist,
      album: album || null,
      albumId: raw.albumId || raw.album?.id || album || null,
      imageUrl: raw.imageUrl || getImageUrl(raw.image),
      audioUrl,
      streamUrl: raw.streamUrl || audioUrl,
      duration: Number(raw.duration || 0),
      createdAt: raw.createdAt || raw.releaseDate || nowIso(),
      updatedAt: raw.updatedAt || raw.createdAt || raw.releaseDate || nowIso(),
      source,
    },
    artist,
    album,
    language: raw.language || '',
    year: Number(raw.year || 0) || null,
    playCount: Number(raw.playCount || 0) || 0,
    createdAt: raw.createdAt || raw.releaseDate || null,
    moodTags: asArray(raw.moodTags),
    genre: raw.genre || '',
    audioFeatures: raw.audioFeatures || null,
  };
};

const scoreTerms = (terms = {}, item) => {
  const haystack = splitTokens(item.title, item.artist, item.album, item.genre, item.language, ...asArray(item.moodTags));
  if (haystack.length === 0) return 0;
  const total = haystack.reduce((sum, token) => sum + Math.max(Number(terms[token]) || 0, 0), 0);
  return clamp01(total / Math.max(haystack.length * 4, 1));
};

const scoreFreshness = (item, at = Date.now()) => {
  const createdAt = toMillis(item.createdAt);
  if (!createdAt) return item.source === 'fresh' ? 0.8 : 0.45;
  const ageDays = Math.max(0, at - createdAt) / (24 * 60 * 60 * 1000);
  return clamp01(1 - (ageDays / 365));
};

const scoreEngagement = (item) => {
  if (item.source === 'liked') return 1;
  if (item.source === 'history') return 0.88;
  if (item.playCount > 0) return clamp01(Math.log10(item.playCount + 1) / 7);
  return SOURCE_WEIGHTS[item.source] || 0.48;
};

export const scoreCandidate = (item, profile = {}, context = {}) => {
  const personalization = item.source === 'liked' || item.source === 'history'
    ? 1
    : scoreTerms(profile.preferenceTerms, item);
  const engagement = scoreEngagement(item);
  const freshness = scoreFreshness(item, context.now || Date.now());
  const diversity = clamp01(context.diversity ?? 1);
  const exploration = item.source === 'fresh' || item.source === 'jiosaavn' ? 1 : item.source === 'trending' ? 0.72 : 0.38;
  const regional = item.source === 'regional' || (context.region && lower(item.language).includes(lower(context.region)))
    ? 1
    : 0.35;

  return Number((
    personalization * SCORE_WEIGHTS.personalization +
    engagement * SCORE_WEIGHTS.engagement +
    freshness * SCORE_WEIGHTS.freshness +
    diversity * SCORE_WEIGHTS.diversity +
    exploration * SCORE_WEIGHTS.exploration +
    regional * SCORE_WEIGHTS.regional
  ).toFixed(6));
};

const trimMap = (value, maxEntries = 80) => {
  return Object.fromEntries(
    Object.entries(value || {})
      .sort(([, a], [, b]) => Math.abs(Number(b) || 0) - Math.abs(Number(a) || 0))
      .slice(0, maxEntries)
  );
};

const canonicalFingerprintText = (value) => {
  return lower(value)
    .replace(/&amp;/g, '&')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
};

const fingerprint = (item) => {
  const title = canonicalFingerprintText(item.title);
  const artist = canonicalFingerprintText(item.artist || item.subtitle);
  const album = canonicalFingerprintText(item.album);

  // Providers commonly assign different IDs to the same JioSaavn result.
  // Prefer visible identity for songs/playlists, then fall back to content ID.
  if (title && artist) return `${item.kind}|${title}|${artist}`;
  if (title && album) return `${item.kind}|${title}|${album}`;
  if (title && item.kind === 'playlist') return `${item.kind}|${title}`;
  return lower(`${item.kind}|${item.contentId}|${item.title}|${item.artist || item.subtitle}`);
};

export const dedupeCandidates = (items) => {
  const byFingerprint = new Map();
  for (const item of asArray(items)) {
    if (!item?.id) continue;
    const key = fingerprint(item);
    const current = byFingerprint.get(key);
    if (!current || Number(item.score || 0) > Number(current.score || 0)) {
      byFingerprint.set(key, item);
    }
  }
  return [...byFingerprint.values()];
};

const getCooldownKey = (value) => lower(value).replace(/\s+/g, '_');

const isCooledDown = (item, exposures, now) => {
  if (item.kind !== 'song') return false;

  const songAt = Number(exposures.songs?.[getCooldownKey(item.contentId)] || 0);
  const artistAt = Number(exposures.artists?.[getCooldownKey(item.artist)] || 0);
  const albumAt = Number(exposures.albums?.[getCooldownKey(item.album)] || 0);

  return (
    (songAt > 0 && now - songAt < 24 * 60 * 60 * 1000) ||
    (artistAt > 0 && now - artistAt < 2 * 60 * 60 * 1000) ||
    (albumAt > 0 && now - albumAt < 6 * 60 * 60 * 1000)
  );
};

export const filterDiverseCandidates = (items, exposures = {}, limit = SECTION_LIMIT, now = Date.now()) => {
  const result = [];
  const skipped = [];
  const artistCounts = new Map();
  const albumCounts = new Map();
  const languageCounts = new Map();

  for (const item of dedupeCandidates(items).sort((a, b) => Number(b.score || 0) - Number(a.score || 0))) {
    if (isCooledDown(item, exposures, now)) {
      skipped.push(item);
      continue;
    }

    const artistKey = getCooldownKey(item.artist);
    const albumKey = getCooldownKey(item.album);
    const languageKey = getCooldownKey(item.language);
    const tooMuchArtist = artistKey && (artistCounts.get(artistKey) || 0) >= 2;
    const tooMuchAlbum = albumKey && (albumCounts.get(albumKey) || 0) >= 2;
    const tooMuchLanguage = languageKey && (languageCounts.get(languageKey) || 0) >= Math.ceil(limit * 0.7);

    if (tooMuchArtist || tooMuchAlbum || tooMuchLanguage) {
      skipped.push(item);
      continue;
    }

    result.push(item);
    if (artistKey) artistCounts.set(artistKey, (artistCounts.get(artistKey) || 0) + 1);
    if (albumKey) albumCounts.set(albumKey, (albumCounts.get(albumKey) || 0) + 1);
    if (languageKey) languageCounts.set(languageKey, (languageCounts.get(languageKey) || 0) + 1);
    if (result.length >= limit) return result;
  }

  for (const item of skipped) {
    if (result.length >= limit) break;
    if (!result.some((selected) => selected.id === item.id)) result.push(item);
  }

  return result;
};

const exposureStateFromItems = (items, at) => {
  const exposures = { songs: {}, artists: {}, albums: {} };
  for (const item of items) {
    if (item.kind !== 'song') continue;
    if (item.contentId) exposures.songs[getCooldownKey(item.contentId)] = at;
    if (item.artist) exposures.artists[getCooldownKey(item.artist)] = at;
    if (item.album) exposures.albums[getCooldownKey(item.album)] = at;
  }
  return exposures;
};

const mergeBoundedMap = (left = {}, right = {}, maxEntries = MAX_RECENT_EXPOSURES) => {
  return Object.fromEntries(
    Object.entries({ ...left, ...right })
      .sort(([, a], [, b]) => Number(b || 0) - Number(a || 0))
      .slice(0, maxEntries)
  );
};

const formatSection = (id, items) => ({
  id,
  ...SECTION_META[id],
  items: items.map(({ score, ...item }) => item),
});

const unwrapSearchResults = (response) => {
  const candidates = response?.data?.results || response?.results || response?.data || [];
  return Array.isArray(candidates) ? candidates : [];
};

const normalizeEventPayload = (payload = {}) => {
  const eventType = String(payload.eventType || '').trim();
  if (!RECOMMENDATION_EVENT_TYPES.has(eventType)) {
    throw Object.assign(new Error('Unsupported recommendation event type'), { statusCode: 400 });
  }

  const sessionId = String(payload.sessionId || '').trim();
  if (!sessionId) {
    throw Object.assign(new Error('sessionId is required'), { statusCode: 400 });
  }

  const rawItem = payload.item && typeof payload.item === 'object' ? payload.item : {};
  const item = rawItem.kind
    ? {
      kind: rawItem.kind === 'playlist' ? 'playlist' : 'song',
      contentId: String(rawItem.contentId || rawItem.id || '').trim(),
      source: String(rawItem.source || 'catalog').trim(),
      title: String(rawItem.title || '').trim(),
      artist: String(rawItem.artist || rawItem.subtitle || '').trim(),
      album: String(rawItem.album || '').trim(),
      language: String(rawItem.language || '').trim(),
      genre: String(rawItem.genre || '').trim(),
      moodTags: asArray(rawItem.moodTags).map(String).slice(0, 8),
      song: rawItem.song || null,
      playlist: rawItem.playlist || null,
      imageUrl: String(rawItem.imageUrl || '').trim(),
    }
    : null;

  if (
    eventType !== 'search_query' &&
    !eventType.startsWith('session_') &&
    (!item?.contentId || !item?.kind)
  ) {
    throw Object.assign(new Error('item identity is required for this event'), { statusCode: 400 });
  }

  return {
    eventType,
    sessionId,
    occurredAt: toMillis(payload.occurredAt) ? new Date(toMillis(payload.occurredAt)).toISOString() : nowIso(),
    item,
    query: String(payload.query || '').trim().slice(0, 160),
    context: {
      progressSeconds: Math.max(0, Number(payload.context?.progressSeconds || 0)),
      durationSeconds: Math.max(0, Number(payload.context?.durationSeconds || 0)),
      completionRatio: clamp01(payload.context?.completionRatio),
      position: Number(payload.context?.position || 0) || null,
      surface: String(payload.context?.surface || '').trim().slice(0, 60),
    },
  };
};

const applyEventToProfile = (profile = {}, event) => {
  const terms = { ...(profile.preferenceTerms || {}) };
  const eventWeight = EVENT_WEIGHTS[event.eventType] || 0;
  const tokens = event.eventType === 'search_query'
    ? splitTokens(event.query)
    : splitTokens(event.item?.title, event.item?.artist, event.item?.album, event.item?.language, event.item?.genre, ...asArray(event.item?.moodTags));

  for (const token of tokens) {
    terms[token] = Number(((Number(terms[token]) || 0) + eventWeight).toFixed(3));
  }

  const recentEvents = [
    {
      eventType: event.eventType,
      sessionId: event.sessionId,
      occurredAt: event.occurredAt,
      item: event.item,
      query: event.query || '',
      context: event.context,
    },
    ...asArray(profile.recentEvents),
  ].slice(0, MAX_PROFILE_EVENTS);

  const recentSongEvents = recentEvents.filter((entry) => entry.item?.kind === 'song');
  const skipTimes = recentEvents
    .filter((entry) => entry.eventType === 'song_skip')
    .map((entry) => toMillis(entry.occurredAt))
    .filter((time) => time > Date.now() - 10 * 60 * 1000);

  return {
    ...profile,
    preferenceTerms: trimMap(terms),
    recentEvents,
    recentSongs: recentSongEvents.slice(0, 30),
    activeSessionId: event.eventType === 'session_end' ? null : event.sessionId,
    lastSessionId: event.sessionId,
    skipBurstUntil: skipTimes.length >= 3 ? Date.now() + 10 * 60 * 1000 : Number(profile.skipBurstUntil || 0),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
};

export const recordRecommendationEvent = async (userId, payload) => {
  const event = normalizeEventPayload(payload);
  const profileRef = db.collection(PROFILE_COLLECTION).doc(userId);
  const eventRef = db.collection(EVENT_COLLECTION).doc();
  const eventExpiry = admin.firestore.Timestamp.fromMillis(Date.now() + EVENT_RETENTION_MS);

  await db.runTransaction(async (transaction) => {
    const profileSnap = await transaction.get(profileRef);
    const profile = profileSnap.exists ? profileSnap.data() : {};
    const nextProfile = applyEventToProfile(profile, event);

    transaction.set(eventRef, {
      ...event,
      userId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: eventExpiry,
    });
    transaction.set(profileRef, {
      userId,
      createdAt: profile.createdAt || admin.firestore.FieldValue.serverTimestamp(),
      ...nextProfile,
    }, { merge: true });
  });

  return event;
};

const loadProfile = async (userId) => {
  const snap = await db.collection(PROFILE_COLLECTION).doc(userId).get();
  return snap.exists ? snap.data() : { userId, preferenceTerms: {}, recentEvents: [], exposures: {} };
};

const loadCatalogCandidates = async () => {
  const playlistsSnap = await db.collection('playlists').where('isPublic', '==', true).orderBy('updatedAt', 'desc').limit(30).get()
    .catch(() => db.collection('playlists').where('isPublic', '==', true).limit(30).get());

  return {
    playlists: playlistsSnap.docs.flatMap((doc) => {
      const normalized = normalizeRecommendationItem({ _id: doc.id, ...doc.data() }, 'catalog', 'playlist');
      return normalized ? [normalized] : [];
    }),
  };
};

const withTimeout = (promise, ms) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))
]);

const loadJioSaavnCandidates = async () => {
  const settled = await Promise.allSettled([
    withTimeout(jiosaavnService.searchPlaylists('trending hindi bollywood indian playlists', 16), 6500),
    withTimeout(jiosaavnService.searchPlaylists('new hindi bollywood indian playlists', 16), 6500),
    withTimeout(jiosaavnService.searchPlaylists('punjabi gujarati english hindi trending playlists', 16), 6500),
    withTimeout(jiosaavnService.searchPlaylists('hindi punjabi gujarati english mood playlists', 16), 6500),
  ]);

  const [trending, fresh, regional, playlists] = settled.map((result) => result.status === 'fulfilled' ? result.value : null);
  const normalizeJioPlaylist = (raw, source) => {
    return normalizeRecommendationItem({ ...raw, type: 'jiosaavn-playlist' }, source, 'playlist');
  };

  return {
    trending: unwrapSearchResults(trending).flatMap((raw) => {
      const normalized = normalizeJioPlaylist(raw, 'trending');
      return normalized ? [normalized] : [];
    }),
    fresh: unwrapSearchResults(fresh).flatMap((raw) => {
      const normalized = normalizeJioPlaylist(raw, 'fresh');
      return normalized ? [normalized] : [];
    }),
    regional: unwrapSearchResults(regional).flatMap((raw) => {
      const normalized = normalizeJioPlaylist(raw, 'regional');
      return normalized ? [normalized] : [];
    }),
    playlists: unwrapSearchResults(playlists).flatMap((raw) => {
      const normalized = normalizeJioPlaylist(raw, 'jiosaavn');
      return normalized ? [normalized] : [];
    }),
  };
};

const playlistCandidatesFromProfile = (profile) => {
  return asArray(profile.recentEvents).flatMap((entry) => {
    if (entry.item?.kind !== 'playlist') return [];

    const rawPlaylist = entry.item.playlist || {
      _id: entry.item.contentId,
      id: entry.item.contentId,
      name: entry.item.title,
      description: entry.item.subtitle,
      imageUrl: entry.item.imageUrl,
      language: entry.item.language,
    };
    const source = entry.item.source || 'catalog';
    const normalized = normalizeRecommendationItem(rawPlaylist, source, 'playlist');
    return normalized ? [normalized] : [];
  });
};

const scorePool = (pool, profile, context) => {
  return dedupeCandidates(pool).map((item) => ({ ...item, score: scoreCandidate(item, profile, context) }));
};

const pickFreshUnheard = (items, profile, limit) => {
  const recentSongIds = new Set(asArray(profile.recentSongs).map((entry) => entry.item?.contentId).filter(Boolean));
  return filterDiverseCandidates(items.filter((item) => !recentSongIds.has(item.contentId)), profile.exposures, limit);
};

export const assembleDistinctSections = (definitions, exposures = {}) => {
  const shown = new Set();

  return asArray(definitions).flatMap(({ id, items }) => {
    const unseenItems = dedupeCandidates(items).filter((item) => !shown.has(fingerprint(item)));
    const selected = filterDiverseCandidates(unseenItems, exposures, SECTION_LIMIT);

    for (const item of selected) shown.add(fingerprint(item));
    return selected.length > 0 ? [formatSection(id, selected)] : [];
  });
};

const ratioMix = (pools, limit = SECTION_LIMIT) => {
  const allocations = [
    ['familiar', Math.ceil(limit * 0.5)],
    ['trending', Math.ceil(limit * 0.2)],
    ['fresh', Math.ceil(limit * 0.15)],
    ['experimental', Math.ceil(limit * 0.1)],
    ['regional', Math.max(1, Math.floor(limit * 0.05))],
  ];

  const selected = [];
  for (const [key, count] of allocations) selected.push(...asArray(pools[key]).slice(0, count));
  selected.push(...Object.values(pools).flat());
  return selected.slice(0, limit * 3);
};

const shouldRegenerateFeed = (cacheData, profile, sessionId) => {
  if (!cacheData?.feed || toMillis(cacheData.expiresAt) <= Date.now()) return true;
  if (Number(cacheData.version || 0) !== FEED_CACHE_VERSION) return true;
  if (Number(profile.skipBurstUntil || 0) > Date.now()) return true;
  if (sessionId && cacheData.sessionId && sessionId !== cacheData.sessionId) return true;
  return Date.now() - toMillis(cacheData.generatedAt) > SMART_REFRESH_MS;
};

export const buildRecommendationFeed = async (userId, options = {}) => {
  const profile = await loadProfile(userId);
  const cacheRef = db.collection(CACHE_COLLECTION).doc(userId);
  const cacheSnap = await cacheRef.get();
  const cacheData = cacheSnap.exists ? cacheSnap.data() : null;
  const sessionId = String(options.sessionId || profile.activeSessionId || '').trim();

  if (!options.forceRefresh && !shouldRegenerateFeed(cacheData, profile, sessionId)) {
    return { ...cacheData.feed, cacheStatus: 'hit' };
  }

  const [catalogSettled, jioSettled] = await Promise.allSettled([
    loadCatalogCandidates(),
    loadJioSaavnCandidates(),
  ]);

  const catalog = catalogSettled.status === 'fulfilled' ? catalogSettled.value : { playlists: [] };
  const jio = jioSettled.status === 'fulfilled' ? jioSettled.value : { trending: [], fresh: [], regional: [], playlists: [] };
  const context = { now: Date.now(), region: options.region || '' };
  const catalogIndianPlaylists = catalog.playlists.filter(hasIndianDiscoverySignal);
  const profilePlaylists = playlistCandidatesFromProfile(profile);

  // The signed-in homepage is playlist-first. Song interactions still shape
  // taste, but raw songs stay out of homepage shelves.
  const familiar = scorePool([...profilePlaylists, ...catalogIndianPlaylists], profile, context);
  const trending = scorePool([...jio.trending, ...jio.playlists, ...catalogIndianPlaylists], profile, context);
  const fresh = scorePool(jio.fresh, profile, context);
  const regional = scorePool(jio.regional, profile, { ...context, region: options.region || 'regional' });
  const experimental = scorePool([...jio.playlists, ...jio.fresh, ...catalogIndianPlaylists], profile, context);
  const recommended = filterDiverseCandidates(ratioMix({ familiar, trending, fresh, experimental, regional }), profile.exposures, SECTION_LIMIT);
  const basedOnActivity = filterDiverseCandidates([...familiar, ...experimental], profile.exposures, SECTION_LIMIT * 3);
  const sections = assembleDistinctSections([
    { id: 'recommendedForYou', items: recommended },
    { id: 'freshDiscoveries', items: pickFreshUnheard(fresh, profile, SECTION_LIMIT * 3) },
    { id: 'popularNearYou', items: filterDiverseCandidates([...regional, ...trending], profile.exposures, SECTION_LIMIT * 3) },
    { id: 'basedOnActivity', items: basedOnActivity },
    { id: 'newReleases', items: pickFreshUnheard(fresh, profile, SECTION_LIMIT * 3) },
  ], profile.exposures);

  const generatedAt = nowIso();
  const feed = {
    generatedAt,
    cacheStatus: cacheData?.feed ? 'refresh' : 'miss',
    sectionOrder: SECTION_ORDER.filter((id) => sections.some((section) => section.id === id)),
    sections,
  };

  const allShownItems = sections.flatMap((section) => section.items);
  const nextExposures = exposureStateFromItems(allShownItems, Date.now());
  await Promise.all([
    cacheRef.set({
      userId,
      version: FEED_CACHE_VERSION,
      feed,
      sessionId: sessionId || null,
      generatedAt: admin.firestore.Timestamp.fromDate(new Date(generatedAt)),
      expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + FEED_CACHE_TTL_MS),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true }),
    db.collection(PROFILE_COLLECTION).doc(userId).set({
      userId,
      exposures: {
        songs: mergeBoundedMap(profile.exposures?.songs, nextExposures.songs),
        artists: mergeBoundedMap(profile.exposures?.artists, nextExposures.artists),
        albums: mergeBoundedMap(profile.exposures?.albums, nextExposures.albums),
      },
      lastFeedGeneratedAt: admin.firestore.Timestamp.fromDate(new Date(generatedAt)),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true }),
  ]);

  return feed;
};

export const recommendationTestInternals = {
  shouldRegenerateFeed,
  normalizeEventPayload,
  applyEventToProfile,
  scoreFreshness,
};
