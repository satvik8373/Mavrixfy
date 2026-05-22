import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Mavrixfy Admin',
    short_name: 'Admin',
    description: 'Admin control center for Mavrixfy.',
    id: '/?source=pwa',
    start_url: '/dashboard?source=pwa',
    scope: '/',
    display: 'standalone',
    display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
    background_color: '#f8fafc',
    theme_color: '#020617',
    orientation: 'portrait',
    categories: ['productivity', 'music'],
    icons: [
      {
        src: '/admin-icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/admin-icon-maskable-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/admin-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/admin-icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Dashboard',
        short_name: 'Dashboard',
        url: '/dashboard',
        icons: [{ src: '/admin-icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Songs',
        short_name: 'Songs',
        url: '/dashboard/songs',
        icons: [{ src: '/admin-icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
  };
}
