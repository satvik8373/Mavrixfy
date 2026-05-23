import { Song, Album, Playlist } from '@/types';

export const SITE_URL = 'https://mavrixfy.site';
export const DEFAULT_SOCIAL_IMAGE = `${SITE_URL}/mavrixfy.png`;

export const toSeoSlug = (value: string | number | null | undefined): string => {
  const slug = String(value ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'music';
};

export const songPath = (song: Partial<Song> & { id?: string }) => {
  const id = song._id || song.id;
  const readable = [song.title, song.artist].filter(Boolean).join(' ');
  return `/song/${id || toSeoSlug(readable)}`;
};

export const artistPath = (artist: string) => `/artist/${toSeoSlug(artist)}`;
export const genrePath = (genre: string) => `/genre/${toSeoSlug(genre)}`;
export const albumPath = (album: Partial<Album> & { id?: string }) => `/album/${album._id || album.id || toSeoSlug(album.title)}`;
export const playlistPath = (playlist: Partial<Playlist> & { id?: string }) => `/playlist/${playlist._id || playlist.id || toSeoSlug(playlist.name)}`;

export const generateSongSEO = (song: Song) => ({
  title: `${song.title} - ${song.artist} | Mavrixfy`,
  description: `Listen to ${song.title} by ${song.artist} on Mavrixfy. Stream high-quality music online.`,
  keywords: `${song.title}, ${song.artist}, ${song.album || ''}, listen online, music streaming India`,
  image: song.imageUrl || DEFAULT_SOCIAL_IMAGE,
  url: `${SITE_URL}${songPath(song)}`,
  type: 'music.song' as const,
  schema: {
    "@context": "https://schema.org",
    "@type": "MusicRecording",
    "name": song.title,
    "byArtist": {
      "@type": "MusicGroup",
      "name": song.artist
    },
    "duration": `PT${Math.floor(song.duration / 60)}M${song.duration % 60}S`,
    "genre": (song as any).genre,
    "datePublished": (song as any).year || song.createdAt,
    "inAlbum": song.album ? {
      "@type": "MusicAlbum",
      "name": song.album
    } : undefined,
    "image": song.imageUrl,
    "url": `${SITE_URL}${songPath(song)}`
  }
});

export const generateAlbumSEO = (album: Album) => ({
  title: `${album.title} - ${album.artist} | Mavrixfy`,
  description: `Listen to ${album.title} by ${album.artist} on Mavrixfy. Full album streaming with ${album.songs?.length || 0} tracks.`,
  keywords: `${album.title}, ${album.artist}, album, music streaming, full album`,
  image: album.imageUrl || DEFAULT_SOCIAL_IMAGE,
  url: `${SITE_URL}${albumPath(album)}`,
  type: 'music.album' as const,
  schema: {
    "@context": "https://schema.org",
    "@type": "MusicAlbum",
    "name": album.title,
    "byArtist": {
      "@type": "MusicGroup",
      "name": album.artist
    },
    "numTracks": album.songs?.length || 0,
    "image": album.imageUrl,
    "url": `${SITE_URL}${albumPath(album)}`,
    "datePublished": album.releaseYear
  }
});

export const generatePlaylistSEO = (playlist: Playlist) => ({
  title: `${playlist.name} - Playlist | Mavrixfy`,
  description: `Listen to ${playlist.name} playlist on Mavrixfy. ${playlist.songs?.length || 0} songs curated for you.`,
  keywords: `${playlist.name}, playlist, music collection, curated music, streaming`,
  image: playlist.imageUrl || DEFAULT_SOCIAL_IMAGE,
  url: `${SITE_URL}${playlistPath(playlist)}`,
  type: 'music.playlist' as const,
  schema: {
    "@context": "https://schema.org",
    "@type": "MusicPlaylist",
    "name": playlist.name,
    "description": playlist.description,
    "numTracks": playlist.songs?.length || 0,
    "image": playlist.imageUrl,
    "url": `${SITE_URL}${playlistPath(playlist)}`,
    "track": playlist.songs?.slice(0, 20).map((song, index) => ({
      "@type": "MusicRecording",
      "position": index + 1,
      "name": song.title,
      "byArtist": {
        "@type": "MusicGroup",
        "name": song.artist
      },
      "url": `${SITE_URL}${songPath(song)}`
    }))
  }
});

export const generateArtistSEO = (artistName: string, songs: Array<Partial<Song>> = []) => ({
  title: `${artistName} Songs, Playlists & Albums | Mavrixfy`,
  description: `Listen to ${artistName} songs, trending tracks, playlists and artist radio on Mavrixfy.`,
  keywords: `${artistName}, ${artistName} songs, ${artistName} playlist, music streaming`,
  image: (songs.find(song => song.imageUrl)?.imageUrl as string | undefined) || DEFAULT_SOCIAL_IMAGE,
  url: `${SITE_URL}${artistPath(artistName)}`,
  type: 'website' as const,
  schema: {
    "@context": "https://schema.org",
    "@type": "MusicGroup",
    "name": artistName,
    "url": `${SITE_URL}${artistPath(artistName)}`,
    "track": songs.slice(0, 10).map(song => ({
      "@type": "MusicRecording",
      "name": song.title,
      "url": `${SITE_URL}${songPath(song)}`
    }))
  }
});

export const generateCollectionSEO = ({
  title,
  description,
  path,
  keywords,
  image = DEFAULT_SOCIAL_IMAGE,
  schemaType = 'CollectionPage',
}: {
  title: string;
  description: string;
  path: string;
  keywords?: string;
  image?: string;
  schemaType?: 'CollectionPage' | 'Blog' | 'SearchResultsPage';
}) => ({
  title,
  description,
  keywords,
  image,
  url: `${SITE_URL}${path}`,
  type: 'website' as const,
  schema: {
    "@context": "https://schema.org",
    "@type": schemaType,
    "name": title,
    "description": description,
    "url": `${SITE_URL}${path}`
  }
});

export const generateBreadcrumbSchema = (items: Array<{ name: string; url: string }>) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": items.map((item, index) => ({
    "@type": "ListItem",
    "position": index + 1,
    "name": item.name,
    "item": item.url
  }))
});

export const generateOrganizationSchema = () => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Mavrixfy",
  "url": SITE_URL,
  "logo": DEFAULT_SOCIAL_IMAGE,
  "description": "Stream millions of songs online with Mavrixfy. Create playlists, discover new music, and enjoy high-quality streaming.",
  "sameAs": [
    "https://twitter.com/mavrixfy",
    "https://facebook.com/mavrixfy",
    "https://instagram.com/mavrixfy"
  ],
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "Customer Support",
    "email": "support@mavrixfy.site"
  }
});
