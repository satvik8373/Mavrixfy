/**
 * Utility for dynamically updating meta tags for SEO and social sharing
 */

interface MetaTagsConfig {
  title: string;
  description: string;
  image?: string;
  url?: string;
  type?: 'website' | 'music.song' | 'music.playlist' | 'music.album';
  keywords?: string;
  schema?: Record<string, unknown> | Array<Record<string, unknown>>;
  alternates?: Array<{ hrefLang: string; href: string }>;
}

const SITE_NAME = 'Mavrixfy';
const DEFAULT_IMAGE = 'https://mavrixfy.site/mavrixfy.png';

const cleanSchema = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(cleanSchema).filter(item => item !== undefined);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined && entry !== null && entry !== '')
        .map(([key, entry]) => [key, cleanSchema(entry)])
    );
  }

  return value;
};

export const updateMetaTags = (config: MetaTagsConfig) => {
  const {
    title,
    description,
    image = DEFAULT_IMAGE,
    url = window.location.href,
    type = 'website',
    keywords,
    schema,
    alternates = []
  } = config;

  // Update document title
  document.title = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;

  // Helper to update or create meta tag
  const setMetaTag = (property: string, content: string, isName = false) => {
    const attribute = isName ? 'name' : 'property';
    let element = document.querySelector(`meta[${attribute}="${property}"]`);
    
    if (!element) {
      element = document.createElement('meta');
      element.setAttribute(attribute, property);
      document.head.appendChild(element);
    }
    
    element.setAttribute('content', content);
  };

  // Update basic meta tags
  setMetaTag('description', description, true);
  if (keywords) {
    setMetaTag('keywords', keywords, true);
  }
  
  // Update Open Graph tags
  setMetaTag('og:type', type);
  setMetaTag('og:url', url);
  setMetaTag('og:title', title);
  setMetaTag('og:description', description);
  setMetaTag('og:image', image);
  setMetaTag('og:site_name', SITE_NAME);
  
  // Update Twitter Card tags
  setMetaTag('twitter:card', 'summary_large_image', true);
  setMetaTag('twitter:url', url, true);
  setMetaTag('twitter:title', title, true);
  setMetaTag('twitter:description', description, true);
  setMetaTag('twitter:image', image, true);
  
  // Update canonical URL
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  canonical.setAttribute('href', url);

  document.querySelectorAll('link[data-mavrixfy-alternate="true"]').forEach(element => element.remove());
  alternates.forEach(({ hrefLang, href }) => {
    const link = document.createElement('link');
    link.setAttribute('rel', 'alternate');
    link.setAttribute('hreflang', hrefLang);
    link.setAttribute('href', href);
    link.setAttribute('data-mavrixfy-alternate', 'true');
    document.head.appendChild(link);
  });

  document.querySelectorAll('script[data-mavrixfy-jsonld="true"]').forEach(element => element.remove());
  if (schema) {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-mavrixfy-jsonld', 'true');
    script.textContent = JSON.stringify(cleanSchema(schema));
    document.head.appendChild(script);
  }
};

// Preset configurations for common pages
export const metaPresets = {
  song: (title: string, artist: string, imageUrl?: string) => ({
    title: `${title} - ${artist}`,
    description: `Listen to "${title}" by ${artist} on Mavrixfy. Stream for free with high quality audio.`,
    image: imageUrl,
    type: 'music.song' as const
  }),
  
  playlist: (name: string, songCount: number, creator: string, imageUrl?: string) => ({
    title: name,
    description: `${name} playlist with ${songCount} songs curated by ${creator}. Listen on Mavrixfy for free.`,
    image: imageUrl,
    type: 'music.playlist' as const
  }),
  
  album: (name: string, artist: string, imageUrl?: string) => ({
    title: `${name} - ${artist}`,
    description: `Listen to ${name} by ${artist} on Mavrixfy. Stream the full album for free.`,
    image: imageUrl,
    type: 'music.album' as const
  }),
  
  home: () => ({
    title: 'Mavrixfy - Free Music Streaming Platform',
    description: 'Discover, play and share your favorite songs. Stream millions of tracks for free with Mavrixfy.',
    type: 'website' as const
  }),
  
  search: (query: string) => ({
    title: `Search: ${query}`,
    description: `Search results for "${query}" on Mavrixfy. Find songs, artists, albums and playlists.`,
    type: 'website' as const
  })
};
