import admin from '../../config/firebase.js';
import { searchSongs } from '../jiosaavn.service.js';
import {
  formatSong,
  isLowQualityTrack,
} from './playlistGenerator.js';

const PLAYLIST_SIZE = 20;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_MOOD_TIMEOUT_MS || 15000);
const MIN_TARGET_MATCH_SCORE = 58;
const TARGET_SONG_COUNT = 48;
const MAX_QUERY_FALLBACKS = 18;
const MAX_PROVIDER_FALLBACK_QUERIES = 12;

const getGeminiApiKey = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';
const getGeminiModel = () => process.env.GEMINI_MOOD_MODEL || DEFAULT_GEMINI_MODEL;

const withDeadline = async (promise, label, timeoutMs = GEMINI_TIMEOUT_MS) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = new Error(`${label} timed out`);
      error.code = 'deadline-exceeded';
      reject(error);
    }, timeoutMs);

    promise
      .then(resolve, reject)
      .finally(() => clearTimeout(timer));
  });
};

const extractJsonObject = (text) => {
  if (!text || typeof text !== 'string') {
    throw new Error('Gemini returned an empty response');
  }

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced?.[1] || text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Gemini response did not include JSON');
  }

  return JSON.parse(raw.slice(start, end + 1));
};

const normalizeText = (value) => String(value || '').trim();

const buildGeminiPrompt = (moodText) => `
You are the music intelligence layer for Mavrixfy, a playlist app.

Task:
Create a real-world music discovery plan for a mood playlist. Use Google Search grounding to identify actual songs and artists people are currently listening to. Prefer mainstream songs likely to be available on Indian music services and strongly match the user's mood.

User mood:
"${moodText}"

Rules:
- Return only valid JSON. No markdown.
- Candidate songs must be real released songs by real artists.
- Prioritize exact song titles, not genres, moods, playlists, albums, videos, or search categories.
- Prefer current or recently trending tracks unless the user explicitly asks for old songs.
- Strongly prefer songs likely to be available on JioSaavn or major Indian streaming services.
- Include a mix of Hindi, English, and globally popular tracks when appropriate.
- Avoid fake songs, remixes, covers, karaoke, lofi edits, slowed/reverb edits, sped-up edits, mashups, DJ mixes, instrumentals, and compilation album names.
- Do not suggest devotional, kids, regional-only, old classics, or sad songs unless the mood explicitly asks for them.
- Do not invent "mood playlist" names as songs. Every targetSong title must be an actual track title.
- Do not include unsafe or hateful content.
- Keep titles and artists concise, exactly as a user would search them.
- searchQueries must include exact song/artist style queries, for example "song title artist", not broad strings like "happy songs" or "party playlist".

JSON schema:
{
  "playlistName": "short playlist name",
  "emotion": "one lowercase emotion",
  "context": "one lowercase context or null",
  "searchQueries": ["query string", "query string"],
  "targetSongs": [
    { "title": "song title", "artist": "primary artist", "reason": "short mood fit" }
  ]
}

Return ${TARGET_SONG_COUNT} targetSongs and 12 searchQueries.
`;

const buildGeminiRepairPrompt = (moodText, resolvedSongs, rejectedTargets) => `
You are repairing a Mavrixfy mood playlist plan.

User mood:
"${moodText}"

Already resolved playable songs:
${resolvedSongs.map((song) => `- ${song.title} - ${song.artist}`).join('\n') || '- none'}

Songs that did not resolve on JioSaavn:
${rejectedTargets.slice(0, 32).map((song) => `- ${song.title} - ${song.artist}`).join('\n') || '- none'}

Task:
Return replacement songs that are real, mainstream, mood-matching, and likely available on JioSaavn or Indian streaming services. Do not repeat already resolved songs.

Rules:
- Return only valid JSON. No markdown.
- Every targetSong title must be an actual released song title.
- Prefer exact popular tracks over obscure tracks.
- Avoid remixes, covers, lofi, sped-up, slowed/reverb, DJ edits, mashups, karaoke, instrumentals, and compilations.
- Keep artist names concise.

JSON schema:
{
  "playlistName": "short playlist name",
  "emotion": "one lowercase emotion",
  "context": "one lowercase context or null",
  "searchQueries": ["song title artist"],
  "targetSongs": [
    { "title": "song title", "artist": "primary artist", "reason": "short mood fit" }
  ]
}

Return 36 replacement targetSongs and 8 exact song/artist searchQueries.
`;

const callGemini = async (prompt, label) => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw createGeminiMoodError('GEMINI_API_KEY is not configured');
  }

  const model = getGeminiModel();
  const response = await withDeadline(fetch(
    `${GEMINI_API_URL}/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        tools: [
          {
            google_search: {},
          },
        ],
        generationConfig: {
          temperature: 0.65,
          topP: 0.9,
          maxOutputTokens: 4096,
        },
      }),
    }
  ), label);

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Gemini request failed (${response.status}): ${body.slice(0, 240)}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('\n') || '';
  const plan = extractJsonObject(text);
  const grounding = data.candidates?.[0]?.groundingMetadata || null;
  return { plan, grounding };
};

const normalizeGeminiPlan = (plan, grounding) => {
  return {
    playlistName: normalizeText(plan.playlistName),
    emotion: normalizeText(plan.emotion).toLowerCase() || 'mood',
    context: normalizeText(plan.context).toLowerCase() || null,
    searchQueries: Array.isArray(plan.searchQueries) ? plan.searchQueries.map(normalizeText).filter(Boolean) : [],
    targetSongs: Array.isArray(plan.targetSongs)
      ? plan.targetSongs
          .map((song) => ({
            title: normalizeText(song.title),
            artist: normalizeText(song.artist),
            reason: normalizeText(song.reason),
          }))
          .filter((song) => song.title && song.artist)
      : [],
    grounding,
  };
};

const callGeminiPlanner = async (moodText) => {
  const { plan, grounding } = await callGemini(buildGeminiPrompt(moodText), 'Gemini mood planner');
  return normalizeGeminiPlan(plan, grounding);
};

const callGeminiRepairPlanner = async (moodText, resolvedSongs, rejectedTargets) => {
  const { plan, grounding } = await callGemini(
    buildGeminiRepairPrompt(moodText, resolvedSongs, rejectedTargets),
    'Gemini mood repair planner'
  );
  return normalizeGeminiPlan(plan, grounding);
};

const scoreCandidateMatch = (song, target) => {
  const normalizedSongTitle = normalizeComparable(song.title);
  const normalizedSongArtist = normalizeComparable(song.artist);
  const title = normalizeComparable(target.title);
  const artist = normalizeComparable(target.artist);
  const haystack = `${normalizedSongTitle} ${normalizedSongArtist}`;
  let score = 0;

  if (normalizedSongTitle === title) score += 80;
  else if (normalizedSongTitle.includes(title) || title.includes(normalizedSongTitle)) score += 55;
  else score += tokenOverlapScore(normalizedSongTitle, title, 45);

  if (normalizedSongArtist === artist) score += 45;
  else if (normalizedSongArtist.includes(artist) || artist.includes(normalizedSongArtist)) score += 35;
  else score += tokenOverlapScore(normalizedSongArtist, artist, 30);

  if (haystack.includes(title) && haystack.includes(artist)) score += 20;
  return score;
};

const buildTargetQueries = (target) => {
  const base = `${target.title} ${target.artist}`.trim();
  return [
    base,
    `${base} song`,
    target.title,
  ].filter(Boolean);
};

const isSpecificSongQuery = (query) => {
  const normalized = normalizeComparable(query);
  const tokens = normalized.split(' ').filter((token) => token.length > 2);
  const genericTerms = ['playlist', 'songs', 'music', 'hits', 'trending', 'mood', 'vibes'];
  return tokens.length >= 2 && !genericTerms.some((term) => tokens.length <= 3 && tokens.includes(term));
};

const normalizeComparable = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*]/g, ' ')
    .replace(/\b(from|feat|ft|with|official|video|audio|song|lyrics)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const tokenOverlapScore = (candidate, target, maxScore) => {
  const candidateTokens = new Set(candidate.split(' ').filter((token) => token.length > 2));
  const targetTokens = target.split(' ').filter((token) => token.length > 2);
  if (!candidateTokens.size || !targetTokens.length) return 0;
  const matches = targetTokens.filter((token) => candidateTokens.has(token)).length;
  return Math.round((matches / targetTokens.length) * maxScore);
};

const isMoodBlockedTrack = (song, moodText) => {
  const mood = normalizeComparable(moodText);
  const allowsDevotional = /\b(devotional|bhajan|aarti|mantra|bhakti|prayer|god|krishna|shiva|hanuman|ram|ganesh)\b/.test(mood);
  if (allowsDevotional) return false;

  const combined = normalizeComparable(`${song.title} ${song.artist} ${song.album}`);
  const devotionalTerms = [
    'aarti',
    'asatoma',
    'bhajan',
    'bhakti',
    'chalisa',
    'devotional',
    'gayatri',
    'hanuman',
    'hare krishna',
    'krishna',
    'mahamrityunjaya',
    'mantra',
    'om namah',
    'prayer',
    'shiva',
  ];
  return devotionalTerms.some((term) => combined.includes(term));
};

const createGeminiMoodError = (message) => {
  const error = new Error(message);
  error.code = 'gemini-mood-generation-failed';
  error.status = 503;
  return error;
};

const resolveTargetSongs = async (targets, existingIds = new Set(), moodText = '') => {
  const seen = new Set();
  const resolved = [];
  const rejected = [];

  const batches = await Promise.allSettled(
    targets.slice(0, TARGET_SONG_COUNT).map(async (target) => {
      const rawSongs = [];
      const localSeen = new Set();

      for (const query of buildTargetQueries(target)) {
        const result = await searchSongs(query, 10);
        const results = result?.data?.data?.results || result?.data?.results || [];
        for (const song of results) {
          if (!song?.id || localSeen.has(song.id)) continue;
          localSeen.add(song.id);
          rawSongs.push(song);
        }
        if (rawSongs.length >= 8) break;
      }

      const formatted = rawSongs.map(formatSong)
        .filter((song) => song.audioUrl && !isLowQualityTrack(song.title, song.artist, song.album))
        .filter((song) => !isMoodBlockedTrack(song, moodText))
        .map((song) => ({ ...song, _geminiReason: target.reason, _matchScore: scoreCandidateMatch(song, target) }))
        .filter((song) => song._matchScore >= MIN_TARGET_MATCH_SCORE)
        .sort((a, b) => b._matchScore - a._matchScore);

      return formatted[0] || null;
    })
  );

  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index];
    if (batch.status !== 'fulfilled' || !batch.value) {
      rejected.push(targets[index]);
      continue;
    }
    const song = batch.value;
    if (seen.has(song._id) || existingIds.has(song._id)) continue;
    seen.add(song._id);
    const { _matchScore, ...cleanSong } = song;
    resolved.push(cleanSong);
  }

  return { songs: resolved, rejected };
};

const resolveSongsFromGeminiQueries = async (queries, existingIds = new Set(), moodText = '') => {
  const resolved = [];
  const seen = new Set(existingIds);
  const uniqueQueries = [...new Set((queries || []).map(normalizeText).filter(isSpecificSongQuery))];

  const queryResults = await Promise.allSettled(uniqueQueries.slice(0, MAX_QUERY_FALLBACKS).map(async (query) => {
    try {
      const result = await searchSongs(query, 10);
      const results = result?.data?.data?.results || result?.data?.results || [];
      return {
        query,
        songs: results
        .map(formatSong)
        .filter((song) => song.audioUrl && !isLowQualityTrack(song.title, song.artist, song.album))
        .filter((song) => !isMoodBlockedTrack(song, moodText))
        .filter((song) => {
          const haystack = normalizeComparable(`${song.title} ${song.artist}`);
          const queryTokens = normalizeComparable(query).split(' ').filter((token) => token.length > 2);
          const matchedTokens = queryTokens.filter((token) => haystack.includes(token)).length;
          return matchedTokens >= Math.min(2, queryTokens.length);
        }),
      };
    } catch (error) {
      console.warn('[GeminiMood] Query fallback failed:', {
        query,
        error: error.message,
      });
      return { query, songs: [] };
    }
  }));

  for (const result of queryResults) {
    if (result.status !== 'fulfilled') continue;
    for (const song of result.value.songs) {
      if (!song._id || seen.has(song._id)) continue;
      seen.add(song._id);
      resolved.push({
        ...song,
        _geminiReason: 'Matched from Gemini grounded search',
      });
      break;
    }
    if (resolved.length >= PLAYLIST_SIZE) break;
  }

  return resolved;
};

const inferMoodKeywords = (moodText) => {
  const normalized = normalizeComparable(moodText);
  const keywordMap = [
    { match: ['sad', 'breakup', 'heartbreak', 'cry', 'alone', 'lonely'], emotion: 'sad', terms: ['arijit singh sad', 'jubin nautiyal heartbreak', 'b praak emotional'] },
    { match: ['love', 'romantic', 'date', 'crush'], emotion: 'romantic', terms: ['arijit singh romantic', 'pritam love songs', 'atif aslam romantic'] },
    { match: ['party', 'dance', 'club', 'fun'], emotion: 'party', terms: ['bollywood party hits', 'badshah party songs', 'neha kakkar dance'] },
    { match: ['gym', 'workout', 'energy', 'energetic', 'motivation'], emotion: 'energetic', terms: ['workout songs hindi', 'badshah gym', 'divine rap workout'] },
    { match: ['chill', 'calm', 'relax', 'peace', 'study', 'focus'], emotion: 'calm', terms: ['soothing arijit singh', 'calm hindi songs', 'ar rahman peaceful'] },
    { match: ['travel', 'drive', 'road', 'trip'], emotion: 'travel', terms: ['road trip hindi songs', 'travel songs bollywood', 'driving hits hindi'] },
    { match: ['punjabi', 'bhangra', 'desi'], emotion: 'desi', terms: ['punjabi hits 2026', 'bhangra party songs', 'desi beats'] },
    { match: ['english', 'pop', 'global'], emotion: 'pop', terms: ['trending english pop', 'global pop hits', 'latest english songs'] },
  ];

  return keywordMap.find((entry) => entry.match.some((word) => normalized.includes(word))) || {
    emotion: 'joy',
    terms: ['trending bollywood songs', 'latest hindi songs', 'popular hindi songs 2026'],
  };
};

const buildProviderFallbackQueries = (moodText, plan = null, repairPlan = null) => {
  const inferred = inferMoodKeywords(moodText);
  const targetQueries = [
    ...(plan?.targetSongs || []),
    ...(repairPlan?.targetSongs || []),
  ].map((song) => `${song.title} ${song.artist}`.trim());

  return [...new Set([
    ...targetQueries,
    ...(plan?.searchQueries || []),
    ...(repairPlan?.searchQueries || []),
    moodText,
    `${moodText} songs`,
    `${moodText} hindi songs`,
    `${moodText} bollywood songs`,
    ...inferred.terms,
    'trending hindi bollywood songs',
    'latest bollywood hits',
    'top indian hits',
  ].map(normalizeText).filter(Boolean))];
};

const resolveProviderFallbackSongs = async (queries, existingIds = new Set(), moodText = '') => {
  const seen = new Set(existingIds);
  const songs = [];

  const queryResults = await Promise.allSettled(queries.slice(0, MAX_PROVIDER_FALLBACK_QUERIES).map(async (query) => {
    try {
      const result = await searchSongs(query, 25);
      const results = result?.data?.data?.results || result?.data?.results || [];
      return {
        query,
        songs: results
          .map(formatSong)
          .filter((song) => song.audioUrl && !isLowQualityTrack(song.title, song.artist, song.album))
          .filter((song) => !isMoodBlockedTrack(song, moodText)),
      };
    } catch (error) {
      console.warn('[GeminiMood] Provider fallback query failed:', {
        query,
        error: error.message,
      });
      return { query, songs: [] };
    }
  }));

  for (const result of queryResults) {
    if (result.status !== 'fulfilled') continue;
    for (const song of result.value.songs) {
      if (!song._id || seen.has(song._id)) continue;
      seen.add(song._id);
      songs.push({
        ...song,
        _geminiReason: `Playable match for "${result.value.query}"`,
      });
      if (songs.length >= PLAYLIST_SIZE) return songs;
    }
  }

  return songs;
};

const generateGeminiPlaylistName = (emotion, context) => {
  const rawLabel = normalizeText(emotion) || 'Mood';
  const label = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);
  const contextLabel = normalizeText(context);
  return contextLabel ? `${contextLabel} ${label} Mix` : `${label} Mix`;
};

export const generateGeminiMoodPlaylist = async (moodText) => {
  try {
    let plan = null;
    let plannerError = null;
    let providerFallbackUsed = false;
    try {
      plan = await callGeminiPlanner(moodText);
      console.log('[GeminiMood] Grounded plan received:', {
        emotion: plan.emotion,
        context: plan.context,
        targetSongs: plan.targetSongs.length,
        searchQueries: plan.searchQueries.length,
        webSearchQueries: plan.grounding?.webSearchQueries?.length || 0,
      });
    } catch (error) {
      plannerError = error;
      const inferred = inferMoodKeywords(moodText);
      plan = {
        playlistName: generateGeminiPlaylistName(inferred.emotion, null),
        emotion: inferred.emotion,
        context: null,
        searchQueries: inferred.terms,
        targetSongs: [],
        grounding: null,
      };
      console.warn('[GeminiMood] Planner unavailable, using provider fallback plan:', error.message);
    }

    const firstPass = await resolveTargetSongs(plan.targetSongs, new Set(), moodText);
    let songs = firstPass.songs;
    let repairPlan = null;

    if (!plannerError && songs.length < PLAYLIST_SIZE && firstPass.rejected.length) {
      try {
        repairPlan = await callGeminiRepairPlanner(moodText, songs, firstPass.rejected);
        const existingIds = new Set(songs.map((song) => song._id));
        const repairPass = await resolveTargetSongs(repairPlan.targetSongs, existingIds, moodText);
        songs = [...songs, ...repairPass.songs];

        console.log('[GeminiMood] Repair plan resolved:', {
          targetSongs: repairPlan.targetSongs.length,
          repairedSongs: repairPass.songs.length,
          totalPlayableSongs: songs.length,
        });
      } catch (error) {
        console.warn('[GeminiMood] Repair planner unavailable, continuing with provider fallback:', error.message);
      }
    }

    if (songs.length < PLAYLIST_SIZE) {
      const existingIds = new Set(songs.map((song) => song._id));
      const queryFallbackSongs = await resolveSongsFromGeminiQueries([
        ...plan.searchQueries,
        ...(repairPlan?.searchQueries || []),
        ...(plan.grounding?.webSearchQueries || []),
        ...(repairPlan?.grounding?.webSearchQueries || []),
      ], existingIds, moodText);
      songs = [...songs, ...queryFallbackSongs];

      console.log('[GeminiMood] Grounded query fallback resolved:', {
        fallbackSongs: queryFallbackSongs.length,
        totalPlayableSongs: songs.length,
      });
    }

    if (songs.length < PLAYLIST_SIZE) {
      const existingIds = new Set(songs.map((song) => song._id));
      const providerFallbackSongs = await resolveProviderFallbackSongs(
        buildProviderFallbackQueries(moodText, plan, repairPlan),
        existingIds,
        moodText
      );
      songs = [...songs, ...providerFallbackSongs];
      providerFallbackUsed = providerFallbackSongs.length > 0;

      console.log('[GeminiMood] Provider fallback resolved:', {
        fallbackSongs: providerFallbackSongs.length,
        totalPlayableSongs: songs.length,
      });
    }

    if (songs.length === 0) {
      throw createGeminiMoodError('Music provider did not return playable songs');
    }

    const selectedSongs = songs.slice(0, PLAYLIST_SIZE).map(({ _geminiReason, ...song }) => ({
      ...song,
      moodReason: _geminiReason || undefined,
    }));

    return {
      _id: `mood_gemini_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      name: plan.playlistName || generateGeminiPlaylistName(plan.emotion, plan.context),
      emotion: plan.emotion,
      context: plan.context,
      moodText,
      songs: selectedSongs,
      songCount: selectedSongs.length,
      generatedAt: admin.firestore.Timestamp.now(),
      moodGenerated: true,
      cached: false,
      source: plannerError ? 'provider_fallback' : providerFallbackUsed ? 'gemini_provider_fallback' : 'gemini_grounded',
      aiPlan: {
        searchQueries: [
          ...plan.searchQueries,
          ...(repairPlan?.searchQueries || []),
        ],
        webSearchQueries: [
          ...(plan.grounding?.webSearchQueries || []),
          ...(repairPlan?.grounding?.webSearchQueries || []),
        ],
      },
    };
  } catch (error) {
    console.warn('[GeminiMood] Generation failed:', error.message);
    throw error.code === 'gemini-mood-generation-failed'
      ? error
      : createGeminiMoodError(error.message || 'Gemini mood generation failed');
  }
};
