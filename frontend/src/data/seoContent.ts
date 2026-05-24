export interface SeoPlaylist {
  slug: string;
  title: string;
  description: string;
  mood: string;
  genres: string[];
  artists: string[];
  tags: string[];
  relatedPlaylists: string[];
  searchQuery: string;
}

export interface SeoTrendingTopic {
  slug: string;
  title: string;
  description: string;
  keywords: string;
  query: string;
  tags: string[];
  relatedGenres: string[];
}

export interface SeoBlogPost {
  slug: string;
  title: string;
  description: string;
  query: string;
  sections: Array<{
    heading: string;
    body: string;
  }>;
}

export const seoPlaylists: SeoPlaylist[] = [
  {
    slug: 'gym-workout-hits',
    title: 'Gym Workout Hits',
    description: 'High-energy Hindi, Punjabi, pop and hip-hop songs for lifting, cardio and focused workout sessions.',
    mood: 'Energetic, focused, motivational',
    genres: ['Workout', 'Hindi', 'Punjabi', 'Hip-Hop', 'Pop'],
    artists: ['AP Dhillon', 'Diljit Dosanjh', 'Arijit Singh', 'Badshah', 'King'],
    tags: ['best hindi workout songs', 'gym playlist', 'running songs', 'workout music'],
    relatedPlaylists: ['late-night-drive', 'viral-instagram-songs', 'study-lofi-music'],
    searchQuery: 'best hindi workout songs gym playlist',
  },
  {
    slug: 'late-night-drive',
    title: 'Late Night Drive',
    description: 'Smooth songs for night drives, highway listening, city rides and relaxed after-hours playlists.',
    mood: 'Chill, cinematic, reflective',
    genres: ['Lofi', 'Romantic', 'Indie', 'Bollywood', 'Pop'],
    artists: ['Arijit Singh', 'Prateek Kuhad', 'Anuv Jain', 'The Local Train', 'Taylor Swift'],
    tags: ['late night drive playlist', 'night drive songs', 'chill hindi songs', 'road trip music'],
    relatedPlaylists: ['gym-workout-hits', 'viral-instagram-songs', 'study-lofi-music'],
    searchQuery: 'late night drive playlist hindi songs',
  },
  {
    slug: 'viral-instagram-songs',
    title: 'Viral Instagram Songs',
    description: 'Trending Reels songs, viral hooks and short-video tracks people are searching for right now.',
    mood: 'Viral, upbeat, catchy',
    genres: ['Reels', 'Bollywood', 'Hindi', 'Pop', 'Dance'],
    artists: ['Arijit Singh', 'Shreya Ghoshal', 'Diljit Dosanjh', 'Badshah', 'King'],
    tags: ['viral instagram songs', 'reels songs', 'trending reels songs', 'instagram music'],
    relatedPlaylists: ['gym-workout-hits', 'late-night-drive', 'best-gujarati-playlist'],
    searchQuery: 'viral instagram reels songs',
  },
  {
    slug: 'best-gujarati-playlist',
    title: 'Best Gujarati Playlist',
    description: 'Gujarati songs for garba, romance, road trips and everyday regional music discovery.',
    mood: 'Festive, regional, joyful',
    genres: ['Gujarati', 'Garba', 'Folk', 'Regional', 'Romantic'],
    artists: ['Aditya Gadhvi', 'Aishwarya Majmudar', 'Kinjal Dave', 'Kirtidan Gadhvi'],
    tags: ['best gujarati playlist', 'gujarati songs', 'garba songs', 'regional hits'],
    relatedPlaylists: ['viral-instagram-songs', 'late-night-drive', 'gym-workout-hits'],
    searchQuery: 'best gujarati songs playlist',
  },
  {
    slug: 'study-lofi-music',
    title: 'Study Lofi Music',
    description: 'Soft lofi, calm focus tracks and low-distraction music for studying, coding and reading.',
    mood: 'Calm, focused, minimal',
    genres: ['Lofi', 'Study', 'Chill', 'Instrumental', 'Focus'],
    artists: ['Lofi Girl', 'Anuv Jain', 'Prateek Kuhad', 'Pritam'],
    tags: ['study lofi music', 'focus playlist', 'lofi hindi songs', 'study music'],
    relatedPlaylists: ['late-night-drive', 'gym-workout-hits', 'viral-instagram-songs'],
    searchQuery: 'study lofi music playlist',
  },
];

export const seoTrendingTopics: SeoTrendingTopic[] = [
  {
    slug: 'hindi',
    title: 'Trending Hindi Songs',
    description: 'Current Hindi songs, Bollywood hits and Indian pop tracks gaining listener attention.',
    keywords: 'trending hindi songs, Bollywood trending songs, new Hindi songs',
    query: 'trending hindi songs',
    tags: ['trending hindi songs', 'bollywood hits', 'new hindi music'],
    relatedGenres: ['Hindi', 'Bollywood', 'Romantic', 'Punjabi'],
  },
  {
    slug: 'reels',
    title: 'Viral Reels Songs',
    description: 'Instagram Reels songs, viral hooks and short-video music people are searching for.',
    keywords: 'viral reels songs, instagram songs, trending reels music',
    query: 'viral reels songs instagram',
    tags: ['viral reels songs', 'instagram music', 'short video songs'],
    relatedGenres: ['Reels', 'Pop', 'Dance', 'Hindi'],
  },
  {
    slug: 'gujarati',
    title: 'Trending Gujarati Songs',
    description: 'Fresh Gujarati hits, garba favorites and regional songs for Gujarati music discovery.',
    keywords: 'trending gujarati songs, best gujarati playlist, garba songs',
    query: 'trending gujarati songs',
    tags: ['trending gujarati songs', 'garba music', 'regional hits'],
    relatedGenres: ['Gujarati', 'Garba', 'Regional', 'Folk'],
  },
];

export const seoBlogPosts: SeoBlogPost[] = [
  {
    slug: 'best-gym-songs',
    title: 'Best Gym Songs for High Energy Workouts',
    description: 'A practical guide to workout music for lifting, cardio, running and high-focus gym sessions.',
    query: 'best hindi workout songs gym playlist',
    sections: [
      {
        heading: 'Build energy quickly',
        body: 'Start with punchy hooks and steady beats so the playlist feels active from the first song.',
      },
      {
        heading: 'Mix Hindi, Punjabi and pop',
        body: 'Workout searches often blend Bollywood, Punjabi pop, hip-hop and viral songs, so variety helps discovery.',
      },
    ],
  },
  {
    slug: 'top-study-music',
    title: 'Top Study Music for Focus and Deep Work',
    description: 'Calm lofi, soft indie and low-distraction playlists for studying, coding and reading.',
    query: 'study lofi music focus playlist',
    sections: [
      {
        heading: 'Keep vocals light',
        body: 'Study playlists work best when songs stay calm, predictable and easy to keep in the background.',
      },
      {
        heading: 'Use mood-based discovery',
        body: 'Searches like study lofi music and focus playlist match intent better than broad streaming keywords.',
      },
    ],
  },
  {
    slug: 'best-gujarati-playlist',
    title: 'Best Gujarati Playlist for Garba, Travel and Daily Listening',
    description: 'Gujarati songs and regional playlists for garba nights, road trips, celebrations and everyday listening.',
    query: 'best gujarati songs playlist',
    sections: [
      {
        heading: 'Cover regional intent',
        body: 'Gujarati listeners often search by occasion, so include garba, romance, travel and trending regional hits.',
      },
      {
        heading: 'Connect songs to artists',
        body: 'Artist links help listeners move from one song into a broader Gujarati music discovery path.',
      },
    ],
  },
  {
    slug: 'trending-instagram-reels-songs',
    title: 'Trending Instagram Reels Songs',
    description: 'Viral songs and hooks people are discovering through Reels and short videos.',
    query: 'instagram reels trending songs',
    sections: [
      {
        heading: 'Track viral hooks',
        body: 'Short-video discovery changes quickly, so refresh Reels pages and playlists often.',
      },
      {
        heading: 'Link to full songs',
        body: 'People often remember the hook first, then search for the complete song and artist.',
      },
    ],
  },
];

export const getSeoPlaylist = (slug?: string) =>
  seoPlaylists.find(playlist => playlist.slug === slug);

export const getSeoTrendingTopic = (slug?: string) =>
  seoTrendingTopics.find(topic => topic.slug === slug);

export const getSeoBlogPost = (slug?: string) =>
  seoBlogPosts.find(post => post.slug === slug);
