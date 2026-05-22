import React, { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Play, Heart, Share2, Music, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Song } from '@/types';

interface MoodPlaylist {
    _id: string;
    name: string;
    emotion: 'sadness' | 'joy' | 'anger' | 'love' | 'fear' | 'surprise';
    songs: Song[];
    songCount: number;
    generatedAt: string;
    cached?: boolean;
}

interface MoodPlaylistDisplayMobileProps {
    playlist: MoodPlaylist;
    bottomInsetPx: number;
    onPlay: (index?: number) => void;
    onSave: () => void;
    onShare: () => void;
    onTryAgain: () => void;
}

const emotionThemes = {
    sadness: { badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    joy: { badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    anger: { badge: 'bg-red-500/20 text-red-400 border-red-500/30' },
    love: { badge: 'bg-pink-500/20 text-pink-400 border-pink-500/30' },
    fear: { badge: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    surprise: { badge: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
};

const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const MoodPlaylistDisplayMobile: React.FC<MoodPlaylistDisplayMobileProps> = ({
    playlist,
    bottomInsetPx,
    onPlay,
    onSave,
    onShare,
    onTryAgain,
}) => {
    const stripRef = useRef<HTMLDivElement>(null);
    const actionBarRef = useRef<HTMLDivElement>(null);
    const [actionBarHeight, setActionBarHeight] = useState(140);
    const emotion = playlist.emotion && emotionThemes[playlist.emotion] ? playlist.emotion : 'joy';
    const theme = emotionThemes[emotion];
    const stripSongs = playlist.songs.slice(0, 8);

    useEffect(() => {
        const node = actionBarRef.current;
        if (!node) return;

        const updateHeight = () => {
            const next = Math.ceil(node.offsetHeight);
            setActionBarHeight((prev) => (prev === next ? prev : next));
        };

        updateHeight();

        const observer = new ResizeObserver(updateHeight);
        observer.observe(node);

        return () => observer.disconnect();
    }, []);

    return (
        /*
         * iPhone one-handed layout:
         * - Album swipe strip + scrollable song list fill the top
         * - Action bar (Play All, New Mood, Save, Share) pinned at the bottom
         */
        <div className="relative flex h-full min-h-0 flex-col">

            {/* ── Scrollable content: strip + song list ── */}
            <div
                className="flex-1 min-h-0 overflow-y-auto scrollbar-hide pt-10 px-3"
                style={{ paddingBottom: `calc(${bottomInsetPx + actionBarHeight + 24}px + env(safe-area-inset-bottom, 0px))` }}
            >

                {/* Playlist title + badge */}
                <div className="flex items-center gap-2 mb-3">
                    <span className="text-base font-black text-white truncate flex-1">{playlist.name}</span>
                    <Badge className={cn('px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase shrink-0', theme.badge)}>
                        {emotion}
                    </Badge>
                </div>

                {/* ── Album Art Swipe Strip ── */}
                <div className="mb-4">
                    <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-2">
                        Swipe to preview
                    </p>
                    <div
                        ref={stripRef}
                        className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-1"
                    >
                        {stripSongs.map((song, index) => (
                            <button type="button"
                                key={song._id || `strip-${index}`}
                                onClick={() => onPlay(index)}
                                className="flex-shrink-0 snap-start flex flex-col items-start active:scale-95 transition-transform duration-150"
                                style={{ width: '90px' }}
                            >
                                <div className="w-[90px] h-[90px] rounded-2xl overflow-hidden bg-white/5 mb-1.5 shadow-xl relative">
                                    {song.imageUrl ? (
                                        <img src={song.imageUrl} alt={song.title} width={90} height={90} className="w-full h-full object-cover aspect-square" loading={index < 3 ? "eager" : "lazy"} />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Music className="w-8 h-8 text-white/20" />
                                        </div>
                                    )}
                                    {/* index badge */}
                                    <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
                                        <span className="text-[9px] font-bold text-white/80">{index + 1}</span>
                                    </div>
                                </div>
                                <span className="text-[10px] font-bold text-white/80 truncate w-full leading-tight">{song.title}</span>
                                <span className="text-[9px] text-white/40 truncate w-full">{song.artist}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-2 mb-2">
                    <div className="h-px bg-white/8 flex-1 rounded-full" />
                    <span className="text-[10px] text-white/25 font-semibold uppercase tracking-widest">
                        All {playlist.songCount} Songs
                    </span>
                    <div className="h-px bg-white/8 flex-1 rounded-full" />
                </div>

                {/* ── Full Song List ── */}
                <div className="flex flex-col gap-1 pb-2">
                    {playlist.songs.map((song, index) => (
                        <div
                          role="button"
                          tabIndex={0}
                          onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.click(); } }}
                            key={song._id || `song-${index}`}
                            onClick={() => onPlay(index)}
                            className="flex items-center gap-3 px-3 py-2.5 bg-black/45 backdrop-blur-sm active:bg-black/60 cursor-pointer rounded-xl border border-white/[0.08] transition-all active:scale-[0.99]"
                        >
                            <span className="w-5 text-center text-[10px] text-white/35 font-bold group-active:text-green-400 shrink-0">
                                {index + 1}
                            </span>
                            <div className="w-10 h-10 rounded-xl overflow-hidden bg-white/5 flex-shrink-0 shadow-md">
                                {song.imageUrl ? (
                                    <img src={song.imageUrl} alt={song.title} width={40} height={40} className="w-full h-full object-cover aspect-square" loading={index < 5 ? "eager" : "lazy"} />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <Music className="w-4 h-4 text-white/30" />
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-[13px] font-bold text-white truncate leading-tight">
                                    {song.title}
                                </div>
                                <div className="text-[11px] text-white/65 truncate font-medium">
                                    {song.artist}
                                </div>
                            </div>
                            <span className="text-[11px] text-white/45 font-semibold tabular-nums shrink-0">
                                {formatDuration(song.duration)}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Fixed bottom action bar (thumb zone) ── */}
            <div
                className="fixed left-0 right-0 z-30 px-3 pt-2"
                style={{ bottom: `calc(${bottomInsetPx}px + env(safe-area-inset-bottom, 0px) + 8px)` }}
            >
                <div ref={actionBarRef} className="mx-auto w-full max-w-md bg-black/55 backdrop-blur-2xl rounded-2xl border border-white/[0.10] p-3 shadow-2xl">
                    {/* Row 1: playlist name mini + save/share */}
                    <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <div className="w-8 h-8 rounded-lg overflow-hidden bg-white/5 flex-shrink-0">
                                {playlist.songs[0]?.imageUrl ? (
                                    <img src={playlist.songs[0].imageUrl} alt="" className="w-full h-full object-cover" loading="eager" />
                                ) : (
                                    <Music className="w-4 h-4 text-white/30 m-auto" />
                                )}
                            </div>
                            <div className="min-w-0">
                                <div className="text-xs font-black text-white truncate">{playlist.name}</div>
                                <div className="text-[10px] text-white/40">{playlist.songCount} songs</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <button type="button"
                                onClick={onSave}
                                className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-pink-400 active:bg-white/15 transition-colors"
                            >
                                <Heart className="w-4 h-4" />
                            </button>
                            <button type="button"
                                onClick={onShare}
                                className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-indigo-400 active:bg-white/15 transition-colors"
                            >
                                <Share2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Row 2: Play All + New Mood — large easy tap targets */}
                    <div className="flex gap-2">
                        <button type="button"
                            onClick={() => onPlay(0)}
                            className="flex-1 h-12 rounded-xl bg-gradient-to-r from-green-500 to-emerald-400 active:from-green-400 active:to-emerald-300 text-black font-black text-sm flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all"
                        >
                            <Play className="w-4 h-4 fill-black" />
                            Play All
                        </button>
                        <button type="button"
                            onClick={onTryAgain}
                            className="flex-1 h-12 rounded-xl bg-white/8 border border-white/15 text-white font-bold text-sm flex items-center justify-center gap-2 active:bg-white/15 active:scale-[0.98] transition-all"
                        >
                            <Sparkles className="w-4 h-4 text-purple-400" />
                            New Mood
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
