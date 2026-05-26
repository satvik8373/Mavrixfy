import { RouterProvider, createBrowserRouter, Navigate, useLocation, useRouteError } from 'react-router-dom';
import { Suspense, lazy, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { performanceService } from './services/performanceService';
import { startRecommendationSessionTracking } from './services/recommendationService';
import { audioManager } from './utils/audioManager';
import { APP_LOAD_RECOVERY_KEY, isRecoverableAppLoadError, performHardRefresh } from './utils/errorRecovery';

import { clearAuthRedirectState } from './utils/clearAuthRedirectState';
import { cleanupOfflineData } from './utils/cleanupOfflineData';

// Only preload absolute structural components
import MainLayout from './layout/MainLayout';

const lazySafe = <T extends React.ComponentType<any>>(
	importFn: () => Promise<any>,
	exportName?: string
) => {
	const createErrorModule = (error: unknown) => {
		const normalizedError = error instanceof Error ? error : new Error(String(error));
		const RouteLoadError = () => {
			throw normalizedError;
		};

		return { default: RouteLoadError as unknown as T };
	};

	return lazy(() =>
		importFn()
			.then((m) => {
				if (!m) {
					return createErrorModule(new Error('Route module loaded empty.'));
				}
				sessionStorage.removeItem('chunk_reload_attempt');
				return { default: (exportName ? m[exportName] : (m.default || m)) as T };
			})
			.catch((err) => {
				return createErrorModule(err);
			})
	);
};

// Lazy load core pages to drastically cut initial JS payload
const HomePage = lazySafe(() => import('./pages/home/HomePage'));
const SearchPage = lazySafe(() => import('./pages/search/SearchPage'));
const LibraryPage = lazySafe(() => import('./pages/LibraryPage'));
const LikedSongsPage = lazySafe(() => import('./pages/liked-songs/LikedSongsPage'));
const LikedSongsImportPage = lazySafe(() => import('./pages/liked-songs/LikedSongsImportPage'));
const SongsIndexPage = lazySafe(() => import('./pages/seo/SEOContentPages'), 'SongsIndexPage');
const PlaylistsIndexPage = lazySafe(() => import('./pages/seo/SEOContentPages'), 'PlaylistsIndexPage');
const ArtistPage = lazySafe(() => import('./pages/seo/SEOContentPages'), 'ArtistPage');
const GenrePage = lazySafe(() => import('./pages/seo/SEOContentPages'), 'GenrePage');
const TrendingPage = lazySafe(() => import('./pages/seo/SEOContentPages'), 'TrendingPage');
const BlogIndexPage = lazySafe(() => import('./pages/seo/SEOContentPages'), 'BlogIndexPage');
const BlogPostPage = lazySafe(() => import('./pages/seo/SEOContentPages'), 'BlogPostPage');

// Lazy load less critical pages only
const AlbumPage = lazySafe(() => import('./pages/album/AlbumPage'));
const PlaylistPage = lazySafe(() => import('./pages/playlist/PlaylistPage'));
const SongPage = lazySafe(() => import('./pages/song/SongPage'));
const ProfilePage = lazySafe(() => import('./pages/ProfilePage'));
const PrivacyPolicy = lazySafe(() => import('./pages/PrivacyPolicy'));
const TermsOfService = lazySafe(() => import('./pages/TermsOfService'));
const About = lazySafe(() => import('./pages/About'));
const SettingsPage = lazySafe(() => import('./pages/SettingsPage'));
const AccountDeletion = lazySafe(() => import('./pages/AccountDeletion'));

// AI Mood Playlist page
const MoodHistoryPage = lazySafe(() => import('./pages/mood-history/MoodHistoryPage'));
const MoodPlaylistPage = lazySafe(() => import('./pages/MoodPlaylistPage'));

// JioSaavn pages
const JioSaavnPlaylistPage = lazySafe(() => import('./pages/jiosaavn/JioSaavnPlaylistPage'));
const JioSaavnPlaylistsPage = lazySafe(() => import('./pages/jiosaavn/JioSaavnPlaylistsPage'));
const JioSaavnCategoriesPage = lazySafe(() => import('./pages/jiosaavn/JioSaavnCategoriesPage'));

// Embed page
const EmbedPlaylistPage = lazySafe(() => import('./pages/embed/EmbedPlaylistPage'));

import { AuthProvider, useAuth } from './contexts/AuthContext';

const Login = lazySafe(() => import('./pages/Login'));
const Register = lazySafe(() => import('./pages/Register'));
const ResetPassword = lazySafe(() => import('./pages/ResetPassword'));
const VerifyEmail = lazySafe(() => import('./pages/VerifyEmail'));
import PWAInstallPrompt from './components/PWAInstallPrompt';

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
		if (!isRecoverableAppLoadError(error)) {
			sessionStorage.removeItem(APP_LOAD_RECOVERY_KEY);
			return;
		}
		if (sessionStorage.getItem(APP_LOAD_RECOVERY_KEY)) return;

		sessionStorage.setItem(APP_LOAD_RECOVERY_KEY, '1');
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
			errorElement: <ErrorFallback />,
			children: [
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
