import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Song, Playlist } from '../../types';
import { usePlaylistStore } from '../../stores/usePlaylistStore';
import { toast } from 'sonner';
import { ListPlus, Check } from 'lucide-react';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';

interface AddToPlaylistDialogProps {
  song: Song;
  isOpen: boolean;
  onClose: () => void;
}

export function AddToPlaylistDialog({ song, isOpen, onClose }: AddToPlaylistDialogProps) {
  const { userPlaylists, fetchUserPlaylists, addSongToPlaylist } = usePlaylistStore();
  const isLoadingRef = useRef(false);
  const [filter, setFilter] = useState('');
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchUserPlaylists();
    }
  }, [isOpen, fetchUserPlaylists]);

  const handleAddToPlaylist = async (playlist: Playlist) => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setSelectedPlaylist(playlist);
    try {
      await addSongToPlaylist(playlist._id, song._id);
      toast.success(`Added to ${playlist.name}`);
      setTimeout(() => {
        onClose();
      }, 1000); // Close after 1 second to show the check mark animation
    } catch (error) {
      // Failed to add song to playlist
    } finally {
      isLoadingRef.current = false;
    }
  };

  const filteredPlaylists = userPlaylists.filter(playlist =>
    playlist.name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Add to Playlist</DialogTitle>
          <DialogDescription>
            Select a playlist to add "{song.title}" by {song.artist}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Input
            placeholder="Filter playlists..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="mb-4"
          />

          {userPlaylists.length === 0 ? (
            <div className="text-center py-8">
              <ListPlus className="mx-auto h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">You don't have any playlists yet</p>
              <Button variant="outline" className="mt-4" onClick={onClose}>
                Create a Playlist
              </Button>
            </div>
          ) : (
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-2">
                {filteredPlaylists.map(playlist => (
                  <div
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.click(); } }}
                    key={playlist._id}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-accent transition-colors cursor-pointer"
                    onClick={() => handleAddToPlaylist(playlist)}
                  >
                    <div className="h-12 w-12 overflow-hidden rounded-md">
                      <img
                        src={playlist.imageUrl}
                        alt={playlist.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="flex-1 flex flex-col">
                      <span className="font-medium truncate">{playlist.name}</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {playlist.songs.length} songs
                      </span>
                    </div>
                    {selectedPlaylist?._id === playlist._id && (
                      <div className="flex items-center justify-center h-8 w-8 bg-primary rounded-full">
                        <Check className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
