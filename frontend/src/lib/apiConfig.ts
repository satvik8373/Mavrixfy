const DEFAULT_API_URL = "https://spotify-api-drab.vercel.app/api";
const DEFAULT_SONG_API_URL = "https://mavrixfy-song-api.vercel.app/api";

const normalizeApiUrl = (value: string): string => {
  const trimmed = value.trim().replace(/\/+$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
};

export const API_BASE_URL = normalizeApiUrl(import.meta.env.VITE_API_URL || DEFAULT_API_URL);
export const API_ORIGIN_URL = API_BASE_URL.replace(/\/api$/, "");
export const SONG_API_BASE_URL = normalizeApiUrl(
  import.meta.env.VITE_SONG_API_URL || DEFAULT_SONG_API_URL
);
export const SONG_API_ORIGIN_URL = SONG_API_BASE_URL.replace(/\/api$/, "");

export const buildApiUrl = (path: string): string => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};

export const buildSongApiUrl = (path: string): string => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${SONG_API_BASE_URL}${normalizedPath}`;
};
