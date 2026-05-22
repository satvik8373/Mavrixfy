/**
 * Smart Search API — Vercel serverless function
 * Searches the configured Mavrixfy song API + Firestore catalog via REST API
 * Runs server-side so no CORS issues from the browser
 */

import { buildSongApiUrl } from '../utils.js';

const FIREBASE_PROJECT_ID = 'spotify-8fefc';
const FIRESTORE_REST = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

async function searchJioSaavn(query, limit = 20) {
  try {
    const res = await fetch(buildSongApiUrl('/search/songs', { query, limit }), {
      headers: { 'User-Agent': 'MavrixfyApp/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const json = await res.json();
    const raw = json?.data?.results || json?.results || [];
    return raw.flatMap(s => {
      if (!s?.id) return [];
      const downloads = Array.isArray(s.downloadUrl) ? s.downloadUrl : [];
      const audioUrl =
        downloads.find(d => d.quality === '320kbps')?.url ||
        downloads.find(d => d.quality === '160kbps')?.url ||
        downloads[downloads.length - 1]?.url || '';
      if (!audioUrl) return [];

      const images = Array.isArray(s.image) ? s.image : [];
      const imageUrl =
        images.find(i => i.quality === '500x500')?.url ||
        images[images.length - 1]?.url || '';
      const artist =
        s.artists?.primary?.map(a => a.name).join(', ') ||
        s.primaryArtists || s.artist || 'Unknown Artist';
      return [{
        id: s.id,
        title: s.name || s.title || '',
        artist,
        album: s.album?.name || '',
        year: s.year ? Number(s.year) : null,
        duration: Number(s.duration) || 0,
        imageUrl,
        audioUrl,
        source: 'jiosaavn',
      }];
    });
  } catch {
    return [];
  }
}

function getFieldValue(field) {
  if (!field) return null;
  return field.stringValue ?? field.integerValue ?? field.doubleValue ?? field.booleanValue ?? null;
}

async function getCatalogSongs() {
  try {
    // Firestore REST API — songs collection is publicly readable
    const res = await fetch(`${FIRESTORE_REST}/songs?pageSize=200`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const json = await res.json();
    const docs = json.documents || [];
    return docs.flatMap(doc => {
      const f = doc.fields || {};
      const audioUrl = getFieldValue(f.audioUrl) || getFieldValue(f.streamUrl) || getFieldValue(f.url) || '';
      const title = getFieldValue(f.title) || getFieldValue(f.name) || '';
      if (!audioUrl || !title) return [];
      const id = doc.name.split('/').pop();
      return [{
        id,
        title,
        artist: getFieldValue(f.artist) || getFieldValue(f.primaryArtists) || 'Unknown Artist',
        album: getFieldValue(f.album) || '',
        year: f.year ? Number(getFieldValue(f.year)) : null,
        duration: f.duration ? Number(getFieldValue(f.duration)) : 0,
        imageUrl: getFieldValue(f.imageUrl) || '',
        audioUrl,
        source: 'catalog',
      }];
    });
  } catch (e) {
    console.error('[smart-search] Firestore REST error:', e.message);
    return [];
  }
}

function matchesCatalog(song, query) {
  const q = query.toLowerCase();
  return (
    song.title.toLowerCase().includes(q) ||
    song.artist.toLowerCase().includes(q) ||
    (song.album || '').toLowerCase().includes(q)
  );
}

function rankScore(song, query) {
  const q = query.toLowerCase();
  const t = song.title.toLowerCase();
  const a = song.artist.toLowerCase();
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  if (t.includes(q)) return 60;
  if (a.includes(q)) return 30;
  return 10;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const query = (req.query.q || req.query.query || '').trim();
  if (!query) {
    return res.status(400).json({ success: false, message: 'Query required' });
  }

  try {
    const [jiosaavnSongs, catalogSongs] = await Promise.all([
      searchJioSaavn(query, 20),
      getCatalogSongs(),
    ]);

    const existingIds = new Set(jiosaavnSongs.map(s => s.id));
    const matchingCatalog = catalogSongs.filter(
      s => matchesCatalog(s, query) && !existingIds.has(s.id)
    );

    const allResults = [...jiosaavnSongs, ...matchingCatalog]
      .sort((a, b) => {
        const yearDiff = (b.year || 0) - (a.year || 0);
        if (yearDiff !== 0) return yearDiff;
        return rankScore(b, query) - rankScore(a, query);
      });

    return res.status(200).json({
      success: true,
      data: {
        query,
        total: allResults.length,
        results: allResults,
      },
    });
  } catch (err) {
    console.error('[smart-search] Error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}
