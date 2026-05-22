import React, { useState } from 'react';
import { Play } from 'lucide-react';
import { JioSaavnPlaylist, jioSaavnService } from '@/services/jioSaavnService';
import { cn } from '@/lib/utils';
import { useMobileTapSimple } from '@/hooks/useMobileTapSimple';

interface JioSaavnPlaylistCardProps {
  playlist: JioSaavnPlaylist;
  onClick?: (playlist: JioSaavnPlaylist) => void;
  onPlay?: (playlist: JioSaavnPlaylist) => void;
  className?: string;
  showDescription?: boolean;
}

export const JioSaavnPlaylistCard: React.FC<JioSaavnPlaylistCardProps> = ({
  playlist,
  onClick,
  onPlay,
  className,
  showDescription = true,
}) => {
  const imageUrl =
    playlist.image?.find((image) => image.quality === '150x150')?.url ||
    jioSaavnService.getBestImageUrl(playlist.image);

  const handleClick = () => {
    onClick?.(playlist);
  };

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPlay?.(playlist);
  };

  // Simple mobile tap behavior - single tap to open
  const { isMobile, handleTap, handleTouchStart } = useMobileTapSimple({
    onTap: handleClick,
  });

  return (
    <div
      className={cn(
        "group relative w-full rounded-md p-1 md:p-2 transition-all duration-200 hover:bg-white/5 active:scale-95",
        className
      )}
    >
      <button
        type="button"
        className="absolute inset-0 w-full h-full cursor-pointer z-[1] opacity-0"
        onClick={!isMobile ? handleClick : undefined}
        onTouchStart={handleTouchStart}
        onTouchEnd={isMobile ? handleTap : undefined}
        aria-label={`Open ${playlist.name}`}
      />
      <div className="relative">
        {/* Playlist Image - Consistent aspect ratio */}
        <div className="relative w-full aspect-square mb-2 md:mb-3">
          <div className="w-full h-full rounded-[4px] overflow-hidden shadow-lg relative z-[2]">
            <img
              src={imageUrl}
              alt={playlist.name}
              className="w-full h-full object-cover rounded-[4px]"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/placeholder-playlist.jpg';
              }}
            />
          </div>

          {/* Play Button - Desktop Only */}
          <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hidden md:block z-[3]">
            <button type="button"
              onClick={handlePlayClick}
              className="w-10 h-10 rounded-full bg-primary hover:bg-primary/90 hover:scale-105 flex items-center justify-center shadow-2xl transition-all duration-200"
              aria-label="Play playlist"
            >
              <Play className="w-4 h-4 ml-0.5 text-primary-foreground" fill="currentColor" stroke="none" />
            </button>
          </div>
        </div>

        {/* Playlist Info */}
        <div className="space-y-1">
          <h3 className="text-foreground text-xs md:text-sm font-medium line-clamp-2 leading-tight">
            {playlist.name}
          </h3>

          {showDescription && (
            <p className="text-muted-foreground text-[10px] md:text-xs line-clamp-2">
              {playlist.songCount} songs
              {playlist.language && ` • ${playlist.language}`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
