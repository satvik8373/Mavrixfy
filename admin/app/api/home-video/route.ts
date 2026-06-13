import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { AdminApiError, requireAdminPermission } from '@/lib/admin-api-auth';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface CatalogSong {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  coverUrl: string;
  audioUrl: string;
  genre: string;
}

interface HomeHeroVideoItem {
  id: string;
  enabled: boolean;
  title: string;
  videoUrl: string;
  posterUrl: string;
  adUnitId?: string;
  linkUrl: string;
  songId: string;
  song: CatalogSong | null;
  linkType?: 'song' | 'album' | 'playlist';
  album?: any | null;
  playlist?: any | null;
}

interface HomeHeroConfig {
  enabled: boolean;
  title: string;
  videoUrl: string;
  posterUrl: string;
  adUnitId?: string;
  items: HomeHeroVideoItem[];
}

const DEFAULT_VIDEO_ITEM: HomeHeroVideoItem = {
  id: 'default-home-video',
  enabled: true,
  title: 'COCKTAIL 2',
  videoUrl:
    'https://res.cloudinary.com/djqq8kba8/video/upload/f_mp4,vc_h264,c_crop,g_center,w_1440,h_810/c_fill,w_1080,h_608,q_auto:good/v1780900137/Cocktail_2_Official_Trailer___Shahid_Kapoor_Kriti_Sanon_Rashmika_Mandanna___In_Cinemas_19th_June_1440p_dwlaum.mp4',
  posterUrl:
    'https://res.cloudinary.com/djqq8kba8/video/upload/so_2,c_crop,g_center,w_1440,h_810/c_fill,w_1080,h_608,q_auto,f_jpg/v1780900137/Cocktail_2_Official_Trailer___Shahid_Kapoor_Kriti_Sanon_Rashmika_Mandanna___In_Cinemas_19th_June_1440p_dwlaum.jpg',
  adUnitId: '',
  linkUrl: '',
  songId: '',
  song: null,
  linkType: 'song',
  album: null,
  playlist: null,
};

function trimString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function toNumber(value: unknown) {
  const next = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(next) && next > 0 ? next : 0;
}

function normalizeSong(value: unknown): CatalogSong | null {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const id = trimString(record.id);
  const title = trimString(record.title);
  const audioUrl = trimString(record.audioUrl);
  if (!id || !title || !audioUrl) return null;

  return {
    id,
    title,
    artist: trimString(record.artist) || 'Unknown Artist',
    album: trimString(record.album),
    duration: toNumber(record.duration),
    coverUrl: trimString(record.coverUrl),
    audioUrl,
    genre: trimString(record.genre),
  };
}

function normalizeVideoItem(value: unknown, index: number): HomeHeroVideoItem | null {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const videoUrl = trimString(record.videoUrl);
  const adUnitId = trimString(record.adUnitId);
  if (!videoUrl && !adUnitId) return null;

  const song = normalizeSong(record.song);

  return {
    id: trimString(record.id) || `home-video-${index + 1}`,
    enabled: typeof record.enabled === 'boolean' ? record.enabled : true,
    title: trimString(record.title) || DEFAULT_VIDEO_ITEM.title,
    videoUrl,
    posterUrl: trimString(record.posterUrl),
    adUnitId,
    linkUrl: trimString(record.linkUrl),
    songId: trimString(record.songId) || song?.id || '',
    song,
    linkType: (record.linkType === 'song' || record.linkType === 'album' || record.linkType === 'playlist') ? record.linkType : 'song',
    album: record.album || null,
    playlist: record.playlist || null,
  };
}

function normalizeConfig(value: unknown): HomeHeroConfig {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const fallbackItem: HomeHeroVideoItem = {
    ...DEFAULT_VIDEO_ITEM,
    title: trimString(record.title) || DEFAULT_VIDEO_ITEM.title,
    videoUrl: trimString(record.videoUrl) || DEFAULT_VIDEO_ITEM.videoUrl,
    posterUrl: trimString(record.posterUrl) || DEFAULT_VIDEO_ITEM.posterUrl,
    adUnitId: trimString(record.adUnitId),
  };
  const configuredItems = Array.isArray(record.items)
    ? record.items
        .map((item, index) => normalizeVideoItem(item, index))
        .filter((item): item is HomeHeroVideoItem => Boolean(item))
    : [];
  const items = configuredItems.length > 0 ? configuredItems : [fallbackItem];
  const firstVisibleItem = items.find((item) => item.enabled) || items[0] || fallbackItem;

  return {
    enabled: typeof record.enabled === 'boolean' ? record.enabled : true,
    title: firstVisibleItem.title,
    videoUrl: firstVisibleItem.videoUrl,
    posterUrl: firstVisibleItem.posterUrl,
    adUnitId: firstVisibleItem.adUnitId || trimString(record.adUnitId),
    items,
  };
}

function jsonError(error: unknown) {
  if (error instanceof AdminApiError) {
    return NextResponse.json({ success: false, message: error.message }, { status: error.status });
  }

  console.error('[home-video]', error);
  return NextResponse.json(
    { success: false, message: error instanceof Error ? error.message : 'Failed to update home video settings.' },
    { status: 500 }
  );
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminPermission(request, 'home_video.manage');

    const snapshot = await adminDb.collection('appConfig').doc('homeHero').get();
    const config = normalizeConfig(snapshot.exists ? snapshot.data() : undefined);

    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requireAdminPermission(request, 'home_video.manage');
    const body = await request.json();
    const config = normalizeConfig(body);

    await adminDb.collection('appConfig').doc('homeHero').set(
      {
        ...config,
        schemaVersion: 2,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: session.uid,
      },
      { merge: true }
    );

    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    return jsonError(error);
  }
}
