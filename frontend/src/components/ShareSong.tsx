/**
 * Share Song Component
 * Wrapper for ShareSheet specifically for songs
 */

import { useState } from 'react';
import { Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ShareSheet } from './ShareSheet';
import { Song } from '@/types';
import { ShareCardContent } from '@/lib/shareCard/types';

interface ShareSongProps {
  song: Song;
  trigger?: React.ReactNode;
}

export const ShareSong = ({ song, trigger }: ShareSongProps) => {
  const [isOpen, setIsOpen] = useState(false);

  // Convert Song to ShareCardContent
  const shareContent: ShareCardContent = {
    type: 'song',
    id: song._id || (song as any).id || '',
    title: song.title,
    subtitle: song.artist,
    imageUrl: song.imageUrl || '',
    audioUrl: song.audioUrl,
    metadata: {
      duration: song.duration
    }
  };

  return (
    <>
      {trigger ? (
        <div role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.click(); } }} onClick={() => setIsOpen(true)}>{trigger}</div>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(true)}
          className="text-white/70 hover:text-white hover:bg-white/10"
        >
          <Share2 className="h-5 w-5" />
        </Button>
      )}

      <ShareSheet
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        content={shareContent}
        title={`${song.title} - ${song.artist}`}
        description={`Listen to "${song.title}" by ${song.artist} on Mavrixfy! 🎵`}
      />
    </>
  );
};
