import { useState } from 'react';
import { Song } from '../types';
import { 
  MoreHorizontal, 
  ListPlus, 
  Heart, 
  Share2, 
  Music 
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { useLikedSongsStore } from '../stores/useLikedSongsStore';
import { AddToPlaylistDialog } from './playlist/AddToPlaylistDialog';
import { ShareSong } from './ShareSong';
import { toast } from 'sonner';

interface SongMenuProps {
  song: Song;
  className?: string;
  variant?: 'default' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function SongMenu({ song, className, variant = 'ghost', size = 'icon' }: SongMenuProps) {
  const [showAddToPlaylistDialog, setShowAddToPlaylistDialog] = useState(false);
  const { likedSongIds, toggleLikeSong } = useLikedSongsStore();
  
  const songId = (song as any).id || song._id;
  const songLiked = likedSongIds.has(songId);

  const handleLikeSong = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Optimistically update UI
    toggleLikeSong(song);
    
    // Also dispatch an event for other components
    document.dispatchEvent(new CustomEvent('songLikeStateChanged', { 
      detail: {
        songId,
        song,
        isLiked: !songLiked,
        timestamp: Date.now(),
        source: 'SongMenu'
      }
    }));
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" 
            className={`flex items-center justify-center rounded-full hover:bg-accent transition-colors ${className}`}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="sr-only">Open song menu</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-48">
          <DropdownMenuItem onClick={handleLikeSong}>
            <Heart className={`mr-2 h-4 w-4 ${songLiked ? 'fill-green-500 text-green-500' : ''}`} />
            {songLiked ? 'Remove from Liked Songs' : 'Add to Liked Songs'}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowAddToPlaylistDialog(true)}>
            <ListPlus className="mr-2 h-4 w-4" />
            Add to Playlist
          </DropdownMenuItem>
          <ShareSong
            song={song}
            trigger={(
              <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </DropdownMenuItem>
            )}
          />
          <DropdownMenuItem onClick={(e) => {
            e.stopPropagation();
            window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(`${song.title} ${song.artist}`)}`, '_blank');
          }}>
            <Music className="mr-2 h-4 w-4" />
            Find on YouTube
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
      {showAddToPlaylistDialog && (
        <AddToPlaylistDialog
          song={song}
          isOpen={showAddToPlaylistDialog}
          onClose={() => setShowAddToPlaylistDialog(false)}
        />
      )}
    </>
  );
} 
