import { getCatalogSongs, filterCatalogSongs } from './catalogService';
import { buildSongApiUrl } from '@/lib/apiConfig';

export interface SmartSearchSong {
    id: string;
    title: string;
    artist: string;
    album: string;
    year: number | null;
    duration: number;
    imageUrl: string;
    audioUrl: string;
    source: string;
}

export interface VibeMode {
    label: string;
    mood: string;
}

export interface DetectedMood {
    emotion: string;
    baseEmotion: string;
    context: string | null;
}

export interface SmartSearchResult {
    intent: 'song' | 'artist' | 'mood';
    query: string;
    correctedQuery?: string;
    topResult: SmartSearchSong | null;
    results: SmartSearchSong[];
    similarSongs: SmartSearchSong[];
    detectedMood: DetectedMood | null;
    vibeMode: VibeMode[];
    processingTime: number;
}

// Vercel serverless function — handles JioSaavn + catalog server-side (no CORS)
const SMART_SEARCH_API = '/api/music/smart-search';

async function fetchViaServerless(query: string): Promise<SmartSearchSong[] | null> {
    try {
        const res = await fetch(
            `${SMART_SEARCH_API}?q=${encodeURIComponent(query)}`,
            { signal: AbortSignal.timeout(12000) }
        );
        if (!res.ok) return null;
        const json = await res.json();
        if (!json?.success) return null;
        return json.data?.results || [];
    } catch {
        return null;
    }
}

async function fetchJioSaavnDirect(query: string, limit = 20): Promise<SmartSearchSong[]> {
    try {
        const url = buildSongApiUrl(`/search/songs?query=${encodeURIComponent(query)}&limit=${limit}`);
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return [];
        const json = await res.json();
        const raw: any[] = json?.data?.results || json?.results || [];
        return raw
            .flatMap((s: any) => {
                if (!s?.id) return [];
                const downloads: any[] = Array.isArray(s.downloadUrl) ? s.downloadUrl : [];
                const audioUrl =
                    downloads.find((d: any) => d.quality === '320kbps')?.url ||
                    downloads.find((d: any) => d.quality === '160kbps')?.url ||
                    downloads[downloads.length - 1]?.url || '';
                if (!audioUrl) return [];
                const images: any[] = Array.isArray(s.image) ? s.image : [];
                const imageUrl =
                    images.find((i: any) => i.quality === '500x500')?.url ||
                    images[images.length - 1]?.url || '';
                const artist =
                    s.artists?.primary?.map((a: any) => a.name).join(', ') ||
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

function rankScore(s: SmartSearchSong, query: string): number {
    const q = query.toLowerCase();
    const t = s.title.toLowerCase();
    const a = s.artist.toLowerCase();
    if (t === q) return 100;
    if (t.startsWith(q)) return 80;
    if (t.includes(q)) return 60;
    if (a.includes(q)) return 30;
    return 10;
}

export const runSmartSearch = async (query: string): Promise<SmartSearchResult> => {
    const start = Date.now();

    // Try serverless first (production) — it handles JioSaavn + catalog server-side
    // Fall back to direct calls (local dev)
    const [serverlessResults, catalogSongs] = await Promise.all([
        fetchViaServerless(query),
        getCatalogSongs().catch(() => []),
    ]);

    let allResults: SmartSearchSong[];

    if (serverlessResults !== null) {
        // Serverless already merged catalog — just use results directly
        allResults = serverlessResults;
    } else {
        // Fallback: direct JioSaavn + client-side catalog merge
        const jiosaavnSongs = await fetchJioSaavnDirect(query, 20);
        const matchingCatalog = filterCatalogSongs(catalogSongs, query);
        const existingIds = new Set(jiosaavnSongs.map(s => s.id));
        const catalogResults: SmartSearchSong[] = matchingCatalog.flatMap(s => existingIds.has(s._id) ? [] : [{
                id: s._id,
                title: s.title,
                artist: s.artist,
                album: s.album || '',
                year: null,
                duration: s.duration || 0,
                imageUrl: s.imageUrl || '',
                audioUrl: s.audioUrl,
                source: 'catalog',
            }]);

        allResults = [...jiosaavnSongs, ...catalogResults]
            .sort((a, b) => {
                const yearDiff = (b.year || 0) - (a.year || 0);
                if (yearDiff !== 0) return yearDiff;
                return rankScore(b, query) - rankScore(a, query);
            });
    }

    const topResult = allResults[0] || null;
    const results = allResults.slice(1);

    return {
        intent: 'song',
        query,
        correctedQuery: query,
        topResult,
        results,
        similarSongs: [],
        detectedMood: null,
        vibeMode: [],
        processingTime: Date.now() - start,
    };
};
