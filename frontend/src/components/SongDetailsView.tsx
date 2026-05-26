import React, { type ReactNode, type SVGProps, useEffect, useState, useRef, useCallback } from 'react';
import { m, AnimatePresence, LazyMotion, domAnimation } from 'framer-motion';

import { usePlayerStore } from '@/stores/usePlayerStore';
import { usePlayerSync } from '@/hooks/usePlayerSync';
import { useAlbumColors } from '@/hooks/useAlbumColors';
import { ShareSong } from './ShareSong';
import { ShuffleButton } from './ShuffleButton';
import { LikeButton } from './LikeButton';
import { PingPongScroll } from './PingPongScroll';
import { cn } from '@/lib/utils';
import { useLikedSongsStore } from '@/stores/useLikedSongsStore';
import './SongDetailsView.css';

interface SongDetailsViewProps {
  isOpen: boolean;
  onClose: () => void;
}

const formatTime = (seconds: number) => {
  if (isNaN(seconds)) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

type MaterialIconProps = SVGProps<SVGSVGElement>;

const createMaterialIcon = (path: ReactNode) => {
  const MaterialIcon = ({ className, ...props }: MaterialIconProps) => (
    <svg
      className={className}
      focusable="false"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="currentColor"
      {...props}
    >
      {path}
    </svg>
  );

  return MaterialIcon;
};

const KeyboardArrowDownIcon = createMaterialIcon(<path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41Z" />);
const MoreHorizIcon = createMaterialIcon(<path d="M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2Zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2Zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2Z" />);
const PauseIcon = createMaterialIcon(<path d="M6 19h4V5H6v14Zm8-14v14h4V5h-4Z" />);
const PlayArrowIcon = createMaterialIcon(<path d="M8 5v14l11-7L8 5Z" />);
const QueueMusicIcon = createMaterialIcon(<path d="M15 6H3v2h12V6Zm0 4H3v2h12v-2ZM3 16h8v-2H3v2Zm14-10v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5Z" />);
const RepeatIcon = createMaterialIcon(<path d="M7 7h11v3l4-4-4-4v3H5v6h2V7Zm10 10H6v-3l-4 4 4 4v-3h13v-6h-2v4Z" />);
const IosShareIcon = createMaterialIcon(<path d="M16 5 12 1 8 5l1.41 1.41L11 4.83V16h2V4.83l1.59 1.59L16 5Zm4 5v11H4V10h2v9h12v-9h2Z" />);
const SkipNextIcon = createMaterialIcon(<path d="m6 18 8.5-6L6 6v12ZM16 6v12h2V6h-2Z" />);
const SkipPreviousIcon = createMaterialIcon(<path d="M6 6h2v12H6V6Zm3.5 6 8.5 6V6l-8.5 6Z" />);


interface CompactQueueViewProps {
  currentSong: any;
  currentTime: number;
  duration: number;
  displayProgress: number;
  queue: any[];
  currentIndex: number;
  screenSize: any;
  responsiveClasses: any;
  swipeContainerRef: React.RefObject<HTMLDivElement>;
  progressRef: React.RefObject<HTMLDivElement>;
  handleTouchStart: (e: React.TouchEvent) => void;
  handleTouchMove: (e: React.TouchEvent) => void;
  handleTouchEnd: (e: React.TouchEvent) => void;
  handleMouseDown: (e: React.MouseEvent) => void;
  handleLikeToggle: () => void;
  handleProgressClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleProgressMouseDown: (e: React.MouseEvent) => void;
  handleProgressTouchStart: (e: React.TouchEvent) => void;
  togglePlay: () => void;
  playPrevious: () => void;
  playNext: () => void;
  toggleRepeat: () => void;
  playAlbum: (album: any[], index: number) => void;
  playerState: CompactQueueViewState;
}


type CompactQueueViewState = {
  isLiked: boolean;
  isPlaying: boolean;
  isRepeating: boolean;
  isDragging: boolean;
};

const CompactQueueView = ({  playerState: { isLiked, isPlaying, isRepeating, isDragging },

  currentSong,
  currentTime,
  duration,
  displayProgress,
  queue,
  currentIndex,
  screenSize,
  responsiveClasses,
  swipeContainerRef,
  progressRef,
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd,
  handleMouseDown,
  handleLikeToggle,
  handleProgressClick,
  handleProgressMouseDown,
  handleProgressTouchStart,
  togglePlay,
  playPrevious,
  playNext,
  toggleRepeat,
  playAlbum,
}: CompactQueueViewProps) => {
  const queueWithKeys = React.useMemo(() => {
    return queue.map((song, index) => ({
      song,
      stableKey: song ? `${song._id || song.title}-${index + 1}` : `queue-item-${index + 1}`
    }));
  }, [queue]);

  return (
    <>
      {/* Compact Top Section - Album Art, Info, Progress, Controls */}
      <div className="flex-shrink-0 py-4">
        {/* Album Art - Smaller size */}
        <div className="flex justify-center mb-4">
          <button
            type="button"
            ref={swipeContainerRef}
            className="relative swipe-container border-0 bg-transparent p-0"
            style={{
              filter: `drop-shadow(0 15px 30px rgba(0,0,0,0.5))`,
              touchAction: 'pan-y',
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
          >
            <img
              src={currentSong.imageUrl}
              alt={currentSong.title}
              className="rounded-lg responsive-transition album-art-responsive"
              style={{
                width: screenSize.height <= 568 ? '120px' : screenSize.height <= 667 ? '140px' : '160px',
                height: screenSize.height <= 568 ? '120px' : screenSize.height <= 667 ? '140px' : '160px',
                backgroundColor: 'transparent',
                boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
                userSelect: 'none',
                pointerEvents: 'none',
              }}
              draggable={false}
            />
          </button>
        </div>

        {/* Song Info - Compact */}
        <div className="mb-3">
          <div className="flex items-center justify-between gap-3 max-w-sm mx-auto">
            <div className="flex-1 min-w-0 overflow-hidden mr-3">
              <div>
                <PingPongScroll
                  text={currentSong.title}
                  className="font-bold text-white text-base leading-tight tracking-tight py-1"
                  velocity={10}
                />
              </div>
              <div>
                <PingPongScroll
                  text={currentSong.artist}
                  className="text-white/80 font-medium text-sm"
                  velocity={8}
                />
              </div>
            </div>
            <LikeButton
              isLiked={isLiked}
              onToggle={handleLikeToggle}
              className="p-1.5 active:scale-90 transition-transform flex-shrink-0 touch-target"
              iconSize={20}
            />
          </div>
        </div>

        {/* Progress Bar - Compact */}
        <div className="mb-3">
          <div className="max-w-sm mx-auto">
            <button
              type="button"
              aria-label="Seek playback"
              ref={progressRef}
              className="relative w-full py-2 cursor-pointer group touch-target progress-bar-container"
              onClick={handleProgressClick}
              onMouseDown={handleProgressMouseDown}
              onTouchStart={handleProgressTouchStart}
              style={{ touchAction: 'none' }}
            >
              <div className={cn(
                "relative w-full rounded-full transition-all duration-150",
                isDragging ? "h-1.5" : "h-1 group-hover:h-1.5"
              )}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  backdropFilter: 'blur(10px)',
                }}
              >
                <div
                  className="absolute h-full rounded-full transition-all duration-75 bg-white"
                  style={{
                    width: `${displayProgress}%`,
                  }}
                />
                <div
                  className={cn(
                    "absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full shadow-lg transition-all duration-150 bg-white",
                    isDragging ? "opacity-100 scale-125" : "opacity-0 group-hover:opacity-100 group-hover:scale-110"
                  )}
                  style={{
                    left: `${displayProgress}%`,
                    marginLeft: '-6px',
                    transform: isDragging ? 'translateY(-50%) scale(1.25)' : undefined,
                  }}
                />
              </div>
            </button>
            <div className="flex justify-between mt-1 text-xs text-white/80">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>

        {/* Controls - Compact */}
        <div className="mb-2">
          <div className="max-w-xs mx-auto flex items-center justify-between">
            <ShuffleButton
              size="sm"
              className="p-1.5 active:scale-95 transition-all flex-shrink-0 touch-target control-button rounded-full"
            />

            <button type="button"
              onClick={playPrevious}
              className="p-1.5 text-white active:scale-95 transition-all flex-shrink-0 touch-target control-button rounded-full"
            >
              <SkipPreviousIcon className="h-5 w-5" />
            </button>

            <button type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();

                const store = usePlayerStore.getState();
                store.setUserInteracted();
                togglePlay();
              }}
              className="rounded-full flex items-center justify-center active:scale-95 transition-all shadow-lg flex-shrink-0 touch-target bg-white hover:bg-gray-100 w-10 h-10"
            >
              {isPlaying ? (
                <PauseIcon className="h-5 w-5 text-black" />
              ) : (
                <PlayArrowIcon className="h-5 w-5 text-black ml-0.5" />
              )}
            </button>

            <button type="button"
              onClick={playNext}
              className="p-1.5 text-white active:scale-90 transition-all flex-shrink-0 touch-target control-button rounded-full hover:bg-white/10"
            >
              <SkipNextIcon className="h-5 w-5" />
            </button>

            <button type="button"
              onClick={toggleRepeat}
              className={cn(
                "p-1.5 active:scale-90 transition-all flex-shrink-0 touch-target control-button rounded-full hover:bg-white/10",
                isRepeating ? "text-white bg-white/20" : "text-white/70"
              )}
            >
              <RepeatIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Queue/Songs List - Large Section */}
      <div className="flex-1 min-h-0 pb-4">
        <div className="h-full bg-black/20 backdrop-blur-sm rounded-lg overflow-hidden">
          <div className="p-3 border-b border-white/10">
            <h3 className="text-white font-semibold text-sm">Queue ({queue.length} songs)</h3>
          </div>
          <div className="h-full overflow-y-auto queue-list">
            <div className="p-3 space-y-1">
              {queueWithKeys.map(({ song, stableKey }, index) => {
                const isCurrentSong = index === currentIndex;

                return (
                  <button
                    type="button"
                    key={stableKey}
                    className={cn(
                      "flex w-full items-center gap-3 p-3 rounded-lg transition-all cursor-pointer queue-item text-left",
                      isCurrentSong
                        ? "bg-white/20 border border-white/30"
                        : "hover:bg-white/10 active:bg-white/15"
                    )}
                    onClick={() => {
                      if (!isCurrentSong) {
                        playAlbum(queue, index);
                      }
                    }}
                  >
                    <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 relative">
                      <img
                        src={song.imageUrl}
                        alt={song.title}
                        className="w-full h-full object-cover"
                      />
                      {isCurrentSong && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <div className="flex gap-0.5 items-end h-4">
                            <div className="w-0.5 bg-white music-bar"></div>
                            <div className="w-0.5 bg-white music-bar"></div>
                            <div className="w-0.5 bg-white music-bar"></div>
                            <div className="w-0.5 bg-white music-bar"></div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className={cn(
                        "font-medium truncate leading-tight",
                        isCurrentSong ? "text-white" : "text-white/90"
                      )}>
                        {song.title}
                      </h4>
                      <p className={cn(
                        "text-sm truncate mt-1",
                        isCurrentSong ? "text-white/80" : "text-white/60"
                      )}>
                        {song.artist}
                      </p>
                    </div>
                    <div className={cn(
                      "text-sm font-mono flex-shrink-0",
                      isCurrentSong ? "text-white/80" : "text-white/50"
                    )}>
                      {formatTime(song.duration || 0)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

interface NormalPlayerViewProps {
  currentSong: any;
  currentTime: number;
  duration: number;
  displayProgress: number;
  screenSize: any;
  responsiveClasses: any;
  swipeContainerRef: React.RefObject<HTMLDivElement>;
  progressRef: React.RefObject<HTMLDivElement>;
  handleTouchStart: (e: React.TouchEvent) => void;
  handleTouchMove: (e: React.TouchEvent) => void;
  handleTouchEnd: (e: React.TouchEvent) => void;
  handleMouseDown: (e: React.MouseEvent) => void;
  handleLikeToggle: () => void;
  handleProgressClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  handleProgressMouseDown: (e: React.MouseEvent) => void;
  handleProgressTouchStart: (e: React.TouchEvent) => void;
  togglePlay: () => void;
  playPrevious: () => void;
  playNext: () => void;
  toggleRepeat: () => void;
  playerState: NormalPlayerViewState;
}


type NormalPlayerViewState = {
  isLiked: boolean;
  isPlaying: boolean;
  isRepeating: boolean;
  isDragging: boolean;
};

const NormalPlayerView = ({  playerState: { isLiked, isPlaying, isRepeating, isDragging },

  currentSong,
  currentTime,
  duration,
  displayProgress,
  screenSize,
  responsiveClasses,
  swipeContainerRef,
  progressRef,
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd,
  handleMouseDown,
  handleLikeToggle,
  handleProgressClick,
  handleProgressMouseDown,
  handleProgressTouchStart,
  togglePlay,
  playPrevious,
  playNext,
  toggleRepeat,
}: NormalPlayerViewProps) => {
  return (
    <div className="flex flex-col justify-center min-h-0">
      {/* Album Art - Normal size with responsive sizing */}
      <div className="flex-shrink-0 flex justify-center mb-6">
        <button
          type="button"
          ref={swipeContainerRef}
          className="relative swipe-container border-0 bg-transparent p-0"
          style={{
            filter: `drop-shadow(0 25px 50px rgba(0,0,0,0.6))`,
            touchAction: 'pan-y',
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
        >
          <img
            src={currentSong.imageUrl}
            alt={currentSong.title}
            className="rounded-lg responsive-transition album-art-responsive"
            style={{
              width: screenSize.height <= 568 ? '200px' : screenSize.height <= 667 ? '260px' : screenSize.height <= 736 ? '300px' : '320px',
              height: screenSize.height <= 568 ? '200px' : screenSize.height <= 667 ? '260px' : screenSize.height <= 736 ? '300px' : '320px',
              backgroundColor: 'transparent',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              userSelect: 'none',
              pointerEvents: 'none',
            }}
            draggable={false}
          />
        </button>
      </div>

      {/* Song Info - Normal */}
      <div className="flex-shrink-0 mb-6">
        <div className="flex items-center justify-between gap-3 max-w-sm mx-auto">
          <div className="flex-1 min-w-0 overflow-hidden mr-3">
            <div>
              <PingPongScroll
                text={currentSong.title}
                className={cn(
                  "font-black text-white mb-0.5 leading-tight tracking-tight py-1 responsive-transition",
                  responsiveClasses.title
                )}
                velocity={10}
              />
            </div>
            <div>
              <PingPongScroll
                text={currentSong.artist}
                className={cn(
                  "text-white font-medium responsive-transition",
                  responsiveClasses.artist
                )}
                velocity={8}
              />
            </div>
          </div>
          <LikeButton
            isLiked={isLiked}
            onToggle={handleLikeToggle}
            className="p-2 -mr-2 active:scale-90 transition-transform flex-shrink-0 touch-target"
            iconSize={screenSize.height <= 568 ? 24 : 28}
          />
        </div>
      </div>

      {/* Progress Bar - Normal */}
      <div className="flex-shrink-0 mb-6">
        <div className="max-w-sm mx-auto">
          <button
            type="button"
            aria-label="Seek playback"
            ref={progressRef}
            className="relative w-full py-3 cursor-pointer group touch-target progress-bar-container"
            onClick={handleProgressClick}
            onMouseDown={handleProgressMouseDown}
            onTouchStart={handleProgressTouchStart}
            style={{ touchAction: 'none' }}
          >
            <div className={cn(
              "relative w-full rounded-full transition-all duration-150",
              isDragging ? "h-1.5" : "h-1 group-hover:h-1.5"
            )}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <div
                className="absolute h-full rounded-full transition-all duration-75 bg-white"
                style={{
                  width: `${displayProgress}%`,
                }}
              />
              <div
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full shadow-lg transition-all duration-150 bg-white",
                  isDragging ? "opacity-100 scale-125" : "opacity-0 group-hover:opacity-100 group-hover:scale-110"
                )}
                style={{
                  left: `${displayProgress}%`,
                  marginLeft: '-6px',
                  transform: isDragging ? 'translateY(-50%) scale(1.25)' : undefined,
                }}
              />
            </div>
          </button>
          <div className="flex justify-between mt-1 text-xs text-white">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      {/* Controls - Normal */}
      <div className="flex-shrink-0 mb-6">
        <div className={cn("max-w-sm mx-auto flex items-center justify-between", responsiveClasses.controls)}>
          <ShuffleButton
            size="md"
            className="p-2 active:scale-95 transition-all flex-shrink-0 touch-target control-button rounded-full"
          />

          <button type="button"
            onClick={playPrevious}
            className="p-2 text-white active:scale-95 transition-all flex-shrink-0 touch-target control-button rounded-full"
          >
            <SkipPreviousIcon className="h-6 w-6" />
          </button>

          <button type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();

              const store = usePlayerStore.getState();
              store.setUserInteracted();
              togglePlay();
            }}
            className={cn(
              "rounded-full flex items-center justify-center active:scale-95 transition-all shadow-lg flex-shrink-0 touch-target bg-white hover:bg-gray-100",
              responsiveClasses.playButton || "w-12 h-12"
            )}
          >
            {isPlaying ? (
              <PauseIcon className="h-6 w-6 text-black" />
            ) : (
              <PlayArrowIcon className="h-6 w-6 text-black ml-0.5" />
            )}
          </button>

          <button type="button"
            onClick={playNext}
            className="p-2 text-white active:scale-90 transition-all flex-shrink-0 touch-target control-button rounded-full hover:bg-white/10"
          >
            <SkipNextIcon className="h-6 w-6" />
          </button>

          <button type="button"
            onClick={toggleRepeat}
            className={cn(
              "p-2 active:scale-90 transition-all flex-shrink-0 touch-target control-button rounded-full hover:bg-white/10",
              isRepeating ? "text-white bg-white/20" : "text-white/70"
            )}
          >
            <RepeatIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

// eslint-disable-next-line react-doctor/no-giant-component
const SongDetailsView = ({ isOpen, onClose }: SongDetailsViewProps) => {

  const {
    togglePlay,
    playNext,
    playPrevious,
    currentTime,
    duration,
    seekTo,
    isRepeating,
    toggleRepeat,
    queue,
    currentIndex,
    playAlbum
  } = usePlayerStore();

  const queueWithKeys = React.useMemo(() => {
    return queue.map((song, index) => ({
      song,
      stableKey: song ? `${song._id || song.title}-${index + 1}` : `queue-item-${index + 1}`
    }));
  }, [queue]);

  const { currentSong, isPlaying } = usePlayerSync();

  const { likedSongIds, toggleLikeSong } = useLikedSongsStore();
  const [state, setState] = useState({
    isLiked: false,
    showQueue: false,
    showMenu: false,
    isDragging: false,
    dragProgress: 0,
    screenSize: {
      height: window.innerHeight,
      width: window.innerWidth,
      isLandscape: window.innerWidth > window.innerHeight
    },
    swipeState: {
      isDragging: false,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      deltaX: 0,
      deltaY: 0,
      velocity: 0,
      lastMoveTime: 0,
      direction: null as 'left' | 'right' | null,
      isVerticalScroll: false,
      hasMovedHorizontally: false,
      initialDirection: null as 'horizontal' | 'vertical' | null
    }
  });

  const { isLiked, showQueue, showMenu, isDragging, dragProgress, screenSize, swipeState } = state;

  const progressRef = useRef<HTMLDivElement>(null);
  const dragTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSeekTimeRef = useRef<number>(0);
  const albumColors = useAlbumColors(currentSong?.imageUrl);
  const swipeContainerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Handle screen size changes for responsive design
  // eslint-disable-next-line react-doctor/exhaustive-deps
  useEffect(() => {
    const handleResize = () => {
      setState(prev => ({
        ...prev,
        screenSize: {
          height: window.innerHeight,
          width: window.innerWidth,
          isLandscape: window.innerWidth > window.innerHeight
        }
      }));
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', () => {
      // Delay to get accurate dimensions after orientation change
      setTimeout(handleResize, 100);
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Determine responsive classes based on screen size
  const getResponsiveClasses = () => {
    const { height, isLandscape } = screenSize;

    if (isLandscape && height <= 500) {
      return {
        container: 'landscape-compact',
        albumArt: 'album-art-landscape',
        spacing: 'spacing-landscape',
        header: 'header-landscape',
        bottom: 'bottom-landscape',
        title: 'text-sm',
        artist: 'text-xs',
        controls: 'controls-xs',
        playButton: 'play-button-xs'
      };
    } else if (height <= 568) {
      return {
        container: '',
        albumArt: 'album-art-xs',
        spacing: 'spacing-xs',
        header: '',
        bottom: '',
        title: 'song-title-xs',
        artist: 'artist-text-xs',
        controls: 'controls-xs',
        playButton: 'play-button-xs'
      };
    } else if (height <= 600) {
      return {
        container: '',
        albumArt: 'album-art-small',
        spacing: '',
        header: '',
        bottom: '',
        title: 'song-title-small',
        artist: 'text-sm',
        controls: 'controls-small',
        playButton: 'play-button-small'
      };
    } else if (height <= 700) {
      return {
        container: '',
        albumArt: 'album-art-medium',
        spacing: '',
        header: '',
        bottom: '',
        title: 'text-lg',
        artist: 'text-sm',
        controls: '',
        playButton: ''
      };
    } else {
      return {
        container: '',
        albumArt: '',
        spacing: '',
        header: '',
        bottom: '',
        title: 'text-xl',
        artist: 'text-base',
        controls: '',
        playButton: ''
      };
    }
  };

  const responsiveClasses = getResponsiveClasses();

  // Update like status
  useEffect(() => {
    if (!currentSong) return;
    const id = (currentSong as any).id;
    const _id = currentSong._id;
    const liked = (id && likedSongIds?.has(id)) || (_id && likedSongIds?.has(_id));
    setState(prev => ({ ...prev, isLiked: !!liked }));
  }, [currentSong, likedSongIds]);

  // Listen for like updates from other components
  useEffect(() => {
    const handleLikeUpdate = (e: Event) => {
      if (!currentSong) return;

      const songId = (currentSong as any).id || currentSong._id;

      // Check if this event includes details about which song was updated
      if (e instanceof CustomEvent && e.detail) {
        // If we have details and it's not for our current song, ignore
        if (e.detail.songId && e.detail.songId !== songId) {
          return;
        }

        // If we have explicit like state in the event, use it
        if (typeof e.detail.isLiked === 'boolean') {
          setState(prev => ({ ...prev, isLiked: e.detail.isLiked }));
          return;
        }
      }

      // Otherwise do a fresh check from the store
      const freshCheck = songId ? likedSongIds?.has(songId) : false;
      setState(prev => ({ ...prev, isLiked: freshCheck }));
    };

    document.addEventListener('likedSongsUpdated', handleLikeUpdate);
    document.addEventListener('songLikeStateChanged', handleLikeUpdate);

    return () => {
      document.removeEventListener('likedSongsUpdated', handleLikeUpdate);
      document.removeEventListener('songLikeStateChanged', handleLikeUpdate);
    };
  }, [currentSong, likedSongIds]);

  // Optimized seek function with throttling
  const handleSeek = React.useCallback((clientX: number, rect: DOMRect, immediate = false) => {
    const offsetX = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, offsetX / rect.width));
    const newTime = percentage * duration;

    // Update visual progress immediately for smooth dragging
    setState(prev => ({ ...prev, dragProgress: percentage * 100 }));

    // Throttle actual audio seeking to prevent lag
    const now = Date.now();
    if (immediate || now - lastSeekTimeRef.current > 100) { // Throttle to 10fps for audio seeking
      lastSeekTimeRef.current = now;
      if (!isNaN(newTime)) {
        seekTo(newTime);
      }
    } else {
      // Clear previous timeout and set new one for delayed seek
      if (dragTimeoutRef.current) {
        clearTimeout(dragTimeoutRef.current);
      }

      dragTimeoutRef.current = setTimeout(() => {
        if (!isNaN(newTime)) {
          seekTo(newTime);
        }
      }, 50);
    }
  }, [duration, seekTo]);

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) return; // Prevent click during drag
    const rect = e.currentTarget.getBoundingClientRect();
    handleSeek(e.clientX, rect, true);
  };

  const handleProgressMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setState(prev => ({ ...prev, isDragging: true }));
    const rect = e.currentTarget.getBoundingClientRect();
    handleSeek(e.clientX, rect, true);
  };

  const handleProgressTouchStart = (e: React.TouchEvent) => {
    // Don't preventDefault here - handle it in the native event listener
    setState(prev => ({ ...prev, isDragging: true }));
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    handleSeek(touch.clientX, rect, true);
  };

  // Optimized drag handling with RAF for smooth performance
  useEffect(() => {
    let animationFrameId: number | null = null;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !progressRef.current) return;

      // Use requestAnimationFrame for smooth visual updates
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }

      animationFrameId = requestAnimationFrame(() => {
        if (progressRef.current) {
          const rect = progressRef.current.getBoundingClientRect();
          handleSeek(e.clientX, rect);
        }
      });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging || !progressRef.current) return;

      const touch = e.touches[0];

      // Use requestAnimationFrame for smooth visual updates
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }

      animationFrameId = requestAnimationFrame(() => {
        if (progressRef.current) {
          const rect = progressRef.current.getBoundingClientRect();
          handleSeek(touch.clientX, rect);
        }
      });
    };

    const handleEnd = () => {
      setState(prev => ({ ...prev, isDragging: false, dragProgress: 0 }));

      // Clear any pending animation frames
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }

      // Clear any pending seek timeouts
      if (dragTimeoutRef.current) {
        clearTimeout(dragTimeoutRef.current);
        dragTimeoutRef.current = null;
      }
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove, { passive: true });
      document.addEventListener('mouseup', handleEnd);
      document.addEventListener('touchmove', handleTouchMove, { passive: true });
      document.addEventListener('touchend', handleEnd, { passive: true });
      document.addEventListener('touchcancel', handleEnd, { passive: true });
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleEnd);
      document.removeEventListener('touchcancel', handleEnd);

      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isDragging, duration, handleSeek]);

  // Reset swipe container when song changes to prevent glitches
  useEffect(() => {
    if (swipeContainerRef.current) {
      // Force reset all transform properties when song changes
      swipeContainerRef.current.style.cssText = 'transform: ; opacity: ; transition: ; will-change: auto;';

      // Cancel any ongoing animations
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      // Reset swipe state if song changes during swipe
      setState(prev => ({
        ...prev,
        swipeState: {
          ...prev.swipeState,
          isDragging: false,
          hasMovedHorizontally: false,
          isVerticalScroll: false,
          direction: null,
          initialDirection: null
        }
      }));
    }
  }, [currentSong?._id, currentSong?.title]); // Reset when song actually changes

  // Swipe gesture handlers with Mavrixfy-like logic
  const handleSwipeStart = useCallback((clientX: number, clientY: number) => {
    if (isDragging) return; // Don't interfere with progress bar dragging

    setState(prev => ({
      ...prev,
      swipeState: {
        isDragging: true,
        startX: clientX,
        startY: clientY,
        currentX: clientX,
        currentY: clientY,
        deltaX: 0,
        deltaY: 0,
        velocity: 0,
        lastMoveTime: Date.now(),
        direction: null,
        isVerticalScroll: false,
        hasMovedHorizontally: false,
        initialDirection: null
      }
    }));
  }, [isDragging]);

  const handleSwipeMove = useCallback((clientX: number, clientY: number) => {
    if (!swipeState.isDragging) return;

    const now = Date.now();
    const deltaX = clientX - swipeState.startX;
    const deltaY = clientY - swipeState.startY;
    const timeDelta = now - swipeState.lastMoveTime;

    // Calculate velocity for momentum (pixels per millisecond)
    const velocity = timeDelta > 0 ? Math.abs(deltaX) / timeDelta : 0;

    // Determine initial direction if not set (Mavrixfy-like logic)
    let initialDirection = swipeState.initialDirection;
    if (!initialDirection && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
      initialDirection = Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical';
    }

    // Once direction is determined, stick to it (prevents accidental swipes)
    const isVerticalScroll = initialDirection === 'vertical';

    // Only process horizontal swipes with higher threshold
    if (!isVerticalScroll && Math.abs(deltaX) > 15) { // Increased from 10 to 15
      const direction = deltaX > 0 ? 'right' : 'left';

      // Check if we can actually swipe in this direction
      const canSwipeLeft = currentIndex < queue.length - 1;
      const canSwipeRight = currentIndex > 0;

      // Mavrixfy-like resistance when reaching boundaries
      if ((direction === 'left' && !canSwipeLeft) || (direction === 'right' && !canSwipeRight)) {
        // Apply strong resistance at boundaries (like Mavrixfy)
        const resistanceFactor = 0.2; // Much stronger resistance
        const limitedDeltaX = Math.sign(deltaX) * Math.min(Math.abs(deltaX) * resistanceFactor, 40);

        if (swipeContainerRef.current) {
          const progress = Math.min(Math.abs(limitedDeltaX) / 40, 1);
          const scale = 1 - (progress * 0.02); // Minimal scaling at boundaries
          const opacity = 1 - (progress * 0.1);

          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
          }

          animationFrameRef.current = requestAnimationFrame(() => {
            if (swipeContainerRef.current) {
              // Ensure explicit values to prevent accumulation
              const transformValue = `translateX(${limitedDeltaX}px) scale(${scale})`;
              const opacityValue = opacity.toString();

              Object.assign(swipeContainerRef.current.style, {
                transform: transformValue,
                opacity: opacityValue,
                willChange: 'transform, opacity'
              });
            }
          });
        }

        setState(prev => ({
          ...prev,
          swipeState: {
            ...prev.swipeState,
            currentX: clientX,
            currentY: clientY,
            deltaX: limitedDeltaX,
            deltaY,
            velocity,
            lastMoveTime: now,
            direction,
            isVerticalScroll,
            hasMovedHorizontally: true,
            initialDirection
          }
        }));
        return;
      }

      setState(prev => ({
        ...prev,
        swipeState: {
          ...prev.swipeState,
          currentX: clientX,
          currentY: clientY,
          deltaX,
          deltaY,
          velocity,
          lastMoveTime: now,
          direction,
          isVerticalScroll,
          hasMovedHorizontally: true,
          initialDirection
        }
      }));

      // Apply transform to album art for smooth visual feedback (Mavrixfy-like)
      if (swipeContainerRef.current && Math.abs(deltaX) > 25) { // Increased threshold from 20 to 25
        // Mavrixfy-like scaling and movement with resistance
        const maxMovement = 120; // Maximum movement distance
        const resistance = Math.abs(deltaX) / maxMovement;
        const clampedResistance = Math.min(resistance, 1);

        const movement = deltaX * (1 - clampedResistance * 0.3); // Apply resistance
        const scale = 1 - (clampedResistance * 0.08); // Subtle scaling like Mavrixfy
        const opacity = 1 - (clampedResistance * 0.25); // Gentle opacity change

        // Use requestAnimationFrame for smooth performance
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }

        animationFrameRef.current = requestAnimationFrame(() => {
          if (swipeContainerRef.current) {
            // Ensure we're setting explicit values to prevent accumulation
            const transformValue = `translateX(${movement}px) scale(${scale})`;
            const opacityValue = opacity.toString();

            Object.assign(swipeContainerRef.current.style, {
              transform: transformValue,
              opacity: opacityValue,
              willChange: 'transform, opacity'
            });
          }
        });
      }
    } else if (isVerticalScroll) {
      setState(prev => ({
        ...prev,
        swipeState: {
          ...prev.swipeState,
          isVerticalScroll: true,
          initialDirection
        }
      }));
    } else {
      // Update state even for small movements to track direction
      setState(prev => ({
        ...prev,
        swipeState: {
          ...prev.swipeState,
          currentX: clientX,
          currentY: clientY,
          deltaX,
          deltaY,
          velocity,
          lastMoveTime: now,
          initialDirection
        }
      }));
    }
  }, [swipeState, currentIndex, queue.length]);

  const handleSwipeEnd = useCallback(() => {
    if (!swipeState.isDragging) return;

    const { deltaX, velocity, direction, isVerticalScroll, hasMovedHorizontally } = swipeState;

    // Cancel any pending animation frames to prevent glitches
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Reset swipe state
    setState(prev => ({
      ...prev,
      swipeState: {
        isDragging: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
        deltaX: 0,
        deltaY: 0,
        velocity: 0,
        lastMoveTime: 0,
        direction: null,
        isVerticalScroll: false,
        hasMovedHorizontally: false,
        initialDirection: null
      }
    }));

    // Force reset album art transform to prevent glitches
    if (swipeContainerRef.current) {
      // Immediately reset to prevent accumulation
      Object.assign(swipeContainerRef.current.style, {
        transform: 'translateX(0px) scale(1)',
        opacity: '1',
        transition: 'all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
      });

      // Force a reflow to ensure the reset is applied
      swipeContainerRef.current.offsetHeight;

      // Then animate to final state
      requestAnimationFrame(() => {
        if (swipeContainerRef.current) {
          Object.assign(swipeContainerRef.current.style, {
            transform: '',
            opacity: ''
          });
        }
      });

      // Remove transition after animation and ensure clean state
      setTimeout(() => {
        if (swipeContainerRef.current) {
          Object.assign(swipeContainerRef.current.style, {
            transition: '',
            transform: '',
            opacity: '',
            willChange: 'auto'
          });
        }
      }, 400);
    }

    // Don't trigger song change for vertical scrolls or if no horizontal movement
    if (isVerticalScroll || !hasMovedHorizontally) return;

    // Mavrixfy-like thresholds - much higher and more restrictive
    const distanceThreshold = 100; // Increased from 80 to 100
    const velocityThreshold = 0.8; // Increased from 0.3 to 0.8
    const minimumDistance = 60; // Must move at least this much regardless of velocity

    // Must meet BOTH distance AND velocity requirements, OR exceed high distance threshold
    const meetsDistanceRequirement = Math.abs(deltaX) >= distanceThreshold;
    const meetsVelocityRequirement = velocity >= velocityThreshold && Math.abs(deltaX) >= minimumDistance;
    const shouldTrigger = meetsDistanceRequirement || meetsVelocityRequirement;

    if (shouldTrigger && direction && queue.length > 1) {
      // Check boundaries again before triggering
      const canSwipeLeft = currentIndex < queue.length - 1;
      const canSwipeRight = currentIndex > 0;

      if ((direction === 'left' && canSwipeLeft) || (direction === 'right' && canSwipeRight)) {
        // Add haptic feedback on mobile devices
        if ('vibrate' in navigator) {
          navigator.vibrate(50); // Light haptic feedback
        }

        if (direction === 'left') {
          // Swipe left = next song
          playNext();
        } else if (direction === 'right') {
          // Swipe right = previous song
          playPrevious();
        }
      }
    }
  }, [swipeState, playNext, playPrevious, queue.length, currentIndex]);

  // Touch event handlers with improved gesture recognition
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return; // Only handle single touch

    // Prevent if touch starts on interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[role="button"]') || target.closest('input')) {
      return;
    }

    const touch = e.touches[0];
    handleSwipeStart(touch.clientX, touch.clientY);
  }, [handleSwipeStart]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1 || !swipeState.isDragging) return;

    // Only prevent default if we're in a horizontal swipe - but don't use preventDefault in React events
    // The browser will handle this automatically based on our touch-action CSS

    const touch = e.touches[0];
    handleSwipeMove(touch.clientX, touch.clientY);
  }, [handleSwipeMove, swipeState.isDragging]);

  const handleTouchEnd = useCallback((_e: React.TouchEvent) => {
    handleSwipeEnd();
  }, [handleSwipeEnd]);

  // Mouse event handlers for desktop testing (with similar restrictions)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Prevent if mouse down on interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[role="button"]') || target.closest('input')) {
      return;
    }

    handleSwipeStart(e.clientX, e.clientY);
  }, [handleSwipeStart]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    handleSwipeMove(e.clientX, e.clientY);
  }, [handleSwipeMove]);

  const handleMouseUp = useCallback(() => {
    handleSwipeEnd();
  }, [handleSwipeEnd]);

  const handleMouseMoveRef = useRef(handleMouseMove);
  const handleMouseUpRef = useRef(handleMouseUp);

  useEffect(() => {
    handleMouseMoveRef.current = handleMouseMove;
    handleMouseUpRef.current = handleMouseUp;
  });

  // Global mouse event listeners for desktop
  useEffect(() => {
    if (swipeState.isDragging) {
      const onMouseMove = (e: MouseEvent) => handleMouseMoveRef.current(e);
      const onMouseUp = () => handleMouseUpRef.current();

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.addEventListener('mouseleave', onMouseUp);

      return () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.removeEventListener('mouseleave', onMouseUp);
      };
    }
  }, [swipeState.isDragging]);

  const handleLikeToggle = () => {
    if (!currentSong) return;
    const songId = (currentSong as any).id || currentSong._id;

    // Optimistically update the UI immediately
    setState(prev => ({ ...prev, isLiked: !prev.isLiked }));

    toggleLikeSong({
      _id: songId,
      title: currentSong.title,
      artist: currentSong.artist,
      albumId: currentSong.albumId || null,
      imageUrl: currentSong.imageUrl || '',
      audioUrl: currentSong.audioUrl,
      duration: currentSong.duration || 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      likedAt: new Date().toISOString()
    });
  };

  if (!currentSong) return null;

  // Use drag progress for smooth visual feedback, fallback to actual progress
  const displayProgress = isDragging ? dragProgress : (currentTime / duration) * 100 || 0;

  return (
    <LazyMotion features={domAnimation} strict>
      <AnimatePresence>
        {isOpen && (
          <m.div
          ref={panelRef}
          className={cn(
            'fixed inset-0 z-[200] flex flex-col song-details-view',
            responsiveClasses.container,
          )}
          style={{
            background: `linear-gradient(180deg, ${albumColors.primary} 0%, ${albumColors.secondary} 100%)`,
          }}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 380, damping: 42, mass: 1 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.3 }}
          dragMomentum={false}
          dragDirectionLock
          onDragEnd={(_e, info) => {
            if (info.offset.y > 100 || info.velocity.y > 500) {
              onClose();
            }
          }}
        >
          {/* Header - Fixed height, clears notch/Dynamic Island */}
          <div className={cn(
            "flex items-center justify-between px-4 pb-4 relative flex-shrink-0",
            responsiveClasses.header || "h-auto"
          )}
            style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
          >
            <button type="button"
              onClick={onClose}
              className="p-2 -ml-2 text-white/90 hover:text-white active:scale-95 transition-transform touch-target"
            >
              <KeyboardArrowDownIcon className="h-6 w-6" />
            </button>
            <span className="text-xs font-semibold text-white/70 uppercase tracking-widest">
              Now Playing
            </span>
            <button type="button"
              onClick={() => setState(prev => ({ ...prev, showMenu: !prev.showMenu }))}
              className="p-2 -mr-2 text-white/90 hover:text-white active:scale-95 transition-transform touch-target"
            >
              <MoreHorizIcon className="h-5 w-5" />
            </button>

            {/* Dropdown Menu */}
            {showMenu && (
              <>
                <button
                  type="button"
                  aria-label="Close menu"
                  className="fixed inset-0 z-40"
                  onClick={() => setState(prev => ({ ...prev, showMenu: false }))}
                />
                <div className="absolute top-14 right-4 w-56 bg-[#282828] rounded-lg shadow-2xl z-50 overflow-hidden">
                  <div className="py-2">
                    <button type="button" className="w-full px-4 py-3 text-left text-sm text-white hover:bg-white/10 transition-colors flex items-center gap-3 touch-target">
                      <QueueMusicIcon className="h-5 w-5" />
                      Add to queue
                    </button>
                    <ShareSong
                      song={currentSong}
                      trigger={
                        <button type="button" className="w-full px-4 py-3 text-left text-sm text-white hover:bg-white/10 transition-colors flex items-center gap-3 touch-target">
                          <IosShareIcon className="h-5 w-5" />
                          Share
                        </button>
                      }
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Main Content - Conditional layout based on queue visibility */}
          <div className="flex-1 flex flex-col px-4 min-h-0">
            {showQueue && queue.length > 1 ? (
              <CompactQueueView
                currentSong={currentSong}
                currentTime={currentTime}
                duration={duration}
                displayProgress={displayProgress}
                queue={queue}
                currentIndex={currentIndex}
                screenSize={screenSize}
                responsiveClasses={responsiveClasses}
                swipeContainerRef={swipeContainerRef}
                progressRef={progressRef}
                handleTouchStart={handleTouchStart}
                handleTouchMove={handleTouchMove}
                handleTouchEnd={handleTouchEnd}
                handleMouseDown={handleMouseDown}
                handleLikeToggle={handleLikeToggle}
                handleProgressClick={handleProgressClick}
                handleProgressMouseDown={handleProgressMouseDown}
                handleProgressTouchStart={handleProgressTouchStart}
                togglePlay={togglePlay}
                playPrevious={playPrevious}
                playNext={playNext}
                toggleRepeat={toggleRepeat}
                playAlbum={playAlbum}
              playerState={{ isLiked: isLiked, isPlaying: isPlaying, isRepeating: isRepeating, isDragging: isDragging }}
            />
            ) : (
              <NormalPlayerView
                currentSong={currentSong}
                currentTime={currentTime}
                duration={duration}
                displayProgress={displayProgress}
                screenSize={screenSize}
                responsiveClasses={responsiveClasses}
                swipeContainerRef={swipeContainerRef}
                progressRef={progressRef}
                handleTouchStart={handleTouchStart}
                handleTouchMove={handleTouchMove}
                handleTouchEnd={handleTouchEnd}
                handleMouseDown={handleMouseDown}
                handleLikeToggle={handleLikeToggle}
                handleProgressClick={handleProgressClick}
                handleProgressMouseDown={handleProgressMouseDown}
                handleProgressTouchStart={handleProgressTouchStart}
                togglePlay={togglePlay}
                playPrevious={playPrevious}
                playNext={playNext}
                toggleRepeat={toggleRepeat}
              playerState={{ isLiked: isLiked, isPlaying: isPlaying, isRepeating: isRepeating, isDragging: isDragging }}
            />
            )}
          </div>

          {/* Bottom Actions — always anchored to the bottom, clears home indicator */}
          <div
            className="px-4 flex items-center justify-center flex-shrink-0"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)', minHeight: '60px' }}
          >
            <div className="flex items-center justify-center gap-12">
              <button type="button"
                onClick={() => setState(prev => ({ ...prev, showQueue: !prev.showQueue }))}
                className={cn(
                  "flex flex-col items-center gap-1 active:scale-95 transition-all touch-target",
                  showQueue ? "text-white" : "text-white/70 hover:text-white"
                )}
              >
                <QueueMusicIcon className="h-5 w-5" />
                <span className="text-xs font-medium">Queue</span>
              </button>

              <ShareSong
                song={currentSong}
                trigger={
                  <button type="button" className="flex flex-col items-center gap-1 text-white/70 hover:text-white active:scale-95 transition-all touch-target">
                    <IosShareIcon className="h-5 w-5" />
                    <span className="text-xs font-medium">Share</span>
                  </button>
                }
              />
            </div>
          </div>
          </m.div>
        )}
      </AnimatePresence>
    </LazyMotion>
  );
};

export default SongDetailsView;
