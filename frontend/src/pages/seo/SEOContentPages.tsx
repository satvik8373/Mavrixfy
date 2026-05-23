import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Music, Search, TrendingUp } from 'lucide-react';
import { runSmartSearch, SmartSearchSong } from '@/services/smartSearchService';
import jioSaavnService, { JioSaavnPlaylist, PLAYLIST_CATEGORIES } from '@/services/jioSaavnService';
import { updateMetaTags } from '@/utils/metaTags';
import {
  artistPath,
  DEFAULT_SOCIAL_IMAGE,
  generateArtistSEO,
  generateBreadcrumbSchema,
  generateCollectionSEO,
  genrePath,
  SITE_URL,
  songPath,
  toSeoSlug,
} from '@/utils/seoHelpers';

const titleFromSlug = (slug?: string) =>
  (slug || 'music')
    .split('-')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const popularArtists = ['Arijit Singh', 'Shreya Ghoshal', 'AP Dhillon', 'Diljit Dosanjh', 'Ed Sheeran', 'Taylor Swift'];
const popularGenres = ['Bollywood', 'Hindi', 'Gujarati', 'Punjabi', 'Lofi', 'Workout', 'Romantic', 'Devotional'];
const blogPosts = [
  {
    slug: 'top-gym-songs-2026',
    title: 'Top Gym Songs 2026',
    description: 'High-energy workout songs, Indian pop, hip-hop and electronic picks for gym sessions.',
    query: 'workout gym songs 2026',
  },
  {
    slug: 'best-gujarati-songs',
    title: 'Best Gujarati Songs',
    description: 'Gujarati songs for garba, road trips, romance and everyday listening.',
    query: 'best gujarati songs',
  },
  {
    slug: 'trending-instagram-reels-songs',
    title: 'Trending Instagram Reels Songs',
    description: 'Viral songs and hooks people are discovering through Reels and Shorts.',
    query: 'instagram reels trending songs 2026',
  },
];

function SongList({ songs }: { songs: SmartSearchSong[] }) {
  if (songs.length === 0) {
    return <p className="text-sm text-white/45">Fresh results are loading. Try search for more music.</p>;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {songs.slice(0, 12).map(song => (
        <Link
          key={song.id}
          to={songPath({ _id: song.id, title: song.title, artist: song.artist })}
          className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3 transition hover:bg-white/[0.06]"
        >
          <img
            src={song.imageUrl || DEFAULT_SOCIAL_IMAGE}
            alt={song.title}
            className="h-14 w-14 rounded object-cover"
            loading="lazy"
          />
          <span className="min-w-0">
            <span className="block truncate font-medium text-white">{song.title}</span>
            <span className="block truncate text-sm text-white/50">{song.artist}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

function PlaylistList({ playlists }: { playlists: JioSaavnPlaylist[] }) {
  if (playlists.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {playlists.slice(0, 9).map(playlist => (
        <Link
          key={playlist.id}
          to={`/jiosaavn/playlist/${playlist.id}`}
          className="rounded-lg border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.06]"
        >
          <img
            src={jioSaavnService.getBestImageUrl(playlist.image)}
            alt={playlist.name}
            className="mb-3 aspect-square w-full rounded object-cover"
            loading="lazy"
          />
          <span className="block font-medium text-white">{playlist.name}</span>
          <span className="mt-1 block text-sm text-white/50">{playlist.songCount} songs</span>
        </Link>
      ))}
    </div>
  );
}

function PageShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#101010] text-white">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        <div className="mb-8">
          <p className="mb-2 flex items-center gap-2 text-sm font-medium text-green-400">
            <Music className="h-4 w-4" />
            Mavrixfy discovery
          </p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">{title}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/55 md:text-base">{description}</p>
        </div>
        {children}
      </div>
    </main>
  );
}

export function SongsIndexPage() {
  useEffect(() => {
    const seo = generateCollectionSEO({
      title: 'Songs to Stream Online | Mavrixfy',
      description: 'Discover trending songs, artists, genres and playlists on Mavrixfy.',
      path: '/songs',
      keywords: 'songs, music streaming, Hindi songs, Gujarati songs, Bollywood songs',
    });
    updateMetaTags({
      ...seo,
      schema: [
        seo.schema,
        generateBreadcrumbSchema([
          { name: 'Home', url: SITE_URL },
          { name: 'Songs', url: `${SITE_URL}/songs` },
        ]),
      ],
    });
  }, []);

  return (
    <PageShell title="Songs" description="Searchable music pages for trending songs, regional genres, artists and playlists.">
      <section className="grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="mb-3 text-xl font-semibold">Popular artists</h2>
          <div className="flex flex-wrap gap-2">
            {popularArtists.map(artist => (
              <Link key={artist} to={artistPath(artist)} className="rounded-full bg-white/10 px-4 py-2 text-sm hover:bg-white/15">
                {artist}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <h2 className="mb-3 text-xl font-semibold">Genres and moods</h2>
          <div className="flex flex-wrap gap-2">
            {popularGenres.map(genre => (
              <Link key={genre} to={genrePath(genre)} className="rounded-full bg-white/10 px-4 py-2 text-sm hover:bg-white/15">
                {genre}
              </Link>
            ))}
          </div>
        </div>
      </section>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/trending" className="inline-flex items-center gap-2 rounded-lg bg-green-500 px-4 py-2 font-medium text-black">
          <TrendingUp className="h-4 w-4" />
          Trending now
        </Link>
        <Link to="/search" className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 font-medium hover:bg-white/15">
          <Search className="h-4 w-4" />
          Search music
        </Link>
      </div>
    </PageShell>
  );
}

export function PlaylistsIndexPage() {
  const [playlists, setPlaylists] = useState<JioSaavnPlaylist[]>([]);

  useEffect(() => {
    const seo = generateCollectionSEO({
      title: 'Music Playlists | Mavrixfy',
      description: 'Browse mood playlists, trending playlists, workout mixes, romantic songs and regional collections.',
      path: '/playlists',
      keywords: 'music playlists, Hindi playlists, workout playlist, lofi playlist, Gujarati playlist',
    });
    updateMetaTags({ ...seo, schema: seo.schema });
    jioSaavnService.get2026TrendingPlaylists().then(setPlaylists).catch(() => setPlaylists([]));
  }, []);

  return (
    <PageShell title="Playlists" description="Shareable playlists for moods, genres, workouts, late nights and Indian music discovery.">
      <PlaylistList playlists={playlists} />
    </PageShell>
  );
}

export function TrendingPage() {
  const [songs, setSongs] = useState<SmartSearchSong[]>([]);
  const [playlists, setPlaylists] = useState<JioSaavnPlaylist[]>([]);

  useEffect(() => {
    const seo = generateCollectionSEO({
      title: 'Trending Songs 2026 | Mavrixfy',
      description: 'Listen to trending songs, viral playlist picks and current Indian music charts on Mavrixfy.',
      path: '/trending',
      keywords: 'trending songs 2026, viral songs, Bollywood trending songs, Instagram reels songs',
    });
    updateMetaTags({ ...seo, schema: seo.schema });
    runSmartSearch('trending songs 2026').then(result => setSongs([result.topResult, ...result.results].filter(Boolean))).catch(() => setSongs([]));
    jioSaavnService.get2026TrendingPlaylists().then(setPlaylists).catch(() => setPlaylists([]));
  }, []);

  return (
    <PageShell title="Trending Songs" description="Fresh viral songs, chart playlists and short-video music discovery for 2026.">
      <div className="space-y-8">
        <SongList songs={songs} />
        <PlaylistList playlists={playlists} />
      </div>
    </PageShell>
  );
}

export function ArtistPage() {
  const { slug } = useParams<{ slug: string }>();
  const artist = titleFromSlug(slug);
  const [songs, setSongs] = useState<SmartSearchSong[]>([]);

  useEffect(() => {
    runSmartSearch(`${artist} songs`).then(result => {
      const nextSongs = [result.topResult, ...result.results, ...result.similarSongs].filter(Boolean);
      setSongs(nextSongs);
      const seo = generateArtistSEO(artist, nextSongs.map(song => ({
        _id: song.id,
        title: song.title,
        artist: song.artist,
        imageUrl: song.imageUrl,
      })));
      updateMetaTags({
        ...seo,
        schema: [
          seo.schema,
          generateBreadcrumbSchema([
            { name: 'Home', url: SITE_URL },
            { name: 'Artists', url: `${SITE_URL}/songs` },
            { name: artist, url: seo.url },
          ]),
        ],
      });
    }).catch(() => {
      const seo = generateArtistSEO(artist);
      updateMetaTags({ ...seo, schema: seo.schema });
    });
  }, [artist]);

  return (
    <PageShell title={`${artist} Songs`} description={`Listen to ${artist} songs, related playlists, similar artists and trending tracks on Mavrixfy.`}>
      <SongList songs={songs} />
    </PageShell>
  );
}

export function GenrePage() {
  const { slug } = useParams<{ slug: string }>();
  const genre = titleFromSlug(slug);
  const [songs, setSongs] = useState<SmartSearchSong[]>([]);

  useEffect(() => {
    const path = genrePath(genre);
    const seo = generateCollectionSEO({
      title: `${genre} Songs & Playlists | Mavrixfy`,
      description: `Discover ${genre} songs, artists, playlists and moods on Mavrixfy.`,
      path,
      keywords: `${genre} songs, ${genre} playlist, music streaming`,
    });
    updateMetaTags({ ...seo, schema: seo.schema });
    runSmartSearch(`${genre} songs`).then(result => setSongs([result.topResult, ...result.results, ...result.similarSongs].filter(Boolean))).catch(() => setSongs([]));
  }, [genre]);

  return (
    <PageShell title={`${genre} Music`} description={`A searchable collection of ${genre} songs, playlists, artists and moods.`}>
      <SongList songs={songs} />
    </PageShell>
  );
}

export function BlogIndexPage() {
  useEffect(() => {
    const seo = generateCollectionSEO({
      title: 'Music Discovery Blog | Mavrixfy',
      description: 'Guides to trending songs, regional music, mood playlists and playlist discovery.',
      path: '/blog',
      schemaType: 'Blog',
    });
    updateMetaTags({ ...seo, schema: seo.schema });
  }, []);

  return (
    <PageShell title="Blog" description="Music discovery guides built around trending searches and playlist intent.">
      <div className="grid gap-4 md:grid-cols-3">
        {blogPosts.map(post => (
          <Link key={post.slug} to={`/blog/${post.slug}`} className="rounded-lg border border-white/10 bg-white/[0.03] p-5 hover:bg-white/[0.06]">
            <h2 className="text-xl font-semibold">{post.title}</h2>
            <p className="mt-3 text-sm leading-6 text-white/55">{post.description}</p>
          </Link>
        ))}
      </div>
    </PageShell>
  );
}

export function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const post = useMemo(() => blogPosts.find(item => item.slug === slug) || {
    slug: slug || 'music-discovery',
    title: titleFromSlug(slug),
    description: `Discover ${titleFromSlug(slug).toLowerCase()} on Mavrixfy.`,
    query: titleFromSlug(slug),
  }, [slug]);
  const [songs, setSongs] = useState<SmartSearchSong[]>([]);

  useEffect(() => {
    const path = `/blog/${toSeoSlug(post.slug)}`;
    const seo = generateCollectionSEO({
      title: `${post.title} | Mavrixfy Blog`,
      description: post.description,
      path,
      schemaType: 'Blog',
    });
    updateMetaTags({ ...seo, schema: seo.schema });
    runSmartSearch(post.query).then(result => setSongs([result.topResult, ...result.results].filter(Boolean))).catch(() => setSongs([]));
  }, [post]);

  return (
    <PageShell title={post.title} description={post.description}>
      <div className="mb-8 max-w-3xl space-y-4 text-sm leading-6 text-white/60">
        <p>
          Use this guide as a starting point for discovery, then open any song or playlist to save,
          share and continue exploring related artists and genres.
        </p>
        <p>
          Mavrixfy updates discovery results from live search signals, so these picks can shift as
          listeners move between reels songs, regional hits and mood playlists.
        </p>
      </div>
      <SongList songs={songs} />
    </PageShell>
  );
}

export function CategoryGenreRedirectPage() {
  const { category } = useParams<{ category: string }>();
  const knownCategory = PLAYLIST_CATEGORIES.find(item => item.id === category);
  return <GenrePage key={knownCategory?.id || category} />;
}
