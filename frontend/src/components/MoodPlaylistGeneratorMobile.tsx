import React, { useEffect, useRef, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { Sparkles, AlertCircle, Smile, Frown, Snowflake, Zap, Heart, Headphones, Wand2, Radio } from 'lucide-react';

interface MoodPlaylistGeneratorMobileProps {
    moodText: string;
    charCount: number;
    isValid: boolean;
    isRateLimitReached?: boolean;
    error: string | null;
    rateLimitMessage?: string | null;
    creditLabel?: string | null;
    MIN_LENGTH: number;
    MAX_LENGTH: number;
    bottomInsetPx: number;
    onMoodChange: (text: string) => void;
    onSubmit: (e: React.FormEvent) => void;
    onQuickMood: (text: string) => void;
}

const QUICK_MOODS = [
    { label: 'Happy', icon: Smile, text: 'I want a playlist that sounds happy, upbeat, and full of positive energy.' },
    { label: 'Sad', icon: Frown, text: 'I need a sad, melancholic, and emotional playlist for deep reflection.' },
    { label: 'Calm', icon: Snowflake, text: 'Looking for a very calm, peaceful, and relaxing playlist to unwind.' },
    { label: 'Energy', icon: Zap, text: 'Create an extremely energetic and motivating playlist for an intense workout.' },
    { label: 'Romance', icon: Heart, text: 'I want a romantic, slow, and intimate playlist perfect for a date night.' },
    { label: 'Focus', icon: Headphones, text: 'I need a quiet, focused, deep-work playlist with minimal distractions.' },
];

export const MoodPlaylistGeneratorMobile: React.FC<MoodPlaylistGeneratorMobileProps> = ({
    moodText,
    charCount,
    isValid,
    isRateLimitReached = false,
    error,
    rateLimitMessage,
    creditLabel,
    MIN_LENGTH,
    MAX_LENGTH,
    bottomInsetPx,
    onMoodChange,
    onSubmit,
    onQuickMood,
}) => {
    const panelRef = useRef<HTMLDivElement>(null);
    const [panelHeight, setPanelHeight] = useState(250);
    const EXTRA_BOTTOM_GAP_PX = 14;

    useEffect(() => {
        const node = panelRef.current;
        if (!node) return;

        const updateHeight = () => {
            const next = Math.ceil(node.offsetHeight);
            setPanelHeight((prev) => (prev === next ? prev : next));
        };

        updateHeight();
        const onViewportChange = () => updateHeight();

        if (typeof ResizeObserver !== 'undefined') {
            const observer = new ResizeObserver(updateHeight);
            observer.observe(node);
            window.addEventListener('resize', onViewportChange, { passive: true });
            window.addEventListener('orientationchange', onViewportChange, { passive: true });

            return () => {
                observer.disconnect();
                window.removeEventListener('resize', onViewportChange);
                window.removeEventListener('orientationchange', onViewportChange);
            };
        }

        // Fallback for older browsers/WebViews without ResizeObserver.
        window.addEventListener('resize', onViewportChange, { passive: true });
        window.addEventListener('orientationchange', onViewportChange, { passive: true });

        return () => {
            window.removeEventListener('resize', onViewportChange);
            window.removeEventListener('orientationchange', onViewportChange);
        };
    }, []);

    return (
        /*
         * iPhone one-handed layout:
         * - Title stays in the upper zone
         * - Quick moods + input + generate are moved to bottom for thumb access
         */
        <div className="relative flex h-full min-h-0 flex-col">

            {/* ── Scrollable top zone: title only ── */}
            <div
                className="flex-1 min-h-0 overflow-y-auto scrollbar-hide flex flex-col items-center justify-center px-4 pt-14"
                style={{ paddingBottom: `calc(${bottomInsetPx + panelHeight + 20 + EXTRA_BOTTOM_GAP_PX}px + env(safe-area-inset-bottom, 0px))` }}
            >

                <div className="mx-auto flex max-w-sm flex-col items-center text-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300 shadow-[0_0_32px_rgba(16,185,129,0.16)]">
                        <Wand2 className="h-8 w-8" />
                    </div>
                    <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">
                        <Radio className="h-3.5 w-3.5 text-emerald-300" />
                        Gemini grounded
                    </div>
                    <h2 className="text-2xl font-semibold text-white tracking-tight leading-tight mb-2">
                        AI Mood Generator
                    </h2>
                    <p className="text-sm leading-6 text-white/50">
                        Describe a mood, moment, language, or artist taste. Gemini finds real songs for your playlist.
                    </p>
                </div>
            </div>

            {/* ── Fixed bottom zone: Quick moods + input + generate ── */}
            <div
                className="fixed left-0 right-0 z-30 px-4 pt-2"
                style={{ bottom: `calc(${bottomInsetPx + EXTRA_BOTTOM_GAP_PX}px + env(safe-area-inset-bottom, 0px) + 20px)` }}
            >
                <div ref={panelRef} className="mx-auto w-full max-w-md">
                    <div className="mb-3">
                        <p className="text-[10px] font-semibold text-white/50 uppercase tracking-widest mb-2.5 text-center">
                            Quick Moods
                        </p>
                        <div className="flex gap-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-1">
                            {QUICK_MOODS.map(({ label, icon: Icon, text }) => (
                                <button
                                    key={label}
                                    type="button"
                                    onClick={() => onQuickMood(text)}
                                    disabled={isRateLimitReached}
                                    className={cn(
                                        "flex-shrink-0 snap-start flex items-center gap-2 rounded-full border border-white/10 bg-black/45 px-4 py-2.5 text-sm font-semibold text-white/80 shadow-lg backdrop-blur-xl active:scale-95 transition-all duration-150",
                                        "hover:border-emerald-300/30 hover:bg-emerald-300/10 hover:text-white",
                                        isRateLimitReached && "opacity-45 cursor-not-allowed hover:border-white/10 hover:bg-black/45 hover:text-white/80 active:scale-100"
                                    )}
                                >
                                    <Icon className="h-4 w-4 text-emerald-300" />
                                    <span>{label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <Alert variant="destructive" className="rounded-2xl bg-red-500/10 border-red-500/20 mb-3">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="text-sm">{error}</AlertDescription>
                        </Alert>
                    )}
                    {(rateLimitMessage || isRateLimitReached) && (
                        <div className="rounded-2xl border border-white/15 bg-white/5 px-3 py-2.5 mb-3 text-sm font-semibold text-white/85 text-center">
                            {rateLimitMessage || 'Limit reached. Try again tomorrow.'}
                        </div>
                    )}

                    <form onSubmit={onSubmit}>
                        <div
                            className={cn(
                                "backdrop-blur-2xl rounded-3xl border shadow-2xl overflow-hidden transition-all",
                                isRateLimitReached
                                    ? "bg-black/20 border-white/10"
                                    : "bg-[#101014]/90 border-white/10 focus-within:border-emerald-300/35 focus-within:bg-black/50"
                            )}
                        >
                            <Textarea
                                value={moodText}
                                onChange={(e) => {
                                    if (e.target.value.length <= MAX_LENGTH) onMoodChange(e.target.value);
                                }}
                                placeholder="Trending Hindi Punjabi songs for confident late-night romantic mood..."
                                disabled={isRateLimitReached}
                                className="min-h-[76px] max-h-[128px] resize-none border-0 !ring-0 !ring-offset-0 focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:outline-none text-[15px] px-4 pt-4 pb-1 bg-transparent text-white placeholder:text-white/35 leading-relaxed"
                                aria-label="Mood description"
                            />

                            <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/10">
                                <div className="flex min-w-0 items-center gap-2 pr-2">
                                    <span className={cn(
                                        'shrink-0 text-xs font-semibold',
                                        charCount === 0 && 'text-white/30',
                                        charCount > 0 && charCount < MIN_LENGTH && 'text-yellow-400',
                                        charCount >= MIN_LENGTH && charCount <= MAX_LENGTH && 'text-green-400',
                                        charCount > MAX_LENGTH && 'text-red-400'
                                    )}>
                                        {charCount}/{MAX_LENGTH}
                                    </span>
                                    {creditLabel && (
                                        <span className="min-w-0 truncate text-[10px] text-white/50 leading-tight">
                                            {creditLabel}
                                        </span>
                                    )}
                                </div>
                                <button
                                    type="submit"
                                    disabled={!isValid || isRateLimitReached}
                                    className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-emerald-400 hover:bg-emerald-300 disabled:opacity-40 text-black text-sm font-bold shadow-lg active:scale-95 transition-all"
                                >
                                    <Sparkles className="w-4 h-4" />
                                    Generate
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};
