import admin from "../config/firebase.js";
import { getHighestQualityDownload } from "../lib/jiosaavnAudio.js";

const SAAVN_API_BASE_URL = (process.env.JIOSAAVN_API_BASE_URL || "https://mavrixfy-song-api.vercel.app/api").replace(/\/+$/, "");
const SAAVN_SONGS_ENDPOINT = `${SAAVN_API_BASE_URL}/songs`;
const SAAVN_SEARCH_PROVIDERS = [
  {
    name: "mavrixfy",
    songsEndpoint: `${SAAVN_API_BASE_URL}/search/songs`,
    globalEndpoint: `${SAAVN_API_BASE_URL}/search`,
    pageOffset: 0,
    minimumPrimaryResults: 8,
  },
];
const GLOBAL_SEARCH_FALLBACK_THRESHOLD = 6;
const MATCHER_CACHE_VERSION = "v4";
const IMPORT_CACHE_TTL_MS = 30 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 10;
const MIN_BATCH_SIZE = 10;
const MAX_BATCH_SIZE = 20;
const DEFAULT_CONCURRENCY = 6;
const MIN_CONCURRENCY = 1;
const MAX_CONCURRENCY = 20;
const AUDIO_HEAD_TIMEOUT_MS = 5000;
const SEARCH_PAGE_SIZE = 20;
const STRICT_QUERY_MAX_PAGES = 3;
const RELAXED_QUERY_MAX_PAGES = 2;
const TITLE_ONLY_MAX_PAGES = 3;
const ALBUM_QUERY_MAX_PAGES = 1;
const EARLY_MATCH_SCORE_THRESHOLD = 92;
const EARLY_MATCH_TITLE_THRESHOLD = 0.9;
const EARLY_MATCH_ARTIST_THRESHOLD = 0.6;
const SOFT_MATCH_SCORE_THRESHOLD = 86;
const MAX_ACCUMULATED_SEARCH_RESULTS = 60;

const UNWANTED_VERSION_PATTERN =
  /\b(remix|live|lofi|slowed|reverb|cover|karaoke|nightcore|sped\s*up|8d)\b/i;
const TITLE_SUFFIX_NOISE_PATTERN =
  /\s*[-:|]\s*(from|feat(?:uring)?|ft\.?|version|remix|flip|lofi|slowed|reverb|cover|karaoke|sped\s*up|edit|live)\b.*$/i;

const FILE_EXTENSION_PATTERN = /\.([a-z0-9]+)$/i;

const importCache = new Map();

const fetchWithTimeout = async (url, init = {}, timeoutMs = 10000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
};

const clamp = (value, min, max, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
};

const cleanCellValue = (value) => String(value ?? "").trim();

const safeLower = (value) => String(value ?? "").toLowerCase();

const parseDateNumber = (value) => {
  if (!Number.isFinite(value)) return "";

  // Excel serial date (days since 1899-12-30)
  if (value > 20000 && value < 80000) {
    const excelEpochMs = Date.UTC(1899, 11, 30);
    const date = new Date(excelEpochMs + value * 24 * 60 * 60 * 1000);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  }

  // Unix seconds
  if (value > 0 && value < 1e11) {
    const date = new Date(value * 1000);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  }

  // Unix milliseconds
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
};

const toIsoDate = (value) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  }

  if (typeof value === "number") {
    return parseDateNumber(value);
  }

  if (typeof value !== "string") return "";

  const trimmed = value.trim();
  if (!trimmed) return "";

  const direct = new Date(trimmed);
  if (!Number.isNaN(direct.getTime())) {
    return direct.toISOString();
  }

  const numeric = Number(trimmed);
  if (Number.isFinite(numeric)) {
    return parseDateNumber(numeric);
  }

  return "";
};

const decodeHtmlEntities = (value) =>
  String(value ?? "")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

const normalizeComparableText = (value) => {
  const base = decodeHtmlEntities(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return base
    .replace(/\((.*?)\)|\[(.*?)\]|\{(.*?)\}/g, " ")
    .replace(/[&]/g, " and ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const splitArtists = (value) =>
  decodeHtmlEntities(value)
    .split(/\s*(?:,|;|\/|\||&|feat\.?|ft\.?)\s*/i)
    .map(cleanCellValue)
    .filter(Boolean);

const stripVersionNoise = (title) => {
  const noBrackets = decodeHtmlEntities(String(title ?? ""))
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\((.*?)\)|\[(.*?)\]|\{(.*?)\}/g, " ")
    .replace(/\bfrom\s+["'][^"']+["']/gi, " ")
    .replace(TITLE_SUFFIX_NOISE_PATTERN, " ");

  return noBrackets
    .replace(UNWANTED_VERSION_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const normalizeInputSong = (song, index) => {
  const rawTitle = cleanCellValue(song?.title);
  const rawArtist = cleanCellValue(song?.artist);
  const rawAlbum = cleanCellValue(song?.album);
  const rawAddedAt = cleanCellValue(
    song?.addedAt || song?.likedAt || song?.dateAdded || song?.savedAt
  );

  const title = stripVersionNoise(rawTitle);
  const artist = rawArtist;
  const album = rawAlbum;
  const addedAt = toIsoDate(rawAddedAt);

  const normalizedTitle = normalizeComparableText(title);
  const normalizedArtist = normalizeComparableText(artist);
  const normalizedArtists = splitArtists(artist)
    .map((part) => normalizeComparableText(part))
    .filter(Boolean);
  const normalizedAlbum = normalizeComparableText(album);
  const hasReliableArtist =
    normalizedArtists.length > 0 &&
    !normalizedArtists.every((value) => value === "unknown artist");

  return {
    index,
    title,
    artist,
    album,
    rawTitle,
    rawArtist,
    rawAddedAt,
    addedAt,
    normalizedTitle,
    normalizedArtist,
    normalizedArtists,
    normalizedAlbum,
    hasReliableArtist,
  };
};

const isValidInputSong = (song) =>
  Boolean(song.normalizedTitle) && Boolean(song.normalizedArtist);

const dedupeInputSongs = (songs) => {
  const unique = new Map();
  for (const song of songs) {
    const key = `${song.normalizedTitle}|${song.normalizedArtist}`;
    if (!unique.has(key)) {
      unique.set(key, song);
    }
  }
  return Array.from(unique.values());
};

const parseCsvLine = (line) => {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values.map(cleanCellValue);
};

const findHeaderIndex = (headers, aliases) =>
  aliases.reduce((found, alias) => {
    if (found !== -1) return found;
    return headers.indexOf(alias);
  }, -1);

const parseCsvSongs = (content) => {
  const lines = String(content ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const header = parseCsvLine(lines[0]).map((value) => safeLower(value));

  const titleIndex = findHeaderIndex(header, [
    "title",
    "track",
    "track name",
    "trackname",
    "track title",
    "song title",
    "song",
    "name",
  ]);
  const artistIndex = findHeaderIndex(header, [
    "artist",
    "artists",
    "artist names",
    "artist(s)",
    "artist name",
    "artist_name(s)",
    "artist name(s)",
    "singer",
  ]);
  const albumIndex = findHeaderIndex(header, [
    "album",
    "album name",
    "albumname",
    "album title",
  ]);
  const addedAtIndex = findHeaderIndex(header, [
    "added at",
    "addedat",
    "added_at",
    "date added",
    "liked at",
    "saved at",
    "created at",
    "added on",
    "added_on",
    "timestamp",
  ]);

  const hasHeader = titleIndex !== -1 || artistIndex !== -1;
  const startIndex = hasHeader ? 1 : 0;

  const parsed = [];
  for (let i = startIndex; i < lines.length; i += 1) {
    const row = parseCsvLine(lines[i]);

    const title =
      titleIndex >= 0 ? row[titleIndex] : row[0] ?? row[1] ?? "";
    const artist =
      artistIndex >= 0 ? row[artistIndex] : row[1] ?? row[2] ?? "";
    const album = albumIndex >= 0 ? row[albumIndex] : row[2] ?? "";
    const addedAt = addedAtIndex >= 0 ? row[addedAtIndex] : "";

    parsed.push({ title, artist, album, addedAt });
  }

  return parsed;
};

const parseTxtSongs = (content) => {
  const lines = String(content ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.map((line) => {
    const dashSplit = line.match(/^(.*?)\s*-\s*(.+)$/);
    if (dashSplit) {
      return {
        title: cleanCellValue(dashSplit[1]),
        artist: cleanCellValue(dashSplit[2]),
      };
    }

    const bySplit = line.match(/^(.*?)\s+by\s+(.+)$/i);
    if (bySplit) {
      return {
        title: cleanCellValue(bySplit[1]),
        artist: cleanCellValue(bySplit[2]),
      };
    }

    return {
      title: cleanCellValue(line),
      artist: "unknown artist",
    };
  });
};

const detectFileExtension = (fileName) => {
  const match = String(fileName ?? "").match(FILE_EXTENSION_PATTERN);
  return match ? safeLower(match[1]) : "";
};

export const parseSongsFromImportSource = ({ fileName, content }) => {
  const extension = detectFileExtension(fileName);

  let songs;
  if (extension === "csv") {
    songs = parseCsvSongs(content);
  } else if (extension === "txt" || extension === "text") {
    songs = parseTxtSongs(content);
  } else {
    throw new Error("Only CSV and TXT files are supported.");
  }

  const normalized = songs
    .map((song, index) => normalizeInputSong(song, index))
    .filter(isValidInputSong);

  return dedupeInputSongs(normalized);
};

const parseDownloadUrls = (downloadUrl) => {
  if (Array.isArray(downloadUrl)) return downloadUrl;
  if (Array.isArray(downloadUrl?.downloadUrl)) return downloadUrl.downloadUrl;
  return [];
};

const normalizeSaavnArtists = (rawArtists, fallbackArtist) => {
  if (rawArtists?.primary && Array.isArray(rawArtists.primary)) {
    return rawArtists.primary
      .map((artist) => cleanCellValue(decodeHtmlEntities(artist?.name)))
      .filter(Boolean);
  }

  if (Array.isArray(rawArtists)) {
    return rawArtists
      .map((artist) =>
        typeof artist === "string"
          ? cleanCellValue(decodeHtmlEntities(artist))
          : cleanCellValue(decodeHtmlEntities(artist?.name))
      )
      .filter(Boolean);
  }

  if (typeof fallbackArtist === "string") {
    return splitArtists(fallbackArtist)
      .map((part) => cleanCellValue(decodeHtmlEntities(part)))
      .filter(Boolean);
  }

  return [];
};

const normalizeImageUrl = (image) => {
  if (!image) return "";
  if (typeof image === "string") return image;
  if (Array.isArray(image)) {
    const candidate =
      image.find((entry) => safeLower(entry?.quality) === "500x500") ||
      image.find((entry) => safeLower(entry?.quality) === "150x150") ||
      image[image.length - 1];
    return cleanCellValue(candidate?.url || candidate?.link || "");
  }
  return cleanCellValue(image?.url || image?.link || "");
};

const normalizeSearchResults = (payload) => {
  const rawResults =
    payload?.data?.results ||
    payload?.results ||
    payload?.data ||
    payload?.songs?.results ||
    [];

  if (!Array.isArray(rawResults)) {
    return [];
  }

  return rawResults
    .map((result) => {
      const title = cleanCellValue(
        decodeHtmlEntities(result?.name || result?.title)
      );
      const artists = normalizeSaavnArtists(
        result?.artists,
        result?.primaryArtists || result?.artist
      );
      const primaryArtist = artists[0] || "";
      const album = cleanCellValue(
        decodeHtmlEntities(result?.album?.name || result?.album)
      );
      const downloadUrl = parseDownloadUrls(result?.downloadUrl);

      return {
        saavnId: cleanCellValue(result?.id),
        title,
        normalizedTitle: normalizeComparableText(title),
        artists,
        primaryArtist,
        normalizedArtists: artists.map((artist) => normalizeComparableText(artist)),
        album,
        normalizedAlbum: normalizeComparableText(album),
        language: cleanCellValue(result?.language),
        image: normalizeImageUrl(result?.image),
        duration: Number(result?.duration) || 0,
        downloadUrl,
      };
    })
    .filter(
      (result) =>
        result.title &&
        result.primaryArtist &&
        (result.downloadUrl.length > 0 || Boolean(result.saavnId))
    );
};

const hasUnwantedVersionTag = (text) => UNWANTED_VERSION_PATTERN.test(text);

const levenshteinDistance = (left, right) => {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  const matrix = Array.from({ length: left.length + 1 }, () =>
    Array(right.length + 1).fill(0)
  );

  for (let i = 0; i <= left.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= right.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[left.length][right.length];
};

const tokenSimilarity = (left, right) => {
  const leftTokens = new Set(left.split(" ").filter(Boolean));
  const rightTokens = new Set(right.split(" ").filter(Boolean));

  if (!leftTokens.size || !rightTokens.size) return 0;

  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) overlap += 1;
  }

  const unionSize = new Set([...leftTokens, ...rightTokens]).size;
  return unionSize ? overlap / unionSize : 0;
};

const computeSimilarity = (leftRaw, rightRaw) => {
  const left = normalizeComparableText(leftRaw);
  const right = normalizeComparableText(rightRaw);

  if (!left || !right) return 0;
  if (left === right) return 1;

  const maxLen = Math.max(left.length, right.length);
  const levenshteinScore = maxLen
    ? 1 - levenshteinDistance(left, right) / maxLen
    : 0;
  const tokenScore = tokenSimilarity(left, right);
  const containsScore = left.includes(right) || right.includes(left) ? 0.95 : 0;

  return Math.max(containsScore, levenshteinScore * 0.6 + tokenScore * 0.4);
};

const computeMatchScore = (inputSong, candidate) => {
  const titleSimilarity = computeSimilarity(
    inputSong.normalizedTitle,
    candidate.normalizedTitle
  );

  const inputArtistCandidates =
    inputSong.normalizedArtists.length > 0
      ? inputSong.normalizedArtists
      : [inputSong.normalizedArtist].filter(Boolean);
  const candidateArtistsJoined = candidate.normalizedArtists.join(" ");
  const artistSimilarityCandidates = inputArtistCandidates.flatMap((inputArtist) => [
    computeSimilarity(inputArtist, candidate.primaryArtist),
    computeSimilarity(inputArtist, candidateArtistsJoined),
  ]);
  if (!artistSimilarityCandidates.length) {
    artistSimilarityCandidates.push(0);
  }
  const artistSimilarity = Math.max(...artistSimilarityCandidates);

  const metadataScore =
    inputSong.normalizedAlbum && candidate.normalizedAlbum
      ? computeSimilarity(inputSong.normalizedAlbum, candidate.normalizedAlbum) >= 0.7
        ? 8
        : 0
      : 0;

  const exactTitleBonus =
    inputSong.normalizedTitle && inputSong.normalizedTitle === candidate.normalizedTitle
      ? 7
      : 0;
  const artistTokenBonus =
    inputSong.hasReliableArtist &&
    inputArtistCandidates.some(
      (artist) => tokenSimilarity(artist, candidateArtistsJoined) >= 0.55
    )
      ? 5
      : 0;

  const score = Math.round(
    titleSimilarity * 65 +
      artistSimilarity * 25 +
      metadataScore +
      exactTitleBonus +
      artistTokenBonus
  );

  return {
    score,
    titleSimilarity,
    artistSimilarity,
    metadataScore,
    exactTitleBonus,
    artistTokenBonus,
  };
};

const findBestMatch = (inputSong, candidates, options = {}) => {
  const minTitleSimilarity = Number.isFinite(options.minTitleSimilarity)
    ? options.minTitleSimilarity
    : 0.72;
  const minScore = Number.isFinite(options.minScore) ? options.minScore : 74;
  const minArtistSimilarity = Number.isFinite(options.minArtistSimilarity)
    ? options.minArtistSimilarity
    : inputSong.hasReliableArtist ? 0.3 : 0;
  let bestMatch = null;

  for (const candidate of candidates) {
    const unwantedCandidate =
      hasUnwantedVersionTag(candidate.title) &&
      !hasUnwantedVersionTag(inputSong.title);
    if (unwantedCandidate) {
      continue;
    }

    const metrics = computeMatchScore(inputSong, candidate);
    const accepted =
      metrics.titleSimilarity >= minTitleSimilarity &&
      metrics.artistSimilarity >= minArtistSimilarity &&
      metrics.score >= minScore;

    if (!accepted) continue;

    if (!bestMatch || metrics.score > bestMatch.metrics.score) {
      bestMatch = { candidate, metrics };
    }
  }

  return bestMatch;
};

const extractCacheEntry = (key) => {
  const cached = importCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt < Date.now()) {
    importCache.delete(key);
    return null;
  }
  return cached;
};

const storeCacheEntry = (key, value) => {
  importCache.set(key, {
    ...value,
    expiresAt: Date.now() + IMPORT_CACHE_TTL_MS,
  });
};

const mergeUniqueSearchResults = (target, incoming) => {
  const seen = new Set(
    target.map(
      (result) => result.saavnId || `${result.normalizedTitle}|${result.primaryArtist}`
    )
  );

  for (const result of incoming) {
    const key = result.saavnId || `${result.normalizedTitle}|${result.primaryArtist}`;
    if (seen.has(key)) continue;
    seen.add(key);
    target.push(result);
  }
};

const normalizeGlobalSearchResults = (payload) => {
  const topFromData = payload?.data?.topQuery?.results || [];
  const songsFromData = payload?.data?.songs?.results || [];
  const topFromRoot = payload?.topQuery?.results || [];
  const songsFromRoot = payload?.songs?.results || [];

  const combined = [
    ...topFromData,
    ...songsFromData,
    ...topFromRoot,
    ...songsFromRoot,
  ];

  if (combined.length) {
    return normalizeSearchResults({ data: { results: combined } });
  }

  return normalizeSearchResults(payload);
};

const resolveSearchResults = async (query, limit = 20, page = 0) => {
  const mergedResults = [];
  let lastError = null;
  let hasProviderResponse = false;

  for (let index = 0; index < SAAVN_SEARCH_PROVIDERS.length; index += 1) {
    const provider = SAAVN_SEARCH_PROVIDERS[index];
    const providerPage = page + provider.pageOffset;
    const targetUrl = `${provider.songsEndpoint}?query=${encodeURIComponent(
      query
    )}&page=${providerPage}&limit=${limit}`;

    try {
      const response = await fetchWithTimeout(
        targetUrl,
        {
          method: "GET",
          headers: { accept: "application/json" },
        },
        10000
      );

      if (!response.ok) {
        throw new Error(
          `JioSaavn search (${provider.name}) failed with status ${response.status}`
        );
      }

      hasProviderResponse = true;
      const payload = await response.json();
      const normalizedResults = normalizeSearchResults(payload);
      mergeUniqueSearchResults(mergedResults, normalizedResults);

      if (
        index === 0 &&
        normalizedResults.length >= provider.minimumPrimaryResults
      ) {
        return mergedResults;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (mergedResults.length) {
    return mergedResults;
  }

  if (hasProviderResponse) {
    return [];
  }

  throw lastError || new Error("JioSaavn search failed for all providers");
};

const resolveGlobalSearchResults = async (query) => {
  const mergedResults = [];
  let lastError = null;
  let hasProviderResponse = false;

  for (let index = 0; index < SAAVN_SEARCH_PROVIDERS.length; index += 1) {
    const provider = SAAVN_SEARCH_PROVIDERS[index];
    if (!provider.globalEndpoint) continue;

    const targetUrl = `${provider.globalEndpoint}?query=${encodeURIComponent(query)}`;

    try {
      const response = await fetchWithTimeout(
        targetUrl,
        {
          method: "GET",
          headers: { accept: "application/json" },
        },
        10000
      );

      if (!response.ok) {
        throw new Error(
          `JioSaavn global search (${provider.name}) failed with status ${response.status}`
        );
      }

      hasProviderResponse = true;
      const payload = await response.json();
      const normalizedResults = normalizeGlobalSearchResults(payload);
      mergeUniqueSearchResults(mergedResults, normalizedResults);

      if (
        index === 0 &&
        normalizedResults.length >= GLOBAL_SEARCH_FALLBACK_THRESHOLD
      ) {
        return mergedResults;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (mergedResults.length) {
    return mergedResults;
  }

  if (hasProviderResponse) {
    return [];
  }

  throw lastError || new Error("JioSaavn global search failed for all providers");
};

const resolveDownloadUrlBySongId = async (songId) => {
  if (!songId) return "";

  const targetUrl = `${SAAVN_SONGS_ENDPOINT}?ids=${encodeURIComponent(songId)}`;
  const response = await fetchWithTimeout(
    targetUrl,
    {
      method: "GET",
      headers: { accept: "application/json" },
    },
    10000
  );

  if (!response.ok) {
    throw new Error(`JioSaavn songs lookup failed with status ${response.status}`);
  }

  const payload = await response.json();
  const results = payload?.data ?? payload?.songs ?? [];
  const details = Array.isArray(results) ? results[0] : results?.[songId] || results;
  const downloads = parseDownloadUrls(details?.downloadUrl);
  const bestDownload = getHighestQualityDownload(downloads);
  return cleanCellValue(bestDownload?.url || bestDownload?.link || "");
};

const buildSearchPlan = (inputSong, options = {}) => {
  const baseTitle = inputSong.title.trim();
  const simplifiedTitle = stripVersionNoise(inputSong.rawTitle || inputSong.title)
    .replace(/\s*-\s*$/g, "")
    .trim();
  const rawPrimaryArtist = splitArtists(inputSong.artist)[0] || "";
  const normalizedPrimaryArtist = inputSong.normalizedArtists?.[0] || "";
  const album = inputSong.album?.trim() || "";
  const deepSearch = Boolean(options.deepSearch);
  const strictPages = deepSearch ? STRICT_QUERY_MAX_PAGES + 2 : STRICT_QUERY_MAX_PAGES;
  const relaxedPages = deepSearch ? RELAXED_QUERY_MAX_PAGES + 1 : RELAXED_QUERY_MAX_PAGES;
  const titlePages = deepSearch ? TITLE_ONLY_MAX_PAGES + 2 : TITLE_ONLY_MAX_PAGES;

  const plan = [
    {
      query: rawPrimaryArtist ? `${baseTitle} ${rawPrimaryArtist}` : "",
      maxPages: strictPages,
    },
    {
      query:
        rawPrimaryArtist && simplifiedTitle && simplifiedTitle !== baseTitle
          ? `${simplifiedTitle} ${rawPrimaryArtist}`
          : "",
      maxPages: relaxedPages,
    },
    {
      query: baseTitle,
      maxPages: titlePages,
    },
    {
      query: simplifiedTitle && simplifiedTitle !== baseTitle ? simplifiedTitle : "",
      maxPages: relaxedPages,
    },
    {
      query:
        normalizedPrimaryArtist &&
        normalizeComparableText(rawPrimaryArtist) !== normalizedPrimaryArtist
          ? `${baseTitle} ${normalizedPrimaryArtist}`
          : "",
      maxPages: relaxedPages,
    },
    {
      query: album ? `${baseTitle} ${album}` : "",
      maxPages: ALBUM_QUERY_MAX_PAGES,
    },
  ];

  const uniquePlan = new Map();
  for (const entry of plan) {
    const query = entry.query.trim();
    if (!query) continue;

    const key = normalizeComparableText(query);
    const existing = uniquePlan.get(key);
    if (!existing || existing.maxPages < entry.maxPages) {
      uniquePlan.set(key, {
        query,
        maxPages: entry.maxPages,
      });
    }
  }

  return Array.from(uniquePlan.values());
};

const shouldStopSearch = (bestMatch, totalResults) => {
  if (!bestMatch) return false;

  if (
    bestMatch.metrics.score >= EARLY_MATCH_SCORE_THRESHOLD &&
    bestMatch.metrics.titleSimilarity >= EARLY_MATCH_TITLE_THRESHOLD &&
    bestMatch.metrics.artistSimilarity >= EARLY_MATCH_ARTIST_THRESHOLD
  ) {
    return true;
  }

  return (
    totalResults >= MAX_ACCUMULATED_SEARCH_RESULTS &&
    bestMatch.metrics.score >= SOFT_MATCH_SCORE_THRESHOLD
  );
};

const hasPromisingTitleMatch = (inputSong, candidates) =>
  candidates.some(
    (candidate) =>
      computeSimilarity(inputSong.normalizedTitle, candidate.normalizedTitle) >= 0.84
  );

const appendUniqueResults = (target, incoming, seenKeys) => {
  let added = 0;

  for (const result of incoming) {
    const uniqueKey =
      result.saavnId || `${result.normalizedTitle}|${result.primaryArtist}`;
    if (seenKeys.has(uniqueKey)) continue;
    seenKeys.add(uniqueKey);
    target.push(result);
    added += 1;
  }

  return added;
};

const isLikelyAudioContentType = (value) => {
  const normalized = safeLower(value);
  if (!normalized) return true;
  return (
    normalized.includes("audio") ||
    normalized.includes("octet-stream") ||
    normalized.includes("mpegurl")
  );
};

const validateAudioUrl = async (audioUrl) => {
  try {
    const response = await fetchWithTimeout(
      audioUrl,
      { method: "HEAD", redirect: "follow" },
      AUDIO_HEAD_TIMEOUT_MS
    );

    if (!response.ok) return false;

    const contentType = response.headers.get("content-type") || "";
    return isLikelyAudioContentType(contentType);
  } catch {
    return false;
  }
};

const resolveSongFromSearch = async (inputSong, options) => {
  const cacheKey = `${MATCHER_CACHE_VERSION}|${inputSong.normalizedTitle}|${inputSong.normalizedArtist}`;
  const cached = extractCacheEntry(cacheKey);
  if (cached) {
    return {
      ok: true,
      song: cached.song,
      cached: true,
      score: cached.score,
    };
  }

  const searchPlan = buildSearchPlan(inputSong, options);
  const aggregated = [];
  const seenIds = new Set();
  let hadSearchResponse = false;
  let hadSearchError = false;
  let bestMatch = null;
  const relaxedMatch = Boolean(options.relaxedMatch);
  const matchThresholds = relaxedMatch
    ? {
        minTitleSimilarity: 0.66,
        minArtistSimilarity: inputSong.hasReliableArtist ? 0.2 : 0,
        minScore: 64,
      }
    : {
        minTitleSimilarity: 0.72,
        minArtistSimilarity: inputSong.hasReliableArtist ? 0.3 : 0,
        minScore: 74,
      };

  searchLoop: for (const searchStep of searchPlan) {
    for (let page = 0; page < searchStep.maxPages; page += 1) {
      try {
        const pageResults = await resolveSearchResults(
          searchStep.query,
          SEARCH_PAGE_SIZE,
          page
        );
        hadSearchResponse = true;
        const addedResults = appendUniqueResults(aggregated, pageResults, seenIds);

        if (aggregated.length) {
          bestMatch = findBestMatch(inputSong, aggregated, matchThresholds);
          if (shouldStopSearch(bestMatch, aggregated.length)) {
            break searchLoop;
          }
        }

        if (!pageResults.length || addedResults === 0) {
          break;
        }
      } catch {
        hadSearchError = true;
      }
    }
  }

  if (!bestMatch && (!aggregated.length || !hasPromisingTitleMatch(inputSong, aggregated))) {
    try {
      const globalResults = await resolveGlobalSearchResults(
        `${inputSong.title} ${inputSong.artist}`.trim()
      );
      hadSearchResponse = true;
      appendUniqueResults(aggregated, globalResults, seenIds);
      bestMatch = findBestMatch(inputSong, aggregated, matchThresholds);
    } catch {
      hadSearchError = true;
    }
  }

  if (!aggregated.length && hadSearchError && !hadSearchResponse) {
    return { ok: false, reason: "search_error", inputSong };
  }

  const searchResults = aggregated;

  if (!searchResults.length) {
    return { ok: false, reason: "no_results", inputSong };
  }

  if (!bestMatch) {
    const hasStrongTitleMatch = searchResults.some(
      (candidate) =>
        computeSimilarity(inputSong.normalizedTitle, candidate.normalizedTitle) >=
        (relaxedMatch ? 0.8 : 0.86)
    );
    return {
      ok: false,
      reason: hasStrongTitleMatch ? "artist_mismatch" : "no_match",
      inputSong,
    };
  }

  const bestDownload = getHighestQualityDownload(bestMatch.candidate.downloadUrl);
  let audioUrl = cleanCellValue(bestDownload?.url || bestDownload?.link || "");
  if (!audioUrl && bestMatch.candidate.saavnId) {
    try {
      audioUrl = await resolveDownloadUrlBySongId(bestMatch.candidate.saavnId);
    } catch {
      // Ignore fallback detail lookup errors and allow normal validation below.
    }
  }
  const hasMinimumFields = Boolean(
    bestMatch.candidate.title && bestMatch.candidate.primaryArtist && audioUrl
  );

  if (!hasMinimumFields) {
    return { ok: false, reason: "incomplete_result", inputSong };
  }

  if (options.validateAudioHead) {
    const isAudioValid = await validateAudioUrl(audioUrl);
    if (!isAudioValid) {
      return { ok: false, reason: "audio_invalid", inputSong };
    }
  }

  const resolvedSong = {
    title: bestMatch.candidate.title,
    artist:
      bestMatch.candidate.artists.join(", ") || bestMatch.candidate.primaryArtist,
    album: bestMatch.candidate.album || inputSong.album || "",
    addedAt: inputSong.addedAt || "",
    image: bestMatch.candidate.image || "",
    audioUrl,
    source: "saavn",
    duration: Number(bestMatch.candidate.duration) || 0,
    verified: true,
    saavnId: bestMatch.candidate.saavnId || "",
    normalizedTitle: normalizeComparableText(bestMatch.candidate.title),
    normalizedArtist: normalizeComparableText(
      bestMatch.candidate.artists.join(" ") || bestMatch.candidate.primaryArtist
    ),
  };

  storeCacheEntry(cacheKey, {
    song: resolvedSong,
    score: bestMatch.metrics.score,
  });

  return {
    ok: true,
    song: resolvedSong,
    score: bestMatch.metrics.score,
    cached: false,
  };
};

const runConcurrent = async (items, worker, concurrency) => {
  const results = new Array(items.length);
  let cursor = 0;

  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (true) {
        const currentIndex = cursor;
        cursor += 1;
        if (currentIndex >= items.length) {
          return;
        }

        results[currentIndex] = await worker(items[currentIndex], currentIndex);
      }
    }
  );

  await Promise.all(runners);
  return results;
};

const toStableHash = (value) => {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return Math.abs(hash).toString(36);
};

const buildDocId = (song) => {
  if (song.saavnId) {
    return `saavn_${song.saavnId}`;
  }

  const fallbackKey = `${song.normalizedTitle}|${song.normalizedArtist}`;
  return `saavn_${toStableHash(fallbackKey)}`;
};

const persistImportedSongs = async (userId, songs) => {
  if (!userId) return { written: 0, deduped: 0 };

  const firestore = admin.firestore();
  const dedupedMap = new Map();
  for (const song of songs) {
    const docId = buildDocId(song);
    dedupedMap.set(docId, song);
  }

  const entries = Array.from(dedupedMap.entries());
  const chunkSize = 400;
  let written = 0;

  for (let i = 0; i < entries.length; i += chunkSize) {
    const chunk = entries.slice(i, i + chunkSize);
    const batch = firestore.batch();

    for (const [docId, song] of chunk) {
      const likedAtValue = song.addedAt
        ? admin.firestore.Timestamp.fromDate(new Date(song.addedAt))
        : admin.firestore.FieldValue.serverTimestamp();
      const ref = firestore
        .collection("users")
        .doc(userId)
        .collection("likedSongs")
        .doc(docId);

      batch.set(
        ref,
        {
          id: docId,
          title: song.title,
          artist: song.artist,
          albumName: song.album || "",
          imageUrl: song.image || "",
          audioUrl: song.audioUrl,
          source: "saavn",
          duration: song.duration || 0,
          verified: true,
          saavnId: song.saavnId || "",
          normalizedTitle: song.normalizedTitle,
          normalizedArtist: song.normalizedArtist,
          likedAt: likedAtValue,
          importedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    await batch.commit();
    written += chunk.length;
  }

  return {
    written,
    deduped: songs.length - entries.length,
  };
};

const formatFailedSong = (item) => ({
  title: item?.inputSong?.title || item?.title || "",
  artist: item?.inputSong?.artist || item?.artist || "",
  album: item?.inputSong?.album || item?.album || "",
  addedAt: item?.inputSong?.addedAt || item?.addedAt || "",
  reason: item?.reason || "unknown_error",
});

export const importLikedSongsFromStructuredList = async ({
  userId,
  songs,
  options = {},
}) => {
  const startedAt = Date.now();
  const requestedSongs = Array.isArray(songs) ? songs : [];

  const preparedSongs = requestedSongs
      .map((song, index) => normalizeInputSong(song, index))
      .filter(isValidInputSong)
  ;
  const normalizedSongs = dedupeInputSongs(preparedSongs);
  const inputDuplicatesRemoved = Math.max(
    0,
    preparedSongs.length - normalizedSongs.length
  );

  if (!normalizedSongs.length) {
    return {
      total: 0,
      success: 0,
      failed: 0,
      partial: false,
      importedSongs: [],
      failedSongs: [],
      stats: {
        requested: requestedSongs.length,
        uniqueProcessed: 0,
        inputDuplicatesRemoved,
        matched: 0,
        cacheHits: 0,
        durationMs: Date.now() - startedAt,
      },
    };
  }

  const batchSize = clamp(
    options.batchSize,
    MIN_BATCH_SIZE,
    MAX_BATCH_SIZE,
    DEFAULT_BATCH_SIZE
  );
  const concurrency = clamp(
    options.concurrency,
    MIN_CONCURRENCY,
    MAX_CONCURRENCY,
    DEFAULT_CONCURRENCY
  );
  const validateAudioHead = Boolean(options.validateAudioHead);
  const deepSearch = Boolean(options.deepSearch);
  const relaxedMatch = Boolean(options.relaxedMatch);
  const shouldPersist = options.persist !== false;

  const processed = [];
  let cacheHits = 0;

  for (let i = 0; i < normalizedSongs.length; i += batchSize) {
    const batch = normalizedSongs.slice(i, i + batchSize);
    const batchResults = await runConcurrent(
      batch,
      (song) => resolveSongFromSearch(song, { validateAudioHead, deepSearch, relaxedMatch }),
      Math.min(concurrency, batch.length)
    );

    for (const result of batchResults) {
      if (result?.cached) cacheHits += 1;
      processed.push(result);
    }
  }

  const successfulMatches = processed.filter((item) => item?.ok);
  const failedMatches = processed.filter((item) => !item?.ok);

  let storageReport = { written: successfulMatches.length, deduped: 0 };
  let storageError = "";
  if (shouldPersist && successfulMatches.length && userId) {
    try {
      storageReport = await persistImportedSongs(
        userId,
        successfulMatches.map((item) => item.song)
      );
    } catch (error) {
      storageReport = { written: 0, deduped: 0 };
      storageError = error?.message || "storage_failed";
    }
  }

  const failedSongs = failedMatches.map(formatFailedSong);
  const failureReasons = failedSongs.reduce((acc, item) => {
    const reason = item.reason || "unknown_error";
    acc[reason] = (acc[reason] || 0) + 1;
    return acc;
  }, {});
  if (storageError) {
    for (const match of successfulMatches) {
      failedSongs.push({
        title: match.song.title,
        artist: match.song.artist,
        album: match.song.album || "",
        reason: "storage_failed",
      });
    }
  }

  const success = shouldPersist ? storageReport.written : successfulMatches.length;
  const failed = failedSongs.length;

  return {
    total: normalizedSongs.length,
    success,
    failed,
    partial: success > 0 && failed > 0,
    importedSongs: successfulMatches.map((item) => ({
      ...item.song,
      matchScore: item.score,
    })),
    failedSongs,
    stats: {
      requested: requestedSongs.length,
      uniqueProcessed: normalizedSongs.length,
      inputDuplicatesRemoved,
      matched: successfulMatches.length,
      batchSize,
      concurrency,
      cacheHits,
      persisted: storageReport.written,
      dedupedWrites: storageReport.deduped,
      storageError,
      failureReasons,
      durationMs: Date.now() - startedAt,
    },
  };
};

export const importLikedSongsFromFile = async ({
  userId,
  fileName,
  fileContent,
  options = {},
}) => {
  const parsedSongs = parseSongsFromImportSource({
    fileName,
    content: fileContent,
  });

  return importLikedSongsFromStructuredList({
    userId,
    songs: parsedSongs,
    options,
  });
};
