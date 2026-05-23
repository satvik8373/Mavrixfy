import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const siteUrl = 'https://mavrixfy.site';
const lastmod = new Date().toISOString().slice(0, 10);
const publicDir = fileURLToPath(new URL('../public/', import.meta.url));

const sitemaps = {
  'sitemap-pages.xml': [
    ['/', 'daily', '1.0'],
    ['/home', 'daily', '1.0'],
    ['/songs', 'daily', '0.95'],
    ['/playlists', 'daily', '0.95'],
    ['/trending', 'hourly', '0.95'],
    ['/search', 'daily', '0.9'],
    ['/blog', 'weekly', '0.85'],
    ['/jiosaavn/categories', 'daily', '0.8'],
    ['/jiosaavn/playlists', 'daily', '0.8'],
    ['/mood-playlist', 'weekly', '0.75'],
    ['/about', 'monthly', '0.6'],
    ['/privacy', 'monthly', '0.4'],
    ['/terms', 'monthly', '0.4'],
  ],
  'sitemap-songs.xml': [
    ['/songs', 'daily', '0.95'],
  ],
  'sitemap-artists.xml': [
    ['/artist/arijit-singh', 'weekly', '0.9'],
    ['/artist/shreya-ghoshal', 'weekly', '0.85'],
    ['/artist/ap-dhillon', 'weekly', '0.85'],
    ['/artist/diljit-dosanjh', 'weekly', '0.85'],
    ['/artist/ed-sheeran', 'weekly', '0.8'],
    ['/artist/taylor-swift', 'weekly', '0.8'],
  ],
  'sitemap-playlists.xml': [
    ['/playlists', 'daily', '0.95'],
    ['/jiosaavn/playlists', 'daily', '0.85'],
    ['/mood-playlist', 'weekly', '0.8'],
  ],
  'sitemap-albums.xml': [
    ['/album/example-album', 'weekly', '0.6'],
  ],
  'sitemap-genres.xml': [
    ['/genre/bollywood', 'daily', '0.9'],
    ['/genre/hindi', 'daily', '0.9'],
    ['/genre/gujarati', 'daily', '0.85'],
    ['/genre/punjabi', 'daily', '0.85'],
    ['/genre/lofi', 'weekly', '0.8'],
    ['/genre/workout', 'weekly', '0.8'],
    ['/genre/romantic', 'weekly', '0.8'],
    ['/genre/devotional', 'weekly', '0.75'],
  ],
  'sitemap-blog.xml': [
    ['/blog', 'weekly', '0.85'],
    ['/blog/top-gym-songs-2026', 'monthly', '0.8'],
    ['/blog/best-gujarati-songs', 'monthly', '0.8'],
    ['/blog/trending-instagram-reels-songs', 'weekly', '0.85'],
  ],
};

const renderUrlSet = (entries) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map(([path, changefreq, priority]) => `  <url><loc>${siteUrl}${path}</loc><lastmod>${lastmod}</lastmod><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`).join('\n')}
</urlset>
`;

const renderIndex = () => `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${Object.keys(sitemaps).map(file => `  <sitemap><loc>${siteUrl}/${file}</loc><lastmod>${lastmod}</lastmod></sitemap>`).join('\n')}
</sitemapindex>
`;

for (const [file, entries] of Object.entries(sitemaps)) {
  writeFileSync(join(publicDir, file), renderUrlSet(entries));
}

writeFileSync(join(publicDir, 'sitemap.xml'), renderIndex());
