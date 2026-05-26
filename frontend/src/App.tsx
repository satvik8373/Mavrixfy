import { RouterProvider, createBrowserRouter, Navigate, useLocation, useRouteError } from 'react-router-dom';
import { Suspense, lazy, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { performanceService } from './services/performanceService';
import { startRecommendationSessionTracking } from './services/recommendationService';
import { audioManager } from './utils/audioManager';

import { clearAuthRedirectState } from './utils/clearAuthRedirectState';
import { cleanupOfflineData } from './utils/cleanupOfflineData';

// Only preload absolute structural components
import MainLayout from './layout/MainLayout';

// Lazy load core pages to drastically cut initial JS payload
const HomePage = lazy(() => import('./pages/home/HomePage'));
const SearchPage = lazy(() => import('./pages/search/SearchPage'));
const LibraryPage = lazy(() => import('./pages/LibraryPage'));
const LikedSongsPage = lazy(() => import('./pages/liked-songs/LikedSongsPage'));
const LikedSongsImportPage = lazy(() => import('./pages/liked-songs/LikedSongsImportPage'));
const SongsIndexPage = lazy(() => import('./pages/seo/SEOContentPages').then(m => ({ default: m.SongsIndexPage })));
const PlaylistsIndexPage = lazy(() => import('./pages/seo/SEOContentPages').then(m => ({ default: m.PlaylistsIndexPage })));
const ArtistPage = lazy(() => import('./pages/seo/SEOContentPages').then(m => ({ default: m.ArtistPage })));
const GenrePage = lazy(() => import('./pages/seo/SEOContentPages').then(m => ({ default: m.GenrePage })));
const TrendingPage = lazy(() => import('./pages/seo/SEOContentPages').then(m => ({ default: m.TrendingPage })));
const BlogIndexPage = lazy(() => import('./pages/seo/SEOContentPages').then(m => ({ default: m.BlogIndexPage })));
const BlogPostPage = lazy(() => import('./pages/seo/SEOContentPages').then(m => ({ default: m.BlogPostPage })));

// Lazy load less critical pages only
const AlbumPage = lazy(() => import('./pages/album/AlbumPage'));
const PlaylistPage = lazy(() => import('./pages/playlist/PlaylistPage').then(m => ({ default: m.PlaylistPage })));
const SongPage = lazy(() => import('./pages/song/SongPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const About = lazy(() => import('./pages/About'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const AccountDeletion = lazy(() => import('./pages/AccountDeletion'));

// AI Mood Playlist page
const MoodHistoryPage = lazy(() => import('./pages/mood-history/MoodHistoryPage'));
const MoodPlaylistPage = lazy(() => import('./pages/MoodPlaylistPage'));

// JioSaavn pages
const JioSaavnPlaylistPage = lazy(() => import('./pages/jiosaavn/JioSaavnPlaylistPage'));
const JioSaavnPlaylistsPage = lazy(() => import('./pages/jiosaavn/JioSaavnPlaylistsPage'));
const JioSaavnCategoriesPage = lazy(() => import('./pages/jiosaavn/JioSaavnCategoriesPage'));

// Embed page
const EmbedPlaylistPage = lazy(() => import('./pages/embed/EmbedPlaylistPage'));

import { AuthProvider, useAuth } from './contexts/AuthContext';

const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
import PWAInstallPrompt from './components/PWAInstallPrompt';

const CHUNK_RECOVERY_KEY = 'mavrixfy_chunk_recovery_done';

const isChunkLoadLikeError = (error?: Error) => {
	const message = `${error?.message ?? ''}`;
	return /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(message);
};

const performHardRefresh = async () => {
	try {
		if ('serviceWorker' in navigator) {
			const registrations = await navigator.serviceWorker.getRegistrations();
			await Promise.all(registrations.map((registration) => registration.unregister().catch(() => undefined)));
		}
	} catch {
		// Ignore cleanup errors and continue with refresh.
	}

	try {
		if ('caches' in window) {
			const cacheKeys = await caches.keys();
			await Promise.all(cacheKeys.map((key) => caches.delete(key).catch(() => false)));
		}
	} catch {
		// Ignore cleanup errors and continue with refresh.
	}

	const separator = window.location.href.includes('?') ? '&' : '?';
	window.location.replace(`${window.location.href}${separator}refresh=${Date.now()}`);
};



// Simple fallback pages for routes with import issues
const NotFoundFallback = () => (
	<div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
		<div className="text-center max-w-md">
			<h1 className="text-9xl font-semibold text-primary mb-6">404</h1>
			<h2 className="text-2xl font-semibold mb-4 text-foreground">Page Not Found</h2>
			<p className="text-muted-foreground mb-8">
				The page you're looking for doesn't exist or has been moved.
			</p>
		</div>
	</div>
);

// Error page for when something goes wrong
const ErrorFallback = () => {
	const routeError = useRouteError();
	const error = routeError instanceof Error ? routeError : undefined;

	useEffect(() => {
		if (!isChunkLoadLikeError(error)) {
			sessionStorage.removeItem(CHUNK_RECOVERY_KEY);
			return;
		}
		if (sessionStorage.getItem(CHUNK_RECOVERY_KEY)) return;

		sessionStorage.setItem(CHUNK_RECOVERY_KEY, '1');
		void performHardRefresh();
	}, [error]);

	return (
		<div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
			<div className="text-center max-w-md">
				<h1 className="text-4xl font-semibold mb-4 text-foreground">Something went wrong</h1>
				<p className="text-muted-foreground mb-8">
					We're sorry, but there was an error loading this page. Please try refreshing.
				</p>
				{error && (
					<details className="text-left bg-card p-4 rounded-lg mb-4">
						<summary className="cursor-pointer text-sm text-muted-foreground mb-2">
							Error Details
						</summary>
						<pre className="text-xs text-red-500 overflow-auto">
							{error.message}
						</pre>
					</details>
				)}
				<button type="button"
					onClick={() => { void performHardRefresh(); }}
					className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
				>
					Refresh App
				</button>
			</div>
		</div>
	);
};

const AuthGate = ({ children, allowGuest = false }: { children: React.ReactNode; allowGuest?: boolean }) => {
	const { isAuthenticated, loading } = useAuth();
	const location = useLocation();

	if (allowGuest) {
		return <>{children}</>;
	}

	if (loading) {
		return <div className="min-h-screen bg-[#121212]" />;
	}

	if (!isAuthenticated) {
		return <Navigate to="/login" state={{ from: location.pathname }} replace />;
	}

	return <>{children}</>;
};

const LandingRedirector = () => {
	// Always redirect to home page (removed landing page concept)
	return <Navigate to="/home" replace />;
};

// Configure the router with React Router v6
const router = createBrowserRouter(
	[
		{
			path: '/',
			element: <LandingRedirector />
		},
		{
			path: '/login',
			element: <Suspense fallback={<div className="min-h-screen bg-[#121212]" />}><Login /></Suspense>
		},
		{
			path: '/register',
			element: <Suspense fallback={<div className="min-h-screen bg-[#121212]" />}><Register /></Suspense>
		},
		{
			path: '/reset-password',
			element: <Suspense fallback={<div className="min-h-screen bg-[#121212]" />}><ResetPassword /></Suspense>
		},
		{
			path: '/verify-email',
			element: <Suspense fallback={<div className="min-h-screen bg-[#121212]" />}><VerifyEmail /></Suspense>
		},
		{
			path: '/privacy',
			element: (
				<div className="h-screen overflow-y-auto bg-[#121212]">
					<Suspense fallback={<div className="min-h-screen bg-[#121212]" />}>
						<PrivacyPolicy />
					</Suspense>
				</div>
			)
		},
		{
			path: '/terms',
			element: (
				<div className="h-screen overflow-y-auto bg-[#121212]">
					<Suspense fallback={<div className="min-h-screen bg-[#121212]" />}>
						<TermsOfService />
					</Suspense>
				</div>
			)
		},
		{
			path: '/about',
			element: (
				<div className="h-screen overflow-y-auto bg-[#121212]">
					<Suspense fallback={<div className="min-h-screen bg-[#121212]" />}>
						<About />
					</Suspense>
				</div>
			)
		},
		{
			path: '/account-deletion',
			element: (
				<div className="h-screen overflow-y-auto bg-[#121212]">
					<Suspense fallback={<div className="min-h-screen bg-[#121212]" />}>
						<AccountDeletion />
					</Suspense>
				</div>
			)
		},
		{
			path: '/embed/playlist/:id',
			element: <Suspense fallback={<div className="min-h-screen bg-[#121212]" />}><EmbedPlaylistPage /></Suspense>
		},
		{
			element: <MainLayout />,
			errorElement: <ErrorFallback />,
			children: [
				{
					path: '/home',
					element: <AuthGate allowGuest={true}><Suspense fallback={<div className="min-h-screen bg-[#121212]" />}><HomePage /></Suspense></AuthGate>
				},
				{
					path: '/albums/:albumId',
					element: <AuthGate allowGuest={true}><Suspense fallback={<div className="min-h-screen bg-[#121212]" />}><AlbumPage /></Suspense></AuthGate>
				},
				{
					path: '/library',
					element: <AuthGate><Suspense fallback={<div className="min-h-screen bg-[#121212]" />}><LibraryPage /></Suspense></AuthGate>
				},
				{
					path: '/liked-songs',
					element: <AuthGate><Suspense fallback={<div className="min-h-screen bg-[#121212]" />}><LikedSongsPage /></Suspense></AuthGate>
				},
				{
					path: '/liked-songs/import',
					element: <AuthGate><Suspense fallback={<div className="min-h-screen bg-[#121212]" />}><LikedSongsImportPage /></Suspense></AuthGate>
				},
				{
					path: '/search',
					element: <AuthGate allowGuest={true}><Suspense fallback={<div className="min-h-screen bg-[#121212]" />}><SearchPage /></Suspense></AuthGate>
				},
				{
					path: '/songs',
					element: <AuthGate allowGuest={true}><Suspense fallback={<div className="min-h-screen bg-[#121212]" />}><SongsIndexPage /></Suspense></AuthGate>
				},
				{
					path: '/playlists',
					element: <AuthGate allowGuest={true}><Suspense fallback={<div className="min-h-screen bg-[#121212]" />}><PlaylistsIndexPage /></Suspense></AuthGate>
				},
				{
					path: '/artist/:slug',
					element: <AuthGate allowGuest={true}><Suspense fallback={<div className="min-h-screen bg-[#121212]" />}><ArtistPage /></Suspense></AuthGate>
				},
				{
					path: '/genre/:slug',
					element: <AuthGate allowGuest={true}><Suspense fallback={<div className="min-h-screen bg-[#121212]" />}><GenrePage /></Suspense></AuthGate>
				},
				{
					path: '/trending',
					element: <AuthGate allowGuest={true}><Suspense fallback={<div className="min-h-screen bg-[#121212]" />}><TrendingPage /></Suspense></AuthGate>
				},
				{
					path: '/trending/:slug',
					element: <AuthGate allowGuest={true}><Suspense fallback={<div className="min-h-screen bg-[#121212]" />}><TrendingPage /></Suspense></AuthGate>
				},
				{
					path: '/blog',
					element: <AuthGate allowGuest={true}><Suspense fallback={<div className="min-h-screen bg-[#121212]" />}><BlogIndexPage /></Suspense></AuthGate>
				},
				{
					path: '/blog/:slug',
					element: <AuthGate allowGuest={true}><Suspense fallback={<div className="min-h-screen bg-[#121212]" />}><BlogPostPage /></Suspense></AuthGate>
				},
				{
					path: '/profile',
					element: <AuthGate><Suspense fallback={<div className="min-h-screen bg-[#121212]" />}><ProfilePage /></Suspense></AuthGate>
				},
				{
					path: '/playlist/:id',
					element: <AuthGate allowGuest={true}><Suspense fallback={<div className="min-h-screen bg-[#121212]" />}><PlaylistPage /></Suspense></AuthGate>
				},
				{
					path: '/song/:songId',
					element: <AuthGate allowGuest={true}><Suspense fallback={<div className="min-h-screen bg-[#121212]" />}><SongPage /></Suspense></AuthGate>
				},
				{
					path: '/album/:albumId',
					element: <AuthGate allowGuest={true}><Suspense fallback={<div className="min-h-screen bg-[#121212]" />}><AlbumPage /></Suspense></AuthGate>
				},
				{
					path: '/jiosaavn/playlist/:playlistId',
					element: <AuthGate allowGuest={true}><Suspense fallback={<div className="min-h-screen bg-[#121212]" />}><JioSaavnPlaylistPage /></Suspense></AuthGate>
				},
				{
					path: '/jiosaavn/playlists',
					element: <AuthGate allowGuest={true}><Suspense fallback={<div className="min-h-screen bg-[#121212]" />}><JioSaavnPlaylistsPage /></Suspense></AuthGate>
				},
				{
					path: '/jiosaavn/categories',
					element: <AuthGate allowGuest={true}><Suspense fallback={<div className="min-h-screen bg-[#121212]" />}><JioSaavnCategoriesPage /></Suspense></AuthGate>
				},
				{
					path: '/settings',
					element: <AuthGate allowGuest={true}><Suspense fallback={<div className="min-h-screen bg-[#121212]" />}><SettingsPage /></Suspense></AuthGate>
				},
				{
					path: '/mood-playlist',
					element: <AuthGate allowGuest={true}><Suspense fallback={<div className="min-h-screen bg-[#121212]" />}><MoodPlaylistPage /></Suspense></AuthGate>
				},
				{
					path: '/mood-history',
					element: <AuthGate allowGuest={false}><Suspense fallback={<div className="min-h-screen bg-[#121212]" />}><MoodHistoryPage /></Suspense></AuthGate>
				},
				{
					path: '*',
					element: <NotFoundFallback />
				}
			]
		}
	],
	{
		future: {
			v7_relativeSplatPath: true
		}
	}
);

function AppContent() {
	// Initialize app and release the route shell as soon as boot work is scheduled.
	useEffect(() => {
		// Clear any Firebase auth redirect state to prevent errors.
		clearAuthRedirectState();
		performanceService.addResourceHints();
		cleanupOfflineData().catch(() => { });
	}, []);

	return (
		<div className="min-h-screen bg-[#121212]">
			<RouterProvider
				router={router}
				future={{ v7_startTransition: true }}
			/>
			<Toaster
				position="bottom-center"
				toastOptions={{
					style: {
						background: '#fff',
						color: '#000',
						borderRadius: '8px',
						fontSize: '14px',
						padding: '12px 16px',
						boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
						fontWeight: '500',
					},
					success: {
						iconTheme: {
							primary: '#1ed760',
							secondary: 'white',
						},
					},
					duration: 3000,
				}}
			/>
			<PWAInstallPrompt />
		</div>
	);
}

function App() {
	useEffect(() => {
		if (!window.location.search.includes('debug_cls=true')) {
			return;
		}

		let observer: PerformanceObserver | null = null;

		try {
			observer = new PerformanceObserver((list) => {
				for (const entry of list.getEntries()) {
					const layoutShiftEntry = entry as PerformanceEntry & {
						hadRecentInput?: boolean;
						value?: number;
						sources?: Array<{ node?: Element }>;
					};
					const shiftValue = layoutShiftEntry.value ?? 0;

					if (layoutShiftEntry.hadRecentInput || shiftValue < 0.01) {
						continue;
					}

					const sourceNode = layoutShiftEntry.sources?.[0]?.node;
					const sourceClassName = sourceNode instanceof HTMLElement ? sourceNode.className : '';
					console.warn('[CLS DETECTED]', shiftValue, layoutShiftEntry.sources);

					const badge = document.createElement('div');
					badge.style.cssText = 'position:fixed;top:10px;left:10px;background:rgba(255,0,0,0.9);color:white;padding:8px;z-index:999999;font-size:12px;font-family:monospace;border-radius:4px;max-width:300px;word-break:break-all;pointer-events:none;';
					badge.innerHTML = `CLS: ${shiftValue.toFixed(4)}<br/>Node: ${sourceNode?.nodeName || 'unknown'}.${sourceClassName}`;
					document.body.appendChild(badge);
				}
			});
			observer.observe({ type: 'layout-shift', buffered: true });
		} catch (_error) {
			observer = null;
		}

		return () => {
			observer?.disconnect();
		};
	}, []);

	useEffect(() => {
		let started = false;
		const interactionEvents = ['pointerdown', 'keydown', 'touchstart'];
		const startTracking = () => {
			if (started) return;
			started = true;
			interactionEvents.forEach((eventName) => window.removeEventListener(eventName, startTracking));
			startRecommendationSessionTracking();
		};

		interactionEvents.forEach((eventName) => {
			window.addEventListener(eventName, startTracking, { once: true, passive: true });
		});

		return () => {
			interactionEvents.forEach((eventName) => window.removeEventListener(eventName, startTracking));
		};
	}, []);

	// Set CSS variable for viewport height to handle mobile browsers
	useEffect(() => {
		const setVh = () => {
			const vh = window.innerHeight * 0.01;
			document.documentElement.style.setProperty('--vh', `${vh}px`);
		};

		// Set initially and on resize
		setVh();
		window.addEventListener('resize', setVh);
		window.addEventListener('orientationchange', setVh);

		return () => {
			window.removeEventListener('resize', setVh);
			window.removeEventListener('orientationchange', setVh);
		};
	}, []);

	useEffect(() => {
		const resumeAudio = () => {
			void audioManager.resumeIfPausedUnexpectedly();
		};

		const handleVisibilityChange = () => {
			if (document.visibilityState !== 'visible') return;
			void resumeAudio();
		};

		// Resume after tab switch, screen unlock, network reconnect, or any tap
		// pointerup covers iOS PWA interruptions (calls, Siri, etc.) that
		// visibilitychange alone doesn't catch
		const handleResume = () => void resumeAudio();

		document.addEventListener('visibilitychange', handleVisibilityChange);
		window.addEventListener('focus', handleResume);
		window.addEventListener('online', handleResume);
		document.addEventListener('pointerup', handleResume, { passive: true });

		return () => {
			document.removeEventListener('visibilitychange', handleVisibilityChange);
			window.removeEventListener('focus', handleResume);
			window.removeEventListener('online', handleResume);
			document.removeEventListener('pointerup', handleResume);
		};
	}, []);

	return (
		<AuthProvider>
			<AppContent />
		</AuthProvider>
	);
}

export default App;
