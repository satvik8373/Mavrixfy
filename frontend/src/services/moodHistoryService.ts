import axiosInstance from '@/lib/axios';

export interface MoodHistoryPlaylist {
    _id: string;
    name: string;
    emotion: string;
    moodText?: string;
    songs: Array<{
        _id: string;
        title: string;
        artist: string;
        album: string;
        imageUrl: string;
        audioUrl: string;
        duration: number;
    }>;
    songCount: number;
    generatedAt?: any;
    createdAt?: any;
    coverGradient?: string;
    isFinalized?: boolean;
}

export interface MoodHistoryResponse {
    playlists: MoodHistoryPlaylist[];
    total: number;
    page: number;
    totalPages: number;
    hasMore: boolean;
}

const HISTORY_TIMEOUT_MS = 20000;

const isTransientNetworkError = (error: any): boolean => {
    if (!error) return false;
    if (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED') return true;
    if ([502, 503, 504].includes(error.response?.status)) return true;
    const message = String(error.message || '').toLowerCase();
    return message.includes('network error') || message.includes('timeout') || message.includes('gateway');
};

export const fetchMoodHistory = async (page: number = 1, limit: number = 10): Promise<MoodHistoryResponse> => {
    const request = () =>
        axiosInstance.get(`/playlists/mood-history?page=${page}&limit=${limit}`, {
            timeout: HISTORY_TIMEOUT_MS
        });

    try {
        const res = await request();
        return res.data;
    } catch (error: any) {
        if (isTransientNetworkError(error)) {
            await new Promise((resolve) => setTimeout(resolve, 800));
            const retryRes = await request();
            return retryRes.data;
        }
        throw error;
    }
};

export const finalizePlaylist = async (playlistId: string): Promise<{ message: string; playlist: MoodHistoryPlaylist }> => {
    const res = await axiosInstance.post('/playlists/mood-finalize', { playlistId });
    return res.data;
};
