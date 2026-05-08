const AUDIO_QUALITY_ORDER = ['320kbps', '160kbps', '96kbps', '48kbps', '12kbps'];
const DEFAULT_API_URL = 'https://mavrixfy-song-api.vercel.app/api';

export function getSongApiBaseUrl() {
  const raw = (process.env.VITE_SONG_API_URL || process.env.MAVRIXFY_SONG_API_URL || DEFAULT_API_URL).trim();
  const trimmed = raw.replace(/\/+$/, '');
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
}

export function buildSongApiUrl(path, params = {}) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${getSongApiBaseUrl()}${normalizedPath}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
}

export function getHighestQualityDownload(downloadUrl) {
  if (!Array.isArray(downloadUrl) || downloadUrl.length === 0) {
    return null;
  }

  for (const quality of AUDIO_QUALITY_ORDER) {
    const matched = downloadUrl.find((entry) => entry?.quality === quality);
    if (matched) {
      return matched;
    }
  }

  return downloadUrl[downloadUrl.length - 1] || null;
}

export function getHighestQualityAudioUrl(downloadUrl) {
  const bestDownload = getHighestQualityDownload(downloadUrl);
  return bestDownload?.url || bestDownload?.link || '';
}
