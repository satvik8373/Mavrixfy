/**
 * Catalog Service — fetches admin-uploaded songs from Firestore
 * and converts them to the app's Song format.
 */
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Song } from '@/types';

let _cache: Song[] | null = null;
let _cacheTime = 0;
const CACHE_TTL = 30 * 1000; // 30 seconds

export async function getCatalogSongs(forceRefresh = false): Promise<Song[]> {
  const now = Date.now();
  if (!forceRefresh && _cache && now - _cacheTime < CACHE_TTL) return _cache;

  try {
    let snap;
    try {
      snap = await getDocs(query(collection(db, 'songs'), orderBy('createdAt', 'desc')));
    } catch {
      snap = await getDocs(collection(db, 'songs'));
    }

    const songs: Song[] = snap.docs.flatMap(d => {
      const data = d.data();
      const audioUrl = data.audioUrl || data.streamUrl || data.url || '';
      if (!audioUrl || !data.title) return [];

      let imageUrl = data.imageUrl || '';
      if (!imageUrl && Array.isArray(data.image)) {
        imageUrl = data.image[data.image.length - 1]?.url || '';
      }

      return [{
        _id: d.id,
        title: data.title || data.name || '',
        artist: data.artist || data.primaryArtists || 'Unknown Artist',
        album: typeof data.album === 'object' ? (data.album?.name || null) : (data.album || null),
        albumId: null,
        imageUrl,
        audioUrl,
        streamUrl: audioUrl,
        storagePath: data.storagePath || null,
        fileName: data.fileName || null,
        fileSize: data.fileSize || null,
        mimeType: data.mimeType || null,
        uploadedAt: data.uploadedAt || null,
        duration: data.duration ? Number(data.duration) : 0,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        source: 'catalog',
      } as Song & { source: string }];
    });

    _cache = songs;
    _cacheTime = now;
    return songs;
  } catch (e) {
    console.error('[CatalogService] Failed to fetch:', e);
    return [];
  }
}

export function filterCatalogSongs(songs: Song[], query: string): Song[] {
  if (!query.trim()) return songs;
  const q = query.toLowerCase();
  return songs.filter(s =>
    s.title?.toLowerCase().includes(q) ||
    s.artist?.toLowerCase().includes(q) ||
    s.album?.toLowerCase().includes(q)
  );
}
