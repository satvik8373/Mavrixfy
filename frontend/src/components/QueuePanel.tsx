import React, { useEffect, useRef } from 'react';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { X, Trash2, ListMusic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CustomScrollbar } from '@/components/ui/CustomScrollbar';
import gsap from 'gsap';
import { Song } from '@/types';

interface QueuePanelProps {
    onClose: () => void;
}

interface QueueSongRowProps {
    index: number;
    song: Song;
    onRemove: () => void;
}

const QueueSongRow = ({ index, song, onRemove }: QueueSongRowProps) => {
    const itemRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!itemRef.current) return;

        gsap.fromTo(
            itemRef.current,
            { opacity: 0, x: 20 },
            {
                opacity: 1,
                x: 0,
                duration: 0.3,
                delay: 0.3 + index * 0.05,
                ease: 'power2.out',
            }
        );
    }, [index]);

    return (
        <div
            ref={itemRef}
            className="flex items-center gap-2 p-1.5 hover:bg-accent/50 rounded-md group transition-all duration-200"
        >
            <div className="w-5 text-center text-[10px] text-muted-foreground flex-shrink-0">
                {index + 1}
            </div>
            <div className="w-9 h-9 rounded overflow-hidden flex-shrink-0">
                <img
                    src={song.imageUrl}
                    alt={song.title}
                    className="w-full h-full object-cover"
                />
            </div>
            <div className="flex-1 min-w-0">
                <h4 className="font-medium truncate text-xs">{song.title}</h4>
                <p className="text-[10px] text-muted-foreground truncate">{song.artist}</p>
            </div>
            <Button
                variant="ghost"
                size="icon"
                onClick={onRemove}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-opacity h-7 w-7 flex-shrink-0"
            >
                <Trash2 className="w-3.5 h-3.5" />
            </Button>
        </div>
    );
};

const QueuePanel: React.FC<QueuePanelProps> = ({ onClose }) => {
    const { queue, currentSong, currentIndex, removeFromQueue, playAlbum } = usePlayerStore();
    const panelRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    const upcomingSongsWithKeys = React.useMemo(() => {
        return queue.slice(currentIndex + 1).map((song, idx) => ({
            song,
            queueKey: `${song._id || song.title}-${currentIndex + 1 + idx}`,
            originalIndex: currentIndex + 1 + idx,
            displayIndex: idx
        }));
    }, [queue, currentIndex]);

    // Animate in on mount
    useEffect(() => {
        if (panelRef.current && contentRef.current) {
            // Set initial state
            gsap.set(panelRef.current, { x: '100%', opacity: 0 });
            gsap.set(contentRef.current, { opacity: 0, y: 20 });

            // Animate panel sliding in
            gsap.to(panelRef.current, {
                x: '0%',
                opacity: 1,
                duration: 0.4,
                ease: 'power3.out',
            });

            // Animate content fading in with slight delay
            gsap.to(contentRef.current, {
                opacity: 1,
                y: 0,
                duration: 0.3,
                delay: 0.15,
                ease: 'power2.out',
            });
        }
    }, []);

    const handleClose = () => {
        if (panelRef.current && contentRef.current) {
            // Animate content out first
            gsap.to(contentRef.current, {
                opacity: 0,
                y: 20,
                duration: 0.2,
                ease: 'power2.in',
            });

            // Then animate panel sliding out
            gsap.to(panelRef.current, {
                x: '100%',
                opacity: 0,
                duration: 0.3,
                delay: 0.1,
                ease: 'power3.in',
                onComplete: onClose,
            });
        } else {
            onClose();
        }
    };

    const handleClearQueue = () => {
        if (currentSong) {
            playAlbum([currentSong], 0);
        }
    };

    return (
        <div ref={panelRef} className="h-full w-full bg-background flex flex-col overflow-hidden">
            <div ref={contentRef} className="h-full min-h-0 flex flex-col">
                {/* Header */}
                <div className="p-3 flex items-center justify-between border-b border-border/50 flex-shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                    <ListMusic className="w-4 h-4 text-primary flex-shrink-0" />
                    <h2 className="text-base font-semibold truncate">Queue</h2>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                    {upcomingSongsWithKeys.length > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleClearQueue}
                            className="text-muted-foreground hover:text-red-500 text-xs h-7 px-2"
                        >
                             Clear
                        </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={handleClose} className="rounded-full h-7 w-7">
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Content */}
            <CustomScrollbar className="flex-1 min-h-0 w-full">
                <div className="px-3">
                    <div className="py-3 space-y-4">
                         {/* Now Playing */}
                        {currentSong && (
                            <div className="space-y-2">
                                <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Now Playing</h3>
                                <div className="flex items-center gap-2 p-2 bg-accent/50 rounded-lg border border-primary/20">
                                    <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 relative">
                                    {/* playing animation overlay */}
                                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                        <div className="flex gap-1 items-end h-4">
                                            <div className="w-1 bg-primary animate-[music-bar_1s_ease-in-out_infinite] h-2"></div>
                                            <div className="w-1 bg-primary animate-[music-bar_1.2s_ease-in-out_infinite_0.1s] h-4"></div>
                                            <div className="w-1 bg-primary animate-[music-bar_0.8s_ease-in-out_infinite_0.2s] h-3"></div>
                                        </div>
                                    </div>
                                    <img
                                        src={currentSong.imageUrl}
                                        alt={currentSong.title}
                                        className="w-full h-full object-cover"
                                    />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-medium truncate text-primary text-xs">{currentSong.title}</h4>
                                         <p className="text-[10px] text-muted-foreground truncate">{currentSong.artist}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Next In Queue */}
                        <div className="space-y-2 pb-16">
                            <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Next In Queue</h3>

                            {upcomingSongsWithKeys.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <p className="text-xs">No songs in queue</p>
                                    <p className="text-[10px] mt-1">Add songs by swiping right</p>
                                </div>
                            ) : (
                                <div className="space-y-0.5">
                                    {upcomingSongsWithKeys.map(({ song, queueKey, originalIndex, displayIndex }) => (
                                        <QueueSongRow
                                            key={queueKey}
                                            index={displayIndex}
                                            song={song}
                                            onRemove={() => removeFromQueue(originalIndex)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </CustomScrollbar>
            </div>
        </div>
    );
};

export default QueuePanel;
