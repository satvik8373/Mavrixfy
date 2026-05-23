import { useEffect, useReducer } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { usePlayerStore } from '../../stores/usePlayerStore';
import { useMusicStore } from '../../stores/useMusicStore';
import { useLikedSongsStore } from '../../stores/useLikedSongsStore';
import { Button } from '../../components/ui/button';
import { Play, Heart, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { resolveArtist } from '../../lib/resolveArtist';
import { updateMetaTags } from '@/utils/metaTags';
import { artistPath, generateBreadcrumbSchema, generateSongSEO, genrePath, SITE_URL } from '@/utils/seoHelpers';

interface SongPageState {
  song: any | null;
  loading: boolean;
  error: string | null;
}

type SongPageAction =
  | { type: 'missing_id' }
  | { type: 'loaded'; song: any }
  | { type: 'not_found' }
  | { type: 'failed' };

const songPageReducer = (state: SongPageState, action: SongPageAction): SongPageState => {
  switch (action.type) {
    case 'missing_id':
      return { song: null, loading: false, error: 'No song ID provided' };
    case 'loaded':
      return { song: action.song, loading: false, error: null };
    case 'not_found':
      return { song: null, loading: false, error: 'Song not found' };
    case 'failed':
      return { song: null, loading: false, error: 'Failed to load song' };
    default:
      return state;
  }
};

const SongPage = () => {
  const { songId } = useParams<{ songId: string }>();
  const navigate = useNavigate();
  const [{ song, loading, error }, dispatchSongPage] = useReducer(songPageReducer, {
    song: null,
    loading: false,
    error: null,
  });
  
  const { setCurrentSong, setIsPlaying } = usePlayerStore();
  const { searchIndianSongs } = useMusicStore();
  const { likedSongIds, toggleLikeSong } = useLikedSongsStore();
  const currentSongId = song ? song._id || (song as any).id : null;
  const isLiked = currentSongId ? likedSongIds?.has(currentSongId) : false;

  useEffect(() => {
    const loadSong = async () => {
      if (!songId) {
        dispatchSongPage({ type: 'missing_id' });
        return;
      }

      try {
        // First, try to find the song in liked songs
        const likedSongs = await import('../../services/likedSongsService').then(m => m.loadLikedSongs());
        const likedSong = likedSongs.find((s: any) => s._id === songId || (s as any).id === songId);
        
        if (likedSong) {
          dispatchSongPage({ type: 'loaded', song: likedSong });
          // Set the song but DON'T auto-play - let user decide
          setCurrentSong(likedSong as any);
          // setIsPlaying(true); // Removed unwanted autoplay
          return;
        }

        // If not found in liked songs, try to search for it
        // We'll need to search by a generic term and then find the specific song
        await searchIndianSongs('popular songs');
        const searchResults = useMusicStore.getState().indianSearchResults;
        const foundSong = searchResults.find((s: any) => 
          s._id === songId || (s as any).id === songId
        );

        if (foundSong) {
          dispatchSongPage({ type: 'loaded', song: foundSong });
          // Set the song but DON'T auto-play - let user decide
          setCurrentSong(foundSong as any);
          // setIsPlaying(true); // Removed unwanted autoplay
        } else {
          // Song not found
          dispatchSongPage({ type: 'not_found' });
          toast.error('Song not found. It may have been removed or is not available.');
        }
      } catch (err) {
        dispatchSongPage({ type: 'failed' });
        toast.error('Failed to load song. Please try again.');
      }
    };

    loadSong();
  }, [songId, setCurrentSong, setIsPlaying, searchIndianSongs]);

  useEffect(() => {
    if (!song) return;

    const artist = resolveArtist(song);
    const seo = generateSongSEO({ ...song, artist });
    updateMetaTags({
      ...seo,
      schema: [
        seo.schema,
        generateBreadcrumbSchema([
          { name: 'Home', url: SITE_URL },
          { name: 'Songs', url: `${SITE_URL}/songs` },
          { name: artist, url: `${SITE_URL}${artistPath(artist)}` },
          { name: song.title, url: seo.url },
        ]),
      ],
      alternates: [
        { hrefLang: 'en', href: seo.url },
        { hrefLang: 'hi', href: `${seo.url}?lang=hi` },
        { hrefLang: 'gu', href: `${seo.url}?lang=gu` },
        { hrefLang: 'x-default', href: seo.url },
      ],
    });
  }, [song]);

  const handlePlay = () => {
    if (song) {
      setCurrentSong(song);
      setIsPlaying(true);
      toast.success(`Now playing: ${song.title}`);
    }
  };

  const handleLike = () => {
    if (song) {
      toggleLikeSong(song);
      toast.success(isLiked ? 'Removed from liked songs' : 'Added to liked songs');
    }
  };

  const artist = song ? resolveArtist(song) : '';
  const genre = song?.genre || song?.language || 'music';
  const releaseYear = song?.year || song?.releaseYear || (song?.createdAt ? new Date(song.createdAt).getFullYear() : null);


  if (loading) {
    return <div className="min-h-screen bg-[#121212]"></div>;
  }

  if (error || !song) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <h1 className="text-2xl font-semibold mb-4 text-foreground">Song Not Found</h1>
          <p className="text-muted-foreground mb-6">
            {error || 'The song you\'re looking for doesn\'t exist or is no longer available.'}
          </p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => navigate('/home')} variant="outline">
              Go Home
            </Button>
            <Button onClick={() => navigate('/search')}>
              Search Songs
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b">
        <div className="flex items-center gap-4 p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold truncate">Song</h1>
            <p className="text-sm text-muted-foreground truncate">{song.title}</p>
          </div>
        </div>
      </div>

      {/* Song Content */}
      <div className="p-6">
        <div className="max-w-md mx-auto">
          {/* Album Art */}
          <div className="mb-6">
            <img
              src={song.imageUrl}
              alt={song.title}
              className="w-full aspect-square rounded-lg object-cover shadow-lg"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 
                  'https://placehold.co/400x400/1f1f1f/959595?text=No+Image';
              }}
            />
          </div>

          {/* Song Info */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-semibold mb-2 text-foreground">{song.title}</h2>
            <p className="text-lg text-muted-foreground mb-4">
              {resolveArtist(song)}
            </p>
            {song.album && (
              <p className="text-sm text-muted-foreground">
                Album: {song.album}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 justify-center">
            <Button
              onClick={handlePlay}
              className="flex items-center gap-2 px-8"
              size="lg"
            >
              <Play className="h-5 w-5" />
              Play
            </Button>
            
            <Button
              onClick={handleLike}
              variant="outline"
              size="icon"
              className="h-12 w-12"
            >
              <Heart 
                className="h-6 w-6" 
                fill={isLiked ? 'currentColor' : 'none'}
                color={isLiked ? '#ef4444' : 'currentColor'}
              />
            </Button>
          </div>

          {/* Additional Info */}
          {song.duration && (
            <div className="mt-8 text-center">
              <p className="text-sm text-muted-foreground">
                Duration: {Math.floor(song.duration / 60)}:{(song.duration % 60).toString().padStart(2, '0')}
              </p>
            </div>
          )}

          <section className="mt-10 rounded-lg border border-border/60 bg-card/40 p-5 text-left">
            <nav className="mb-4 text-sm text-muted-foreground" aria-label="Breadcrumb">
              <Link to="/home" className="hover:text-foreground">Home</Link>
              <span className="mx-2">/</span>
              <Link to="/songs" className="hover:text-foreground">Songs</Link>
              <span className="mx-2">/</span>
              <Link to={artistPath(artist)} className="hover:text-foreground">{artist}</Link>
            </nav>
            <h3 className="mb-3 text-lg font-semibold text-foreground">About {song.title}</h3>
            <p className="text-sm leading-6 text-muted-foreground">
              {song.title} by {artist} is available to stream on Mavrixfy with fast playback,
              playlist saves and discovery links for similar music.
            </p>
            <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Artist</dt>
                <dd className="font-medium text-foreground">
                  <Link to={artistPath(artist)} className="hover:underline">{artist}</Link>
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Genre</dt>
                <dd className="font-medium text-foreground">
                  <Link to={genrePath(genre)} className="hover:underline">{genre}</Link>
                </dd>
              </div>
              {song.album && (
                <div>
                  <dt className="text-muted-foreground">Album</dt>
                  <dd className="font-medium text-foreground">
                    <Link to={`/search?q=${encodeURIComponent(song.album)}`} className="hover:underline">{song.album}</Link>
                  </dd>
                </div>
              )}
              {releaseYear && (
                <div>
                  <dt className="text-muted-foreground">Release year</dt>
                  <dd className="font-medium text-foreground">{releaseYear}</dd>
                </div>
              )}
            </dl>
            <div className="mt-5 flex flex-wrap gap-2 text-sm">
              <Link to={`/search?q=${encodeURIComponent(`${song.title} ${artist}`)}`} className="rounded-full bg-muted px-3 py-1 hover:bg-muted/80">
                Similar songs
              </Link>
              <Link to={`/search?q=${encodeURIComponent(`${artist} playlists`)}`} className="rounded-full bg-muted px-3 py-1 hover:bg-muted/80">
                Related playlists
              </Link>
              <Link to="/trending" className="rounded-full bg-muted px-3 py-1 hover:bg-muted/80">
                Trending music
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default SongPage;
