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
  Headphones
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
    <div className="relative w-full max-w-3xl mx-auto px-4 sm:px-6">
      {/* History Button — fixed at top-right of viewport */}
      <div className="fixed top-4 right-4 z-50">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('navigate-mood-history'))}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/8 border border-white/15 text-white/70 text-xs font-semibold backdrop-blur-md hover:bg-purple-500/25 hover:text-white hover:border-purple-500/30 transition-all duration-200 shadow-lg"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>View History</span>
        </button>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-y-2">
        {/* Title Section */}
        <div className="flex flex-col items-center shrink-0 pt-9 sm:pt-10">
          <img
            src="https://res.cloudinary.com/djqq8kba8/image/upload/v1773035583/Mood-icon_asax7o.svg"
            alt="AI Mood"
            className="w-12 h-12 sm:w-14 sm:h-14 mb-1 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] animate-pulse shrink-0"
          />
          <h2 className="text-xl sm:text-2xl md:text-3xl font-semibold text-white tracking-tight leading-none mb-0.5 text-center drop-shadow-lg shrink-0">
            AI Mood Generator
          </h2>
          <p className="text-[10px] sm:text-xs text-white/50 font-medium tracking-wide uppercase text-center">
            Describe your vibe. We'll curate the music.
          </p>
        </div>

        {/* iOS-style Glassmorphism Input Container */}
        <div
          className={cn(
            "backdrop-blur-3xl rounded-2xl sm:rounded-3xl p-3 sm:p-3.5 shadow-2xl shrink-0 transition-all",
            isRateLimitReached
              ? "bg-white/5 border border-white/10"
              : "bg-white/10 border border-white/20 focus-within:bg-white/[0.15] focus-within:border-white/30"
          )}
        >
          <Textarea
            value={moodText}
            onChange={(e) => onMoodChange(e.target.value)}
            placeholder="How are you feeling right now?"
            disabled={isRateLimitReached}
            className="min-h-[60px] sm:min-h-[75px] max-h-[80px] sm:max-h-[95px] resize-none border-0 !ring-0 !ring-offset-0 focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:outline-none focus-visible:ring-offset-0 focus-visible:border-transparent text-sm sm:text-base p-0 bg-transparent text-white placeholder:text-white/40 leading-relaxed custom-scrollbar"
            aria-label="Mood description"
          />
          {isRateLimitReached && (
            <div className="mt-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-center">
              <p className="text-sm sm:text-base font-semibold text-white/85">
                {rateLimitMessage}
              </p>
            </div>
          )}

          <div className="flex items-center justify-between mt-2 sm:mt-2.5 pt-2 sm:pt-2.5 border-t border-white/10">
            <div className="flex min-w-0 items-center gap-2 pr-2">
              <span className={cn(
                'shrink-0 text-xs sm:text-sm font-medium',
                charCount === 0 && 'text-white/40',
                charCount > 0 && charCount < MIN_LENGTH && 'text-yellow-400',
                charCount >= MIN_LENGTH && charCount <= MAX_LENGTH && 'text-green-400',
                charCount > MAX_LENGTH && 'text-red-400'
              )}>
                {charCount}/{MAX_LENGTH}
              </span>
              {creditLabel && (
                <span className="min-w-0 truncate text-[10px] sm:text-xs text-white/55">
                  {creditLabel}
                </span>
              )}
            </div>

            <Button
              type="submit"
              disabled={!isValid || isRateLimitReached}
              className="rounded-full px-6 sm:px-8 h-10 sm:h-11 text-sm sm:text-base font-semibold bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 shadow-lg transition-transform active:scale-95"
            >
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              Generate
            </Button>
          </div>
        </div>

        {/* Quick Emotion Buttons (Separate Container) */}
        <div className="bg-white/10 backdrop-blur-3xl rounded-2xl sm:rounded-3xl border border-white/20 p-2.5 sm:p-3 shadow-2xl shrink-0">
          <div className="flex items-center justify-center gap-2 mb-1.5">
            <div className="h-px bg-white/10 flex-1 rounded-full shrink-0"></div>
            <p className="text-[10px] sm:text-xs font-semibold text-white/40 uppercase tracking-widest shrink-0">Quick Moods</p>
            <div className="h-px bg-white/10 flex-1 rounded-full shrink-0"></div>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-1.5 shrink-0">
            {[
              { label: 'Happy', text: 'I want a playlist that sounds happy, upbeat, and full of positive energy.', icon: Smile },
              { label: 'Sad', text: 'I need a sad, melancholic, and emotional playlist for deep reflection.', icon: Frown },
              { label: 'Calm', text: 'Looking for a very calm, peaceful, and relaxing playlist to unwind.', icon: Snowflake },
              { label: 'Energetic', text: 'Create an extremely energetic and motivating playlist for an intense workout.', icon: Zap },
              { label: 'Romantic', text: 'I want a romantic, slow, and intimate playlist perfect for a date night.', icon: Heart },
              { label: 'Focus', text: 'I need a quiet, focused, deep-work playlist with minimal distractions to concentrate.', icon: Headphones }
            ].map(({ label, text, icon: Icon }) => (
              <button
                key={label}
                type="button"
                onClick={() => onQuickMood(text)}
                disabled={isRateLimitReached}
                className={cn(
                  "group flex flex-col items-center justify-center gap-1 sm:gap-1.5 py-2 sm:py-2.5 px-1 rounded-xl sm:rounded-2xl border transition-all duration-300",
                  "hover:scale-[1.02] active:scale-95",
                  "bg-white/5 border-white/5",
                  "hover:bg-white/10 hover:border-white/10 shadow-sm",
                  isRateLimitReached && "opacity-45 cursor-not-allowed hover:scale-100 active:scale-100 hover:bg-white/5 hover:border-white/5"
                )}
              >
                <div className="p-1.5 sm:p-2 rounded-full bg-white/5 text-white/60 group-hover:text-white transition-colors">
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6 transition-transform duration-300 group-hover:scale-110" />
                </div>
                <span className="text-[10px] sm:text-xs font-medium text-white/60 group-hover:text-white transition-colors line-clamp-1">{label}</span>
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/8 border border-white/15 text-white/70 text-xs font-semibold backdrop-blur-md hover:bg-purple-500/25 hover:text-white transition-all shadow-lg"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/8 border border-white/15 text-white/70 text-xs font-semibold backdrop-blur-md hover:bg-purple-500/25 hover:text-white transition-all shadow-lg"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
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
