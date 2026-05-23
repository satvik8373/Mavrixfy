import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search, XCircle, User, Home, Bell, Megaphone, Download } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMusicStore } from '@/stores/useMusicStore';
import SearchSuggestions from '@/components/SearchSuggestions';
import { useAuth } from '@/contexts/AuthContext';
import debounce from 'lodash/debounce';
import { WhatsNewDialog } from './WhatsNewDialog';
import { useOptimizedAvatar } from '@/hooks/useOptimizedAvatar';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface HeaderProps {
  className?: string;
}


interface HeaderActionsProps {
  user: any;
  authLoading: boolean;
  isAndroid: boolean;
  avatarUrl: string | null;
  avatarLoading: boolean;
  setShowWhatsNew: (val: boolean) => void;
  handleLogout: () => void;
  navigate: (path: string) => void;
}

const HeaderActions = ({
  user,
  authLoading,
  isAndroid,
  avatarUrl,
  avatarLoading,
  setShowWhatsNew,
  handleLogout,
  navigate,
}: HeaderActionsProps) => {
  if (authLoading) return null;

  if (!user) {
    return (
      <Button
        className="rounded-full bg-white hover:bg-white/90 hover:scale-105 text-black font-bold px-8 text-sm transition-all"
        style={{ height: '48px' }}
        onClick={() => navigate('/login')}
      >
        Log in
      </Button>
    );
  }

  return (
    <>
      {/* APK Download for Android Users - Show on mobile too */}
      {isAndroid && (
        <a
          href={import.meta.env.VITE_APK_DOWNLOAD_URL || 'https://github.com/satvik8373/Mavrixfy-App/releases/download/v1.0.0/mavrixfy.apk'}
          download
          className="flex items-center gap-2 px-3 md:px-4 py-2 bg-green-500 hover:bg-green-400 text-black font-medium rounded-full transition-all text-xs md:text-sm"
          title="Download Android APK"
        >
          <Download size={16} />
          <span className="hidden sm:inline">Download APK</span>
          <span className="sm:hidden">APK</span>
        </a>
      )}

      {/* Bell Icon - Show on mobile too */}
      <button type="button"
        className="w-8 h-8 rounded-full hover:bg-[#1f1f1f] flex items-center justify-center transition-colors"
        onClick={() => setShowWhatsNew(true)}
      >
        <Bell size={20} className="text-[#a7a7a7] hover:text-white transition-colors" />
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="w-8 h-8 rounded-full bg-[#1f1f1f] hover:scale-105 flex items-center justify-center overflow-hidden transition-transform">
            {avatarUrl && !avatarLoading ? (
              <img
                src={avatarUrl}
                alt={user.name || 'User'}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <User className="h-5 w-5 text-[#a7a7a7]" />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[320px] bg-[#282828] border-none p-1 shadow-xl" align="end" sideOffset={8}>

          <DropdownMenuItem
            className="cursor-pointer text-white hover:bg-white/10 p-3"
            onClick={() => navigate('/settings')}
          >
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer text-white hover:bg-white/10 p-3"
            onClick={() => navigate('/about')}
          >
            About
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer text-white hover:bg-white/10 p-3"
            onClick={() => navigate('/privacy')}
          >
            Privacy Policy
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer text-white hover:bg-white/10 p-3"
            onClick={() => navigate('/terms')}
          >
            Terms of Service
          </DropdownMenuItem>

          <DropdownMenuSeparator className="bg-white/10 my-1" />

          <DropdownMenuItem
            className="cursor-pointer text-white hover:bg-white/10 p-3"
            onClick={handleLogout}
          >
            Log out
          </DropdownMenuItem>

          <DropdownMenuSeparator className="bg-white/10 my-1" />

          <div className="p-2">
            <div className="flex items-center justify-between mb-2 px-1">
              <h3 className="text-white font-semibold text-sm">Your Updates</h3>
            </div>

            <div className="space-y-2">
              {/* Item 1 */}
              <div className="group flex gap-3 p-2 rounded-md hover:bg-white/5 cursor-pointer transition-colors relative">
                <img
                  src="/mavrixfy.png"
                  alt="Concert"
                  className="w-12 h-12 rounded-md object-cover flex-shrink-0"
                />
                <div className="flex flex-col justify-center">
                  <p className="text-white text-[13px] leading-tight line-clamp-2">
                    Tickets on sale for Iqlipse Nova in Vadodara on Sat, Dec 20
                  </p>
                  <p className="text-[#a7a7a7] text-xs mt-1">6w</p>
                </div>
                <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                </div>
              </div>

              {/* Item 2 */}
              <div className="group flex gap-3 p-2 rounded-md hover:bg-white/5 cursor-pointer transition-colors">
                <div className="w-12 h-12 rounded-md bg-[#333] flex items-center justify-center flex-shrink-0">
                  <Megaphone className="w-6 h-6 text-white" />
                </div>
                <div className="flex flex-col justify-center">
                  <p className="text-white text-[13px] leading-tight line-clamp-2">
                    Say hello to Your Updates. Check here for news on your followers, playlists, events and more
                  </p>
                  <p className="text-[#a7a7a7] text-xs mt-1">10w</p>
                </div>
              </div>
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};
const Header = ({ className }: HeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const { searchIndianSongs } = useMusicStore();
  const { user, loading: authLoading, refreshUserData } = useAuth();
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const searchFormRef = useRef<HTMLFormElement>(null);
  const authProcessedRef = useRef(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [isAndroid] = useState(() => /android/.test(navigator.userAgent.toLowerCase()));

  // Optimized avatar loading with rate limiting
  const { avatarUrl, isLoading: avatarLoading } = useOptimizedAvatar(
    user?.picture,
    `https://ui-avatars.com/api/?background=1db954&color=fff&name=${encodeURIComponent(user?.name || 'User')}`
  );

  // Extract search query from URL when navigating to search page
  useEffect(() => {
    if (location.pathname === '/search') {
      const queryParams = new URLSearchParams(location.search);
      const q = queryParams.get('q');
      if (q) {
        setSearchQuery(q);
      }
    } else if (!location.pathname.includes('/search')) {
      setSearchQuery('');
    }
  }, [location]);

  // Handle clicking outside the search form to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchFormRef.current && !searchFormRef.current.contains(event.target as Node)) {
        setShowSearchSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Optimized debounced search with request cancellation
  const searchAbortController = useRef<AbortController | null>(null);

  const debouncedSearch = React.useMemo(
    () => debounce((query: string) => {
      if (query.trim().length >= 2) {
        // Cancel previous request
        if (searchAbortController.current) {
          searchAbortController.current.abort();
        }

        // Create new abort controller
        searchAbortController.current = new AbortController();

        // Perform search with cancellation support
        searchIndianSongs(query);
      }
    }, 500), // Increased debounce delay to reduce API calls
    [searchIndianSongs]
  );

  useEffect(() => {
    if (user && !authProcessedRef.current) {
      refreshUserData();
      authProcessedRef.current = true;
    }
  }, [refreshUserData, user]);

  useEffect(() => {
    if (user?.id && !authLoading) {
      const currentUserId = useAuthStore.getState().userId;
      if (currentUserId !== user.id) {
        useAuthStore.getState().setAuthStatus(true, user.id);
      }
    }
  }, [user, authLoading]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setShowSearchSuggestions(false);
    }
  };

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (query.trim().length >= 2) {
      debouncedSearch(query);
      setShowSearchSuggestions(true);
    } else {
      setShowSearchSuggestions(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setShowSearchSuggestions(false);
  };

  const handleSelectSong = (songName: string) => {
    setSearchQuery(songName);
    navigate(`/search?q=${encodeURIComponent(songName.trim())}`);
    setShowSearchSuggestions(false);
  };

  const handleLogout = async () => {
    try {
      // CRITICAL: Clear auth storage SYNCHRONOUSLY before navigation
      // This prevents the Login page from seeing old credentials and redirecting back
      localStorage.removeItem('auth-store');

      // Navigate to login immediately with a flag indicating explicit logout
      navigate('/login', {
        replace: true,
        state: { fromLogout: true }
      });

      // Then perform the actual Firebase logout in background
      const { signOut } = await import('@/services/hybridAuthService');
      await signOut();
    } catch (error) {
      // Still reset auth store in case of error
      useAuthStore.getState().reset();
    }
  };

  return (
    <header
      className={`bg-black flex items-center px-4 relative z-[100]${className ? ` ${className}` : ''}`}
      style={{ height: '64px' }}
    >
      <div className="w-full flex items-center justify-between">
        {/* Left: Logo and Brand Name */}
        <Link to={user ? "/home" : "/"} className="flex-shrink-0 flex items-center gap-3">
          <img
            src="/mavrixfy.png"
            alt="Mavrixfy"
            className="h-10 w-10 object-contain"
            aria-label="Mavrixfy"
          />
          <span className="hidden md:block text-white text-xl font-bold">
            Mavrixfy
          </span>
        </Link>

        {/* Center: Home Button and Search Bar */}
        <div className="hidden md:flex absolute left-1/2 transform -translate-x-1/2 items-center gap-2 z-[100]">
          {/* Home Button */}
          <Link
            to="/home"
            className="flex items-center justify-center rounded-full bg-[#1f1f1f] hover:bg-[#2a2a2a] hover:scale-105 transition-all"
            style={{ width: '48px', height: '48px' }}
          >
            <Home size={24} className="text-white" />
          </Link>

          {/* Search Bar */}
          <form
            ref={searchFormRef}
            className="relative z-[100]"
            style={{ width: '380px' }}
            onSubmit={handleSearch}
          >
            <div className="relative flex items-center">
              <div className="absolute left-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-[#a7a7a7]" />
              </div>
              <Input
                id="header-search-input"
                type="search"
                placeholder="What do you want to play?"
                value={searchQuery}
                onChange={handleQueryChange}
                onClick={() => {
                  if (searchQuery.trim().length >= 2) {
                    setShowSearchSuggestions(true);
                  }
                }}
                className="w-full rounded-full bg-[#242424] hover:bg-[#2a2a2a] hover:ring-1 hover:ring-[#535353] text-white pl-12 pr-10 border-none placeholder:text-[#a7a7a7] text-sm transition-all focus:ring-2 focus:ring-white"
                style={{ height: '48px' }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-4 text-[#a7a7a7] hover:text-white"
                >
                  <XCircle size={18} />
                </button>
              )}
            </div>

            <SearchSuggestions
              isVisible={showSearchSuggestions}
              query={searchQuery}
              onSelectSong={handleSelectSong}
            />
          </form>
        </div>

        {/* Right: Spacer for balance */}
        <div className="flex-shrink-0" style={{ width: '32px' }} />

        {/* Right: User Profile & Bell */}
                <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
          <HeaderActions
            user={user}
            authLoading={authLoading}
            isAndroid={isAndroid}
            avatarUrl={avatarUrl}
            avatarLoading={avatarLoading}
            setShowWhatsNew={setShowWhatsNew}
            handleLogout={handleLogout}
            navigate={navigate}
          />
          {user && <WhatsNewDialog open={showWhatsNew} onOpenChange={setShowWhatsNew} />}
        </div>
      </div>
    </header>
  );
};

export default Header;
