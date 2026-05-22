import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type TargetType = 'playlist' | 'artist' | 'album';

const SONG_API_BASE_URL = (
  process.env.JIOSAAVN_API_BASE_URL ||
  process.env.VITE_SONG_API_URL ||
  'https://mavrixfy-song-api.vercel.app/api'
).replace(/\/+$/, '');

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

function bestImage(image: unknown): string {
  if (Array.isArray(image)) {
    const media = image.flatMap((item) => {
      const mediaItem = {
        quality: asString(item?.quality),
        url: asString(item?.url || item?.link),
      };
      return mediaItem.url ? [mediaItem] : [];
    });

    return (
      media.find((item) => item.quality === '500x500')?.url ||
      media.find((item) => item.quality === '150x150')?.url ||
      media[media.length - 1]?.url ||
      ''
    );
  }

  return asString(image);
}

function artistNames(item: any): string {
  const primary = item?.artists?.primary;
  if (Array.isArray(primary) && primary.length > 0) {
    return primary.flatMap((artist) => {
      const name = decodeHtmlEntities(artist?.name);
      return name ? [name] : [];
    }).join(', ');
  }

  return decodeHtmlEntities(item?.primaryArtists || item?.artist || item?.role || '');
}

function normalizeTarget(item: any, type: TargetType) {
  const id = asString(item?.id);
  const title = decodeHtmlEntities(item?.name || item?.title);
  if (!id || !title) return null;

  const subtitle =
    type === 'playlist'
      ? [item?.songCount ? `${item.songCount} songs` : '', decodeHtmlEntities(item?.language)]
          .flatMap((value) => value ? [value] : [])
          .join(' • ')
      : type === 'album'
        ? [artistNames(item), item?.year ? String(item.year) : '', decodeHtmlEntities(item?.language)]
            .flatMap((value) => value ? [value] : [])
            .join(' • ')
        : decodeHtmlEntities(item?.role || item?.description || 'Artist');

  return {
    id,
    title,
    subtitle,
    imageUrl: bestImage(item?.image),
    actionType: type,
    actionUrl: id,
    externalUrl: asString(item?.url),
  };
}

function extractResults(payload: any): any[] {
  const data = payload?.data || payload;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(data)) return data;
  return [];
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

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const type = searchParams.get('type') as TargetType | null;
  const query = (searchParams.get('query') || searchParams.get('q') || '').trim();
  const limit = Math.min(50, Math.max(1, Number.parseInt(searchParams.get('limit') || '20', 10) || 20));

  if (!type || !['playlist', 'artist', 'album'].includes(type)) {
    return NextResponse.json(
      { success: false, message: 'Target type must be playlist, artist, or album' },
      { status: 400 }
    );
  }

  if (!query) {
    return NextResponse.json(
      { success: false, message: 'Search query is required' },
      { status: 400 }
    );
  }

  try {
    const url = new URL(`${SONG_API_BASE_URL}/search/${type}s`);
    url.searchParams.set('query', query);
    url.searchParams.set('limit', String(limit));

    const payload = await fetchJson(url.toString());
    const results = extractResults(payload)
      .flatMap((item) => {
        const normalized = normalizeTarget(item, type);
        return normalized ? [normalized] : [];
      })
      .slice(0, limit);

    return NextResponse.json({
      success: true,
      data: {
        total: results.length,
        results,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Search failed',
      },
      { status: 502 }
    );
  }
}
