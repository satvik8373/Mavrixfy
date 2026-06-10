import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SONG_API_BASE_URL = (
  process.env.JIOSAAVN_API_BASE_URL ||
  process.env.VITE_SONG_API_URL ||
  'https://mavrixfy-song-api.vercel.app/api'
).replace(/\/+$/, '');

function trimString(value: unknown): string {
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

function getMediaUrl(item?: { url?: string; link?: string }) {
  return item?.url || item?.link || '';
}

function normalizeApiSong(s: any): any {
  const bestDownload = Array.isArray(s.downloadUrl)
    ? getMediaUrl(s.downloadUrl.find((u: any) => u.quality === '320kbps') ||
      s.downloadUrl.find((u: any) => u.quality === '160kbps') ||
      s.downloadUrl[s.downloadUrl.length - 1])
    : '';
  const bestAudio = bestDownload || s.streamUrl || s.url || '';

  const img = Array.isArray(s.image)
    ? (getMediaUrl(s.image[s.image.length - 1]) || getMediaUrl(s.image[0]))
    : (typeof s.image === 'string' ? s.image : s.imageUrl || '');

  const artist = s.artists?.primary?.map((a: any) => a.name).join(', ')
    || s.primaryArtists
    || s.artist
    || '';

  const album = typeof s.album === 'object' && s.album !== null
    ? (s.album.name || '')
    : (typeof s.album === 'string' ? s.album : '');

  return {
    id: `api_${s.id}`,
    title: s.name || s.title || '',
    artist,
    album,
    genre: s.genre || s.language || '',
    duration: s.duration ? Number(s.duration) : undefined,
    imageUrl: img,
    audioUrl: bestAudio || '',
    streamUrl: bestAudio || '',
    year: s.year ? Number(s.year) : undefined,
    releaseDate: s.releaseDate || null,
    source: s.source || 'jiosaavn',
    sourceLabel: s.sourceLabel || s.source || 'jiosaavn',
    playbackType: s.playbackType || (bestAudio ? 'audio' : undefined),
    externalUrl: s.externalUrl || s.url || '',
    inFirestore: false,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const albumId = trimString(searchParams.get('id'));

  if (!albumId) {
    return NextResponse.json(
      { success: false, message: 'Album ID is required' },
      { status: 400 }
    );
  }

  try {
    const url = `${SONG_API_BASE_URL}/albums?id=${albumId}`;
    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        'user-agent': 'MavrixfyAdmin/1.0 (+https://mavrixfy.site)',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch album details from JioSaavn: ${response.statusText}`);
    }

    const payload = await response.json();
    const data = payload?.data || payload || {};
    const songs = Array.isArray(data.songs) ? data.songs : [];
    const normalizedSongs = songs.map(normalizeApiSong).filter((s: any) => Boolean(s.audioUrl));

    return NextResponse.json({
      success: true,
      data: {
        id: data.id,
        name: decodeHtmlEntities(data.name || ''),
        artist: decodeHtmlEntities(data.primaryArtists || data.artist || ''),
        year: data.year ? Number(data.year) : undefined,
        imageUrl: Array.isArray(data.image) ? getMediaUrl(data.image[data.image.length - 1]) : data.image || '',
        songs: normalizedSongs,
      },
    });
  } catch (error: any) {
    console.error('[album-songs-fetch]', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch album songs.' },
      { status: 500 }
    );
  }
}
