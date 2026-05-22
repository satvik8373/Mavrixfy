import { useState, useEffect, useCallback, useRef, useReducer } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchMoodHistory, finalizePlaylist, MoodHistoryPlaylist } from '@/services/moodHistoryService';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'react-hot-toast';
import {
    History, ChevronDown, ChevronUp, Play, Library,
    Music, Wand2, ArrowLeft,
    Smile, Frown, Heart, Angry, CloudRain, HeartCrack,
    Sunset, Flower, Flame, Zap, PartyPopper, Waves, Skull, Star,
    CheckCircle
} from 'lucide-react';
import { useInView } from 'react-intersection-observer';

const EMOTION_ICONS: Record<string, any> = {
    joy: Smile, sadness: Frown, love: Heart, anger: Angry, calm: CloudRain,
    heartbreak: HeartCrack, nostalgic: Sunset, romantic: Flower, motivated: Flame,
    energetic: Zap, party: PartyPopper, chill: Waves, fear: Skull, surprise: Star,
    default: Music
};

function formatDate(ts: any): string {
    if (!ts) return '';
    try {
        const date = ts?.toDate ? ts.toDate() : new Date(ts._seconds ? ts._seconds * 1000 : ts);
        return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return ''; }
}

function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

interface SessionCardProps {
    session: MoodHistoryPlaylist;
    onFinalize: (id: string) => Promise<void>;
    finalizing: string | null;
}

const SessionCard = ({ session, onFinalize, finalizing }: SessionCardProps) => {
    const [expanded, setExpanded] = useState(false);
    const { playAlbum, setIsPlaying } = usePlayerStore();
    const Icon = EMOTION_ICONS[session.emotion] || EMOTION_ICONS.default;
    const isF = session.isFinalized;

    const playSongs = useCallback((e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const songs = session.songs.reduce<any[]>((acc, s) => {
            if (s.audioUrl) {
                acc.push({ ...s, albumId: null, createdAt: '', updatedAt: '' });
            }
            return acc;
        }, []);
        if (!songs.length) { toast.error('No playable songs in this session'); return; }
        playAlbum(songs, 0);
        setIsPlaying(true);
        toast.success(`Playing ${session.name || 'AI Session'}`);
    }, [session, playAlbum, setIsPlaying]);

    const handleFinalizeClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onFinalize(session._id);
    }

    const playSpecificSong = (e: React.MouseEvent, idx: number) => {
        e.stopPropagation();
        const songs = session.songs.reduce<any[]>((acc, s) => {
            if (s.audioUrl) {
                acc.push({ ...s, albumId: null, createdAt: '', updatedAt: '' });
            }
            return acc;
        }, []);
        if (songs.length > 0) {
            playAlbum(songs, idx);
            setIsPlaying(true);
        }
    };

    const thumbs = Array.from(new Set(session.songs.flatMap(s => s.imageUrl ? [s.imageUrl] : []))).slice(0, 4);

    return (
        <div className="group flex flex-col w-full hover:bg-white/5 rounded-md transition-colors duration-200 overflow-hidden mb-1 sm:mb-2 border border-transparent hover:border-white/5">
            {/* Sleek Row Header */}
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.click(); } }}
                className="flex items-center p-3 sm:px-4 sm:py-3 gap-3 sm:gap-4 cursor-pointer relative"
                onClick={() => setExpanded(!expanded)}
            >
                {/* Custom Thumbnail grid */}
                <div className="w-12 h-12 sm:w-14 sm:h-14 flex-shrink-0 grid grid-cols-2 gap-[1px] rounded overflow-hidden bg-[#282828] shadow-[0_4px_10px_rgba(0,0,0,0.3)]">
                    {thumbs.length > 0 ? (
                        thumbs.map((url) => (
                            <img key={url} src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                        ))
                    ) : (
                        <div className="col-span-2 row-span-2 flex items-center justify-center">
                            <Music className="w-5 h-5 text-[#b3b3b3]" />
                        </div>
                    )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0 pr-2 sm:pr-4">
                    <h3 className="text-sm sm:text-base font-semibold text-white truncate mb-1 md:mb-0.5 group-hover:text-white transition-colors">
                        {session.name || 'Your AI Session'}
                    </h3>

                    <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-[13px] text-[#b3b3b3] truncate flex-wrap">
                        <span className="flex items-center gap-1 font-semibold text-white/90">
                            <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#1ed760]" />
                            <span className="capitalize">{session.emotion || 'Mixed'}</span>
                        </span>
                        <span className="hidden sm:inline">•</span>
                        <span className="hidden sm:inline">{formatDate(session.createdAt || session.generatedAt)}</span>
                        <span>•</span>
                        <span>{session.songs.length} songs</span>
                        <span className="sm:hidden">•</span>
                        <span className="sm:hidden">{formatDate(session.createdAt || session.generatedAt)}</span>
                    </div>
                </div>

                {/* Hover Actions */}
                <div className="flex items-center gap-2 sm:gap-4 right-4 z-10 flex-shrink-0">
                    {!isF ? (
                        <button type="button"
                            onClick={handleFinalizeClick}
                            disabled={finalizing === session._id}
                            className="hidden sm:flex text-xs font-bold uppercase tracking-widest border border-[#727272] text-white hover:border-white hover:scale-105 px-4 py-1.5 rounded-full transition-all"
                        >
                            {finalizing === session._id ? 'Saving...' : 'Save to Library'}
                        </button>
                    ) : (
                        <span className="hidden sm:flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[#1ed760]">
                            <CheckCircle className="w-4 h-4" /> Saved
                        </span>
                    )}

                    <button type="button"
                        onClick={playSongs}
                        className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:translate-y-2 sm:group-hover:translate-y-0 transition-all duration-300 w-10 h-10 sm:w-12 sm:h-12 bg-[#1ed760] rounded-full flex items-center justify-center text-black hover:scale-105 hover:bg-[#1fdf64] shadow-lg focus:opacity-100"
                        title="Play"
                    >
                        <Play className="w-5 h-5 sm:w-6 sm:h-6 ml-1 fill-black" />
                    </button>

                    <button type="button"
                        className="hidden sm:flex text-[#b3b3b3] hover:text-white transition-colors p-1"
                        title={expanded ? "Collapse" : "Expand"}
                    >
                        {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            {/* Expander Content */}
            {expanded && (
                <div className="bg-black/20 pb-4 sm:ml-4 sm:mr-4 rounded-xl mt-1">
                    {/* Mobile Finalize button */}
                    <div className="sm:hidden px-4 py-3 flex justify-between items-center border-b border-white/5">
                        {!isF ? (
                            <button type="button"
                                onClick={handleFinalizeClick}
                                disabled={finalizing === session._id}
                                className="text-[10px] font-bold uppercase tracking-widest border border-[#727272] text-white hover:border-white px-3 py-1.5 rounded-full transition-all"
                            >
                                {finalizing === session._id ? 'Saving...' : 'Save to Library'}
                            </button>
                        ) : (
                            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[#1ed760]">
                                <CheckCircle className="w-3.5 h-3.5" /> Saved
                            </span>
                        )}
                        <span className="text-xs text-[#b3b3b3]">{session.songs.length} tracks</span>
                    </div>

                    {/* Table Header like Mavrixfy */}
                    <div className="hidden sm:grid grid-cols-[auto_1fr_auto] gap-4 px-6 py-2 border-b border-white/5 text-xs text-[#b3b3b3] font-medium tracking-wider uppercase mt-2">
                        <div className="w-8 text-center">#</div>
                        <div>Title</div>
                        <div className="flex justify-end pr-4"><History className="w-4 h-4" /></div>
                    </div>

                    <div className="flex flex-col mt-2 max-h-96 overflow-y-auto custom-scrollbar">
                        {session.songs.map((song, idx) => (
                            <div role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.click(); } }} key={song._id || idx} className="grid grid-cols-[1fr_auto] sm:grid-cols-[auto_1fr_auto] gap-3 sm:gap-4 px-4 sm:px-6 py-2 sm:py-2.5 hover:bg-white/10 group/track transition-colors rounded-sm mx-0 sm:mx-2 cursor-pointer" onClick={(e) => playSpecificSong(e, idx)}>
                                <div className="hidden sm:flex w-8 items-center justify-center text-[#b3b3b3] text-sm group-hover/track:text-white">
                                    <span className="group-hover/track:hidden">{idx + 1}</span>
                                    <Play className="w-4 h-4 hidden group-hover/track:block fill-white" />
                                </div>
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded shrink-0 overflow-hidden bg-[#282828] relative flex items-center justify-center">
                                        {song.imageUrl ? (
                                            <img src={song.imageUrl} alt={song.title} className="w-full h-full object-cover" loading="lazy" />
                                        ) : (
                                            <Music className="w-4 h-4 text-[#b3b3b3]" />
                                        )}
                                        {/* Mobile play overlay */}
                                        <div className="absolute inset-0 bg-black/40 hidden group-hover/track:flex sm:hidden items-center justify-center">
                                            <Play className="w-4 h-4 fill-white" />
                                        </div>
                                    </div>
                                    <div className="flex flex-col justify-center overflow-hidden">
                                        <div className="text-sm sm:text-[15px] font-normal text-white truncate leading-tight mb-0.5">{song.title}</div>
                                        <div className="text-xs sm:text-[13px] text-[#b3b3b3] truncate hover:text-white transition-colors">{song.artist}</div>
                                    </div>
                                </div>
                                <div className="flex items-center text-xs sm:text-sm text-[#b3b3b3] pr-2 sm:pr-4 group-hover/track:text-white transition-colors">
                                    {formatDuration(song.duration)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

interface MoodHistoryState {
    sessions: MoodHistoryPlaylist[];
    loading: boolean;
    finalizing: string | null;
    hasMore: boolean;
    totalCount: number;
}

type MoodHistoryAction =
    | { type: 'loading'; page: number }
    | { type: 'loaded'; page: number; playlists: MoodHistoryPlaylist[]; hasMore: boolean; totalCount: number }
    | { type: 'failed' }
    | { type: 'finalizing'; id: string | null }
    | { type: 'finalized'; id: string; name?: string };

const moodHistoryReducer = (state: MoodHistoryState, action: MoodHistoryAction): MoodHistoryState => {
    switch (action.type) {
        case 'loading':
            return action.page === 1 ? { ...state, loading: true } : state;
        case 'loaded':
            return {
                ...state,
                sessions: action.page === 1 ? action.playlists : [...state.sessions, ...action.playlists],
                totalCount: action.page === 1 ? action.totalCount : state.totalCount,
                hasMore: action.hasMore,
                loading: false,
            };
        case 'failed':
            return { ...state, loading: false };
        case 'finalizing':
            return { ...state, finalizing: action.id };
        case 'finalized':
            return {
                ...state,
                sessions: state.sessions.map((session) => (
                    session._id === action.id
                        ? { ...session, isFinalized: true, name: action.name || session.name }
                        : session
                )),
                finalizing: null,
            };
        default:
            return state;
    }
};

export default function MoodHistoryPage() {
    const [{ sessions, loading, finalizing, hasMore, totalCount }, dispatchHistory] = useReducer(moodHistoryReducer, {
        sessions: [],
        loading: true,
        finalizing: null,
        hasMore: true,
        totalCount: 0,
    });
    const pageRef = useRef(1);
    const loadingMoreRef = useRef(false);

    const { isAuthenticated, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const { ref, inView } = useInView({ threshold: 0.1 });

    const loadSessions = useCallback(async (p: number) => {
        try {
            if (p === 1) {
                dispatchHistory({ type: 'loading', page: p });
            } else {
                loadingMoreRef.current = true;
            }

            const res = await fetchMoodHistory(p, 10);
            dispatchHistory({
                type: 'loaded',
                page: p,
                playlists: res.playlists,
                hasMore: res.hasMore,
                totalCount: res.total ?? res.playlists.length,
            });
        } catch (err) {
            toast.error('Failed to load history');
            dispatchHistory({ type: 'failed' });
        } finally {
            loadingMoreRef.current = false;
        }
    }, []);

    useEffect(() => {
        if (authLoading) return;
        if (!isAuthenticated) return navigate('/login');
        loadSessions(1);
    }, [authLoading, isAuthenticated, navigate, loadSessions]);

    useEffect(() => {
        if (inView && hasMore && !loading && !loadingMoreRef.current) {
            pageRef.current += 1;
            loadSessions(pageRef.current);
        }
    }, [inView, hasMore, loading, loadSessions]);

    const handleFinalize = useCallback(async (id: string) => {
        dispatchHistory({ type: 'finalizing', id });
        try {
            const res = await finalizePlaylist(id);
            toast.success(res.message || 'Added to your Library!');
            dispatchHistory({ type: 'finalized', id, name: res.playlist?.name });
        } catch (err: any) {
            const msg = err?.response?.data?.message || 'Failed to finalize. Please try again.';
            toast.error(msg);
            dispatchHistory({ type: 'finalizing', id: null });
        } finally {
            dispatchHistory({ type: 'finalizing', id: null });
        }
    }, []);

    const songsGeneratedCount = sessions.reduce((a, s) => a + (s.songs?.length || 0), 0);
    const savedCount = sessions.filter(s => s.isFinalized).length;

    return (
        <div className="relative min-h-screen bg-[#121212] text-white w-full mx-auto pb-32 overflow-x-hidden">
            {/* Background Ambient Gradient */}
            <div className="absolute top-0 left-0 right-0 h-[400px] bg-gradient-to-b from-[#251029]/80 to-[#121212] pointer-events-none" />

            <div className="relative z-10 px-4 sm:p-6 sm:py-8 w-full">
                {/* Header Back Nav */}
                <div className="flex items-center mb-6 sm:mb-8">
                    <button type="button"
                        onClick={() => navigate(-1)}
                        className="w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 flex items-center justify-center transition-colors shadow-md"
                    >
                        <ArrowLeft className="w-5 h-5 text-white" />
                    </button>
                    <span className="ml-4 font-bold tracking-widest uppercase text-xs sm:hidden text-white/70">Mood History</span>
                </div>

                {/* Hero Title Section */}
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 sm:gap-8 mb-8 sm:mb-12 mt-2 sm:mt-4">
                    <div className="flex flex-col sm:flex-row gap-6 sm:items-end">
                        {/* Big beautiful cover pseudo-icon */}
                        <div className="w-32 h-32 sm:w-48 sm:h-48 bg-gradient-to-br from-[#712b7a] to-[#251029] shadow-[0_8px_24px_rgba(0,0,0,0.5)] flex-shrink-0 flex items-center justify-center rounded-sm mx-auto sm:mx-0">
                            <History className="w-16 h-16 sm:w-24 sm:h-24 text-white/80" />
                        </div>
                        <div className="flex flex-col gap-2 sm:gap-3 text-center sm:text-left">
                            <span className="hidden sm:block text-sm font-bold uppercase tracking-[0.15em] text-white/90">History</span>
                            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-semibold text-white tracking-tighter shadow-black/20 text-shadow-sm leading-tight sm:pb-1">
                                Mood History
                            </h1>
                            <div className="text-xs sm:text-sm font-medium text-white/70 flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 mt-1 sm:mt-2 flex-wrap px-2 sm:px-0">
                                <span className="text-white relative top-px"><Library className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></span>
                                <span className="font-bold text-white">{totalCount || sessions.length} <span className="font-normal text-white/70">sessions</span></span>
                                <span>•</span>
                                <span className="font-bold text-white">{songsGeneratedCount} <span className="font-normal text-white/70">songs generated</span></span>
                                <span className="hidden md:inline">•</span>
                                <span className="font-bold text-white hidden md:inline">{savedCount} <span className="font-normal text-white/70">in library</span></span>
                            </div>
                        </div>
                    </div>

                    <button type="button"
                        onClick={() => navigate('/mood-playlist')}
                        className="flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-105 active:scale-95 rounded-full text-black font-bold uppercase tracking-widest text-xs sm:text-sm transition-all shadow-[0_6px_12px_rgba(30,215,96,0.2)] mx-auto lg:mx-0 w-full lg:w-auto max-w-xs lg:max-w-none"
                    >
                        <Wand2 className="w-4 h-4 sm:w-5 sm:h-5 text-black" />
                        New Mood
                    </button>
                </div>

                {/* Content */}
                {loading || authLoading ? (
                    <div className="flex flex-col items-center justify-center py-24 sm:py-32 gap-4">
                        <div className="w-10 h-10 border-[3px] border-white/10 border-t-[#1ed760] rounded-full animate-spin" />
                    </div>
                ) : sessions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 sm:py-24 gap-4 text-center">
                        <History className="w-12 h-12 sm:w-20 sm:h-20 text-[#b3b3b3] mb-2 sm:mb-4" />
                        <h2 className="text-xl sm:text-3xl font-semibold">No mood sessions yet</h2>
                        <p className="text-sm sm:text-base text-[#b3b3b3] max-w-sm mx-auto px-4">Generate your first AI mood playlist and it will appear here along with your listening history.</p>
                        <button type="button"
                            onClick={() => navigate('/mood-playlist')}
                            className="mt-6 px-8 py-3 bg-white text-black rounded-full font-bold hover:scale-105 transition-transform"
                        >
                            Create a Mood
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-0 sm:gap-1 mt-6">
                        {sessions.map(session => (
                            <SessionCard
                                key={session._id}
                                session={session}
                                onFinalize={handleFinalize}
                                finalizing={finalizing}
                            />
                        ))}

                        {/* Infinite Scroll trigger */}
                        {hasMore && (
                            <div ref={ref} className="py-12 flex justify-center">
                                <div className="w-8 h-8 border-[3px] border-white/10 border-t-[#1ed760] rounded-full animate-spin" />
                            </div>
                        )}

                        {!hasMore && sessions.length > 0 && (
                            <div className="py-12 sm:py-16 px-4 text-center">
                                <p className="text-[#b3b3b3] text-[13px] font-medium tracking-wide">You've reached the end of your mood history.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

