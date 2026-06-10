import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';
import { PwaRegister } from '@/components/PwaRegister';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Mavrixfy Admin - Control Center',
  description: 'Admin dashboard for managing Mavrixfy music streaming platform',
  applicationName: 'Mavrixfy Admin',
  robots: 'noindex, nofollow',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Mavrixfy Admin',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/admin-mark.svg', type: 'image/svg+xml' },
      { url: '/admin-icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/admin-icon-512.png', sizes: '512x512', type: 'image/png' },
      { url: '/favicon.ico' },
    ],
    shortcut: '/admin-mark.svg',
    apple: '/admin-apple-touch-icon.png',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  themeColor: '#020617',
  colorScheme: 'light',
  viewportFit: 'cover',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={inter.className}>
        <PwaRegister />
        {children}
        <Toaster position="top-right" theme="dark" richColors />
      </body>
    </html>
  );
}
