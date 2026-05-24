import React from 'react';
import { m, AnimatePresence, LazyMotion, domAnimation } from 'framer-motion';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { X, Trash2, ListMusic, GripHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { shallow } from 'zustand/shallow';

interface QueueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const MOBILE_MIN_HEIGHT = 42;
const MOBILE_MID_HEIGHT = 62;
const MOBILE_MAX_HEIGHT = 88;

const subscribeViewport = (callback: () => void) => {
  window.addEventListener('resize', callback);
  return () => window.removeEventListener('resize', callback);
};

const getIsMobileSnapshot = () =>
  typeof window !== 'undefined' ? window.innerWidth < 768 : false;

const QueueDrawer: React.FC<QueueDrawerProps> = ({ isOpen, onClose }) => {
  const { queue, currentSong, currentIndex, removeFromQueue, playAlbum } = usePlayerStore(
    (state) => ({
      queue: state.queue,
      currentSong: state.currentSong,
      currentIndex: state.currentIndex,
      removeFromQueue: state.removeFromQueue,
      playAlbum: state.playAlbum,
    }),
    shallow
  );
  const isMobile = React.useSyncExternalStore(subscribeViewport, getIsMobileSnapshot, () => false);
  const [drawerHeight, setDrawerHeight] = React.useState(MOBILE_MID_HEIGHT);
  const [isDragging, setIsDragging] = React.useState(false);
  const startYRef = React.useRef(0);
  const startHeightRef = React.useRef(MOBILE_MID_HEIGHT);

  const getClientY = (e: React.TouchEvent | React.MouseEvent | TouchEvent | MouseEvent) => {
    if ('touches' in e && e.touches.length > 0) return e.touches[0].clientY;
    if ('changedTouches' in e && e.changedTouches.length > 0) return e.changedTouches[0].clientY;
    return (e as MouseEvent).clientY;
  };

  const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isMobile) return;
    setIsDragging(true);
    startYRef.current = getClientY(e);
    startHeightRef.current = drawerHeight;
  };

  const handleDragMove = React.useCallback((e: TouchEvent | MouseEvent) => {
    if (!isDragging) return;

    const clientY = getClientY(e);
    const deltaY = startYRef.current - clientY;
    const windowHeight = window.innerHeight;
    const deltaPercent = (deltaY / windowHeight) * 100;
    const next = Math.max(MOBILE_MIN_HEIGHT, Math.min(MOBILE_MAX_HEIGHT, startHeightRef.current + deltaPercent));

    setDrawerHeight(next);
  }, [isDragging]);

  const handleDragEnd = React.useCallback(() => {
    if (!isDragging) return;

    setIsDragging(false);

    if (drawerHeight < 47) {
      onClose();
      return;
    }

    const snapPoints = [MOBILE_MIN_HEIGHT, MOBILE_MID_HEIGHT, MOBILE_MAX_HEIGHT];
    const closest = snapPoints.reduce((prev, curr) =>
      Math.abs(curr - drawerHeight) < Math.abs(prev - drawerHeight) ? curr : prev
    );
    setDrawerHeight(closest);
  }, [isDragging, drawerHeight, onClose]);

  const handleDragMoveRef = React.useRef(handleDragMove);
  const handleDragEndRef = React.useRef(handleDragEnd);

  React.useEffect(() => {
    handleDragMoveRef.current = handleDragMove;
    handleDragEndRef.current = handleDragEnd;
  });

  React.useEffect(() => {
    if (!isDragging) return;

    const onTouchMove = (e: TouchEvent) => handleDragMoveRef.current(e);
    const onMouseMove = (e: MouseEvent) => handleDragMoveRef.current(e);
    const onTouchEnd = () => handleDragEndRef.current();
    const onMouseUp = () => handleDragEndRef.current();

    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging]);

  const upcomingSongs = queue.slice(currentIndex + 1);
  const upcomingSongsWithKeys = React.useMemo(() => {
    return upcomingSongs.map((song, index) => ({
      song,
      queueKey: `${song._id}-${currentIndex + 1 + index}`
    }));
  }, [upcomingSongs, currentIndex]);

  const handleClearQueue = () => {
    if (currentSong) {
      playAlbum([currentSong], 0);
    }
  };

  return (
    <LazyMotion features={domAnimation} strict>
      <AnimatePresence>
        {isOpen && (
          <>
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.44 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onClose}
              className="fixed inset-0 bg-zinc-950 z-50"
            />

            <m.div
              initial={isMobile ? { y: '100%' } : { x: '100%' }}
              animate={isMobile ? { y: 0 } : { x: 0 }}
              exit={isMobile ? { y: '100%' } : { x: '100%' }}
              transition={
                isMobile
                  ? { type: 'spring', stiffness: 320, damping: 34, mass: 0.52 }
                  : { type: 'tween', duration: 0.25, ease: 'easeOut' }
              }
              className={
                isMobile
                  ? 'fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-[28px] border border-white/15 bg-[linear-gradient(180deg,rgba(32,32,40,0.98)_0%,rgba(18,18,25,0.98)_100%)] shadow-[0_-18px_50px_rgba(0,0,0,0.65)] backdrop-blur-2xl'
                  : 'fixed top-0 right-0 bottom-0 w-[420px] z-50 flex flex-col border-l border-white/10 bg-[#141414] shadow-2xl'
              }
              style={
                isMobile
                  ? {
                      height: `${drawerHeight}vh`,
                      transition: isDragging ? 'none' : 'height 200ms ease-out',
                      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                    }
                  : undefined
              }
            >
            {isMobile && (
              <button
                type="button"
                aria-label="Drag to resize queue"
                className="w-full flex items-center justify-center pt-2 pb-1 cursor-grab active:cursor-grabbing"
                onTouchStart={handleDragStart}
                onMouseDown={handleDragStart}
              >
                <div className="px-2 py-1 rounded-full bg-white/5 border border-white/10">
                  <GripHorizontal className="w-5 h-5 text-white/55" />
                </div>
              </button>
            )}

            <div className="px-4 md:px-6 py-3 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                  <ListMusic className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-white font-semibold leading-tight">Queue</h2>
                  <p className="text-[11px] text-white/60 leading-tight">{queue.length} songs</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {upcomingSongs.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearQueue}
                    className="text-white/70 hover:text-white hover:bg-white/10 rounded-full h-8 px-3"
                  >
                    Clear
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="rounded-full w-8 h-8 text-white/75 hover:text-white hover:bg-white/10"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1 px-4 md:px-5">
              <div className="py-4 space-y-5">
                {currentSong && (
                  <section className="space-y-2">
                    <h3 className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/55">Now Playing</h3>
                    <div className="flex items-center gap-3 p-3 rounded-2xl border border-white/12 bg-white/5">
                      <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0">
                        <img src={currentSong.imageUrl} alt={currentSong.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white truncate">{currentSong.title}</p>
                        <p className="text-xs text-white/65 truncate">{currentSong.artist}</p>
                      </div>
                    </div>
                  </section>
                )}

                <section className="space-y-2 pb-6">
                  <h3 className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/55">Up Next</h3>
                  {upcomingSongs.length === 0 ? (
                    <div className="text-center rounded-2xl border border-white/10 bg-white/5 py-8 px-4 text-white/60">
                      <p className="text-sm">No songs in queue</p>
                      <p className="text-xs mt-1">Add songs to keep playback going</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {upcomingSongsWithKeys.map(({ song, queueKey }, idx) => (
                        <div
                          key={queueKey}
                          className="group flex items-center gap-3 p-2.5 rounded-2xl border border-transparent hover:border-white/10 bg-white/[0.03] hover:bg-white/[0.07] transition-colors"
                        >
                          <div className="w-6 text-center text-[11px] text-white/45">{idx + 1}</div>
                          <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
                            <img src={song.imageUrl} alt={song.title} className="w-full h-full object-cover" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-white truncate">{song.title}</p>
                            <p className="text-xs text-white/65 truncate">{song.artist}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeFromQueue(currentIndex + 1 + idx)}
                            className="w-8 h-8 rounded-full text-white/45 hover:text-red-300 hover:bg-red-500/15 transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100"
                            aria-label="Remove from queue"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </ScrollArea>
            </m.div>
          </>
        )}
      </AnimatePresence>
    </LazyMotion>
  );
};

export default QueueDrawer;
