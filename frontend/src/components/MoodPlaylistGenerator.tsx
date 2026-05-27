import React, { useReducer, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import {
  generateMoodPlaylist,
  getMoodCreditStatus,
  saveMoodPlaylist,
  shareMoodPlaylist,
  MoodPlaylist,
  MoodCreditStatus
} from '@/services/moodPlaylistService';
import { recommendationItemFromPlaylist, trackRecommendationEvent } from '@/services/recommendationService';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import {
  Sparkles,
  AlertCircle,
  Smile,
  Frown,
  Snowflake,
  Zap,
  Heart,
  Headphones,
  History,
  Wand2,
  Radio
} from 'lucide-react';

interface MoodPlaylistGeneratorProps {
  className?: string;
}

const MoodPlaylistLoading = React.lazy(() => import('./MoodPlaylistLoading').then(m => ({ default: m.MoodPlaylistLoading })));
const MoodPlaylistDisplay = React.lazy(() => import('./MoodPlaylistDisplay').then(m => ({ default: m.MoodPlaylistDisplay })));
const MoodPlaylistDisplayMobile = React.lazy(() => import('./MoodPlaylistDisplayMobile').then(m => ({ default: m.MoodPlaylistDisplayMobile })));
const MoodPlaylistGeneratorMobile = React.lazy(() => import('./MoodPlaylistGeneratorMobile').then(m => ({ default: m.MoodPlaylistGeneratorMobile })));

type ViewState = 'input' | 'loading' | 'display';
const MIN_LOADING_DURATION_MS = 10000;
const QUICK_MOODS = [
  { label: 'Happy', text: 'I want a playlist that sounds happy, upbeat, and full of positive energy.', icon: Smile },
  { label: 'Sad', text: 'I need a sad, melancholic, and emotional playlist for deep reflection.', icon: Frown },
  { label: 'Calm', text: 'Looking for a very calm, peaceful, and relaxing playlist to unwind.', icon: Snowflake },
  { label: 'Energy', text: 'Create an extremely energetic and motivating playlist for an intense workout.', icon: Zap },
  { label: 'Romance', text: 'I want a romantic, slow, and intimate playlist perfect for a date night.', icon: Heart },
  { label: 'Focus', text: 'I need a quiet, focused, deep-work playlist with minimal distractions to concentrate.', icon: Headphones }
];

interface MoodGeneratorState {
  moodText: string;
  error: string | null;
  rateLimitMessage: string | null;
  viewState: ViewState;
  playlist: MoodPlaylist | null;
  isMobile: boolean;
  creditStatus: MoodCreditStatus | null;
  isCreditStatusLoading: boolean;
}

type MoodGeneratorAction =
  | Partial<MoodGeneratorState>
  | ((state: MoodGeneratorState) => MoodGeneratorState);

const moodGeneratorReducer = (
  state: MoodGeneratorState,
  action: MoodGeneratorAction
): MoodGeneratorState => {
  if (typeof action === 'function') {
    return action(state);
  }
  return { ...state, ...action };
};


interface MoodPlaylistGeneratorDesktopProps {
  moodText: string;
  charCount: number;
  isValid: boolean;
  isRateLimitReached: boolean;
  error: string | null;
  rateLimitMessage: string | null;
  creditLabel: string | null;
  MIN_LENGTH: number;
  MAX_LENGTH: number;
  onMoodChange: (text: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onQuickMood: (text: string) => void;
}

const MoodPlaylistGeneratorDesktop = ({
  moodText,
  charCount,
  isValid,
  isRateLimitReached,
  error,
  rateLimitMessage,
  creditLabel,
  MIN_LENGTH,
  MAX_LENGTH,
  onMoodChange,
  onSubmit,
  onQuickMood,
}: MoodPlaylistGeneratorDesktopProps) => {
  return (
    <div className="relative w-full max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <div className="fixed top-4 right-4 z-50">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('navigate-mood-history'))}
          className="inline-flex h-9 items-center gap-2 rounded-full border border-white/10 bg-black/45 px-3 text-xs font-semibold text-white/75 shadow-lg backdrop-blur-xl transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
          aria-label="View mood history"
        >
          <History className="h-4 w-4" />
          <span>History</span>
        </button>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-5 rounded-[28px] border border-white/10 bg-[#101014]/80 p-5 shadow-2xl backdrop-blur-2xl sm:p-6">
          <div className="flex items-start justify-between gap-5">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300 shadow-[0_0_32px_rgba(16,185,129,0.14)]">
                <Wand2 className="h-7 w-7" />
              </div>
              <div className="min-w-0">
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
                  <Radio className="h-3.5 w-3.5 text-emerald-300" />
                  Gemini grounded
                </div>
                <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  AI Mood Generator
                </h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-white/55">
                  Describe the exact vibe, language, artist taste, or moment. Gemini finds real songs and Mavrixfy resolves playable tracks.
                </p>
              </div>
            </div>
            {creditLabel && (
              <div className="hidden shrink-0 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-right sm:block">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">Credits</div>
                <div className="mt-0.5 text-xs font-semibold text-white/75">{creditLabel}</div>
              </div>
            )}
          </div>

          <div
            className={cn(
              "rounded-2xl border p-4 transition-colors",
              isRateLimitReached
                ? "border-white/10 bg-white/[0.03]"
                : "border-white/10 bg-black/30 focus-within:border-emerald-300/35 focus-within:bg-black/40"
            )}
          >
            <Textarea
              value={moodText}
              onChange={(e) => onMoodChange(e.target.value)}
              placeholder="Example: Trending Hindi and Punjabi songs for a confident late-night romantic party mood, no remixes."
              disabled={isRateLimitReached}
              className="min-h-[112px] resize-none border-0 bg-transparent p-0 text-base leading-7 text-white placeholder:text-white/35 focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              aria-label="Mood description"
            />
            {isRateLimitReached && (
              <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm font-semibold text-white/85">
                {rateLimitMessage}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className={cn(
                  'rounded-full px-2.5 py-1 text-xs font-semibold',
                  charCount === 0 && 'bg-white/[0.04] text-white/35',
                  charCount > 0 && charCount < MIN_LENGTH && 'bg-yellow-400/10 text-yellow-300',
                  charCount >= MIN_LENGTH && charCount <= MAX_LENGTH && 'bg-emerald-400/10 text-emerald-300',
                  charCount > MAX_LENGTH && 'bg-red-400/10 text-red-300'
                )}>
                  {charCount}/{MAX_LENGTH}
                </span>
                {creditLabel && (
                  <span className="min-w-0 truncate text-xs text-white/45 sm:hidden">
                    {creditLabel}
                  </span>
                )}
              </div>

              <Button
                type="submit"
                disabled={!isValid || isRateLimitReached}
                className="h-11 rounded-full bg-emerald-400 px-6 text-sm font-bold text-black shadow-lg shadow-emerald-500/15 transition-transform hover:bg-emerald-300 active:scale-95 disabled:opacity-45"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Generate
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#101014]/70 p-4 shadow-xl backdrop-blur-2xl">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Quick moods</p>
            <span className="text-xs text-white/35">Tap to fill the prompt</span>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
            {QUICK_MOODS.map(({ label, text, icon: Icon }) => (
              <button
                key={label}
                type="button"
                onClick={() => onQuickMood(text)}
                disabled={isRateLimitReached}
                className={cn(
                  "group flex h-20 flex-col items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] text-white/70 transition-colors hover:border-emerald-300/30 hover:bg-emerald-300/10 hover:text-white active:scale-[0.98]",
                  isRateLimitReached && "cursor-not-allowed opacity-45 hover:border-white/10 hover:bg-white/[0.04] hover:text-white/70 active:scale-100"
                )}
              >
                <div className="rounded-full bg-white/[0.06] p-2 text-white/55 transition-colors group-hover:text-emerald-300">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-xs font-semibold">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="rounded-2xl bg-red-500/10 border-red-500/20 backdrop-blur-sm">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">{error}</AlertDescription>
          </Alert>
        )}
        {rateLimitMessage && !isRateLimitReached && (
          <div className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/70">
            {rateLimitMessage}
          </div>
        )}
      </form>
    </div>
  );
};

export const MoodPlaylistGenerator: React.FC<MoodPlaylistGeneratorProps> = ({
  className,
}) => {
  const [state, dispatchMood] = useReducer(moodGeneratorReducer, {
    moodText: '',
    error: null as string | null,
    rateLimitMessage: null as string | null,
    viewState: 'input' as ViewState,
    playlist: null as MoodPlaylist | null,
    isMobile: typeof window !== 'undefined' ? window.innerWidth < 768 : false,
    creditStatus: null as MoodCreditStatus | null,
    isCreditStatusLoading: false,
  });
  const { moodText, error, rateLimitMessage, viewState, playlist, isMobile, creditStatus, isCreditStatusLoading } = state;

  const { playAlbum, setIsPlaying } = usePlayerStore();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const currentSong = usePlayerStore((state) => state.currentSong);
  const mobileBottomInsetPx = currentSong ? 108 : 64;

  // Detect mobile on resize
  useEffect(() => {
    const check = () => dispatchMood({ isMobile: window.innerWidth < 768 });
    window.addEventListener('resize', check, { passive: true });
    return () => window.removeEventListener('resize', check);
  }, []);

  const MIN_LENGTH = 3;
  const MAX_LENGTH = 200;
  const charCount = moodText.length;
  const isValid = charCount >= MIN_LENGTH && charCount <= MAX_LENGTH;
  const isRateLimitReached = Boolean(
    creditStatus && !creditStatus.unlimited && Math.max(0, creditStatus.remaining) <= 0
  );

  const formatResetTime = (resetAt: string | null) => {
    if (!resetAt) return null;
    const dt = new Date(resetAt);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const buildRateLimitReachedMessage = (resetAt: string | null) => {
    const resetTime = formatResetTime(resetAt);
    return resetTime
      ? `Limit reached. Try tomorrow at ${resetTime}.`
      : 'Limit reached. Try again tomorrow.';
  };

  const buildCreditLabel = () => {
    if (authLoading) return 'Checking account...';
    if (!isAuthenticated) return null;
    if (isCreditStatusLoading) return 'Checking credits...';
    if (!creditStatus) return null;
    if (creditStatus.unlimited) return 'Credits left today: Unlimited';

    const remaining = Math.max(0, creditStatus.remaining);
    if (remaining > 0) {
      return `Credits left today: ${remaining}/${creditStatus.dailyLimit}`;
    }

    return `Credits left today: 0/${creditStatus.dailyLimit}`;
  };

  const creditLabel = buildCreditLabel();

  useEffect(() => {
    let cancelled = false;

    const loadCreditStatus = async () => {
      if (authLoading) {
        return;
      }

      if (!isAuthenticated) {
        dispatchMood({ creditStatus: null });
        return;
      }

      try {
        dispatchMood({ isCreditStatusLoading: true });
        const status = await getMoodCreditStatus();
        if (!cancelled) {
          dispatchMood({ creditStatus: status });
        }
      } catch (_error) {
        if (!cancelled) {
          dispatchMood({ creditStatus: null });
        }
      } finally {
        if (!cancelled) {
          dispatchMood({ isCreditStatusLoading: false });
        }
      }
    };

    loadCreditStatus();

    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !creditStatus || creditStatus.unlimited) {
      dispatchMood({ rateLimitMessage: null });
      return;
    }

    const remaining = Math.max(0, creditStatus.remaining);
    if (remaining <= 0) {
      dispatchMood(prev => ({
        ...prev,
        rateLimitMessage: prev.rateLimitMessage || buildRateLimitReachedMessage(creditStatus.resetAt)
      }));
    } else {
      dispatchMood({ rateLimitMessage: null });
    }
  }, [isAuthenticated, creditStatus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    dispatchMood({ error: null, rateLimitMessage: null });

    if (authLoading) {
      dispatchMood({ error: 'Checking your account. Try again in a moment.' });
      return;
    }

    if (!isAuthenticated) {
      dispatchMood({ error: 'Please log in to generate mood playlists.' });
      return;
    }

    if (isRateLimitReached) {
      dispatchMood({ rateLimitMessage: buildRateLimitReachedMessage(creditStatus?.resetAt || null) });
      return;
    }

    if (!isValid) {
      if (charCount === 0) {
        dispatchMood({ error: 'Please enter your mood' });
      } else if (charCount < MIN_LENGTH) {
        dispatchMood({ error: `Mood description must be at least ${MIN_LENGTH} characters` });
      } else if (charCount > MAX_LENGTH) {
        dispatchMood({ error: `Mood description must be less than ${MAX_LENGTH} characters` });
      }
      return;
    }

    dispatchMood({ viewState: 'loading' });
    const loadingStartedAt = Date.now();

    const ensureMinimumLoadingDuration = async () => {
      const elapsed = Date.now() - loadingStartedAt;
      const remaining = MIN_LOADING_DURATION_MS - elapsed;
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }
    };

    try {
      const response = await generateMoodPlaylist(moodText);
      await ensureMinimumLoadingDuration();
      dispatchMood(prev => {
        const nextCreditStatus = response.rateLimitInfo ? {
          remaining: response.rateLimitInfo.remaining !== undefined ? response.rateLimitInfo.remaining : (prev.creditStatus?.remaining ?? 0),
          resetAt: response.rateLimitInfo.resetAt !== undefined ? response.rateLimitInfo.resetAt : (prev.creditStatus?.resetAt ?? null),
          dailyLimit: prev.creditStatus?.dailyLimit ?? 5,
          unlimited: response.rateLimitInfo.remaining === -1 || prev.creditStatus?.unlimited === true,
        } : prev.creditStatus;

        return {
          ...prev,
          playlist: response.playlist,
          viewState: 'display',
          creditStatus: nextCreditStatus,
        };
      });

      // Track analytics event
      logAnalyticsEvent('playlist_generated', {
        emotion: response.playlist.emotion,
        songCount: response.playlist.songCount,
        cached: response.playlist.cached,
      });
    } catch (err: any) {
      await ensureMinimumLoadingDuration();
      
      dispatchMood(prev => {
        let nextError = err.message || 'Failed to generate playlist. Please try again.';
        let nextRateLimitMessage = prev.rateLimitMessage;
        let nextCreditStatus = prev.creditStatus;

        if (err.isRateLimitError) {
          nextError = null;
          nextRateLimitMessage = buildRateLimitReachedMessage(err.resetAt || prev.creditStatus?.resetAt || null);
          nextCreditStatus = {
            remaining: 0,
            resetAt: err.resetAt || prev.creditStatus?.resetAt || null,
            dailyLimit: prev.creditStatus?.dailyLimit ?? 5,
            unlimited: false,
          };
        }

        return {
          ...prev,
          viewState: 'input',
          error: nextError,
          rateLimitMessage: nextRateLimitMessage,
          creditStatus: nextCreditStatus,
        };
      });

      if (err.isRateLimitError) {
        logAnalyticsEvent('rate_limit_hit', {
          resetAt: err.resetAt,
        });
      }
    }
  };

  const handleMoodTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= MAX_LENGTH) {
      dispatchMood(prev => ({
        ...prev,
        moodText: value,
        error: null,
        rateLimitMessage: !isRateLimitReached ? null : prev.rateLimitMessage,
      }));
    }
  };

  const handlePlay = (index: number = 0) => {
    if (!playlist || playlist.songs.length === 0) return;

    // Play the playlist using playAlbum method
    playAlbum(playlist.songs, index);
    setIsPlaying(true);

    toast.success('Playing your mood playlist');

    // Track analytics event
    logAnalyticsEvent('playlist_played', {
      playlistId: playlist._id,
      emotion: playlist.emotion,
      startIndex: index
    });
  };

  const handleSave = async () => {
    if (!playlist) return;

    try {
      await saveMoodPlaylist(playlist);
      toast.success('Playlist saved to your library!');

      // Track analytics event
      logAnalyticsEvent('playlist_saved', {
        playlistId: playlist._id,
        emotion: playlist.emotion,
      });
      const recommendationItem = recommendationItemFromPlaylist({
        _id: playlist._id,
        name: playlist.name,
        songs: playlist.songs,
        imageUrl: (playlist as any).imageUrl || '',
      });
      if (recommendationItem) {
        void trackRecommendationEvent({
          eventType: 'playlist_save',
          item: recommendationItem,
          context: { surface: 'mood_playlist' },
        });
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save playlist');
    }
  };

  const handleShare = async () => {
    if (!playlist) return;

    try {
      const { shareUrl } = await shareMoodPlaylist(playlist._id);

      // Copy to clipboard
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Share link copied to clipboard!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to share playlist');
    }
  };

  const handleTryAgain = () => {
    dispatchMood({
      viewState: 'input',
      playlist: null,
      moodText: '',
      error: null,
    });
  };

  const logAnalyticsEvent = (eventType: string, metadata: Record<string, any>) => {
    // Simple analytics logging - can be extended with actual analytics service
    console.log('[Analytics]', eventType, metadata);
  };

  // Show loading state
  if (viewState === 'loading') {
    if (isMobile) {
      return (
        <div className="h-full min-h-0 flex flex-col">
          <React.Suspense fallback={null}>
            <MoodPlaylistLoading className="h-full" />
          </React.Suspense>
        </div>
      );
    }
    return (
      <React.Suspense fallback={null}>
        <MoodPlaylistLoading className={className} />
      </React.Suspense>
    );
  }

  // Show playlist display
  if (viewState === 'display' && playlist) {
    // Mobile display
    if (isMobile) {
      return (
        <div className="h-full min-h-0 flex flex-col">
          {/* History button — fixed top-right */}
          <div className="fixed top-4 right-4 z-50">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('navigate-mood-history'))}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-white/10 bg-black/45 px-3 text-xs font-semibold text-white/75 shadow-lg backdrop-blur-xl transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
              aria-label="View mood history"
            >
              <History className="h-4 w-4" />
              <span>History</span>
            </button>
          </div>
          <React.Suspense fallback={null}>
            <MoodPlaylistDisplayMobile
              playlist={playlist}
              bottomInsetPx={mobileBottomInsetPx}
              onPlay={handlePlay}
              onSave={handleSave}
              onShare={handleShare}
              onTryAgain={handleTryAgain}
            />
          </React.Suspense>
        </div>
      );
    }
    // Desktop display
    return (
      <React.Suspense fallback={null}>
        <MoodPlaylistDisplay
          playlist={playlist}
          onPlay={handlePlay}
          onSave={handleSave}
          onShare={handleShare}
          onTryAgain={handleTryAgain}
        />
      </React.Suspense>
    );
  }

  // Show input form
  // Mobile input view
  if (isMobile) {
    return (
      <div className="h-full min-h-0 flex flex-col">
        {/* History button — fixed top-right */}
        <div className="fixed top-4 right-4 z-50">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('navigate-mood-history'))}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-white/10 bg-black/45 px-3 text-xs font-semibold text-white/75 shadow-lg backdrop-blur-xl transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
            aria-label="View mood history"
          >
            <History className="h-4 w-4" />
            <span>History</span>
          </button>
        </div>
        <React.Suspense fallback={null}>
          <MoodPlaylistGeneratorMobile
            moodText={moodText}
            charCount={charCount}
            isValid={isValid}
            isRateLimitReached={isRateLimitReached}
            error={error}
            rateLimitMessage={rateLimitMessage}
            creditLabel={creditLabel}
            MIN_LENGTH={MIN_LENGTH}
            MAX_LENGTH={MAX_LENGTH}
            bottomInsetPx={mobileBottomInsetPx}
            onMoodChange={(text) => {
              dispatchMood({
                moodText: text,
                error: null,
                rateLimitMessage: !isRateLimitReached ? null : rateLimitMessage,
              });
            }}
            onSubmit={handleSubmit}
            onQuickMood={(text) => {
              if (!isRateLimitReached) {
                dispatchMood({
                  moodText: text,
                  error: null,
                  rateLimitMessage: null,
                });
              }
            }}
          />
        </React.Suspense>
      </div>
    );
  }

  // Desktop input form
  // Desktop input form
  return (
    <MoodPlaylistGeneratorDesktop
      moodText={moodText}
      charCount={charCount}
      isValid={isValid}
      isRateLimitReached={isRateLimitReached}
      error={error}
      rateLimitMessage={rateLimitMessage || buildRateLimitReachedMessage(creditStatus?.resetAt || null)}
      creditLabel={creditLabel}
      MIN_LENGTH={MIN_LENGTH}
      MAX_LENGTH={MAX_LENGTH}
      onMoodChange={(text) => {
        if (text.length <= MAX_LENGTH) {
          dispatchMood({
            moodText: text,
            error: null,
            rateLimitMessage: !isRateLimitReached ? null : rateLimitMessage,
          });
        }
      }}
      onSubmit={handleSubmit}
      onQuickMood={(text) => {
        if (!isRateLimitReached) {
          dispatchMood({
            moodText: text,
            error: null,
            rateLimitMessage: null,
          });
        }
      }}
    />
  );
};
