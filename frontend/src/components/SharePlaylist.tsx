/**
 * Share Playlist Component
 * Wrapper for ShareSheet specifically for playlists
 */

import { useState } from 'react';
import { Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ShareSheet } from './ShareSheet';
import { Playlist } from '@/types';
import { ShareCardContent } from '@/lib/shareCard/types';

interface SharePlaylistProps {
  playlist: Playlist;
  trigger?: React.ReactNode;
  onShare?: () => void;
}

export const SharePlaylist = ({ playlist, trigger, onShare }: SharePlaylistProps) => {
  const [isOpen, setIsOpen] = useState(false);

  // Convert Playlist to ShareCardContent
  const shareContent: ShareCardContent = {
    type: 'playlist',
    id: playlist._id || playlist.id || '',
    title: playlist.name,
    subtitle: `By ${playlist.createdBy?.fullName || 'Unknown'}`,
    imageUrl: playlist.imageUrl || '',
    metadata: {
      trackCount: playlist.songs?.length || 0,
      duration: playlist.songs?.reduce((acc, song) => acc + (song.duration || 0), 0) || 0,
      songs: playlist.songs?.map(song => ({
        id: song._id,
        title: song.title,
        artist: song.artist,
        duration: song.duration
      })) || []
    }
  };

  return (
    <>
      {trigger ? (
        <button type="button" className="appearance-none bg-transparent border-none p-0 text-left cursor-pointer" onClick={() => { setIsOpen(true); onShare?.(); }}>{trigger}</button>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => { setIsOpen(true); onShare?.(); }}
          className="text-white/70 hover:text-white hover:bg-white/10"
        >
          <Share2 className="h-5 w-5" />
        </Button>
      )}

      <ShareSheet
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        content={shareContent}
        title={playlist.name}
        description={`Check out "${playlist.name}" playlist with ${playlist.songs?.length || 0} songs on Mavrixfy! 🎵`}
      />
    </>
  );
};
