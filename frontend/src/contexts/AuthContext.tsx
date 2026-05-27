import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import { useAuthStore } from '@/stores/useAuthStore';

interface User {
  id: string;
  email: string;
  name: string;
  picture: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: Error | null;
  isAuthenticated: boolean;
  refreshUserData: () => Promise<void>;
  isOnline: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  error: null,
  isAuthenticated: false,
  refreshUserData: async () => {},
  isOnline: true,
});

export const useAuth = () => useContext(AuthContext);

const buildBasicUser = (firebaseUser: FirebaseUser): User => ({
  id: firebaseUser.uid,
  email: firebaseUser.email || '',
  name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
  picture: firebaseUser.photoURL || '',
});

const loadUserProfile = async (
  firebaseUser: FirebaseUser,
  firebaseDb: Awaited<typeof import('@/lib/firebase')>['db'],
): Promise<User> => {
  const basicUser = buildBasicUser(firebaseUser);

  try {
    const { doc, getDoc } = await import('firebase/firestore');
    const userDoc = await getDoc(doc(firebaseDb, 'users', firebaseUser.uid));
    const profile = userDoc.data();

    return {
      ...basicUser,
      name: profile?.fullName || basicUser.name,
      picture: profile?.imageUrl || basicUser.picture,
    };
  } catch {
    return basicUser;
  }
};

const syncAuthStore = (nextUser: User | null) => {
  if (!nextUser) {
    useAuthStore.getState().reset();
    return;
  }

  useAuthStore.getState().setAuthStatus(true, nextUser.id);
  useAuthStore.getState().setUserProfile(nextUser.name, nextUser.picture);
};

const isPublicGuestRoute = () => {
  if (typeof window === 'undefined') return false;

  const pathname = window.location.pathname;
  return (
    pathname === '/' ||
    pathname === '/home' ||
    pathname === '/search' ||
    pathname === '/songs' ||
    pathname === '/playlists' ||
    pathname.startsWith('/playlist/') ||
    pathname.startsWith('/song/') ||
    pathname.startsWith('/album/') ||
    pathname.startsWith('/albums/') ||
    pathname.startsWith('/artist/') ||
    pathname.startsWith('/genre/') ||
    pathname.startsWith('/trending') ||
    pathname.startsWith('/blog') ||
    pathname.startsWith('/jiosaavn/')
  );
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const hasResolvedInitialAuth = useRef(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  const applyFirebaseUser = useCallback(async (
    firebaseUser: FirebaseUser | null,
    firebaseDb: Awaited<typeof import('@/lib/firebase')>['db'],
  ) => {
    if (!firebaseUser) {
      setUser(null);
      setError(null);
      syncAuthStore(null);
      return;
    }

    try {
      const nextUser = await loadUserProfile(firebaseUser, firebaseDb);
      setUser(nextUser);
      setError(null);
      syncAuthStore(nextUser);

      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        void import('@/services/webPushService')
          .then(({ registerWebPush }) => registerWebPush(firebaseUser.uid))
          .catch(() => {});
      }
    } catch (nextError) {
      const fallbackUser = buildBasicUser(firebaseUser);
      setUser(fallbackUser);
      setError(nextError instanceof Error ? nextError : new Error('Failed to load user profile'));
      syncAuthStore(fallbackUser);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | undefined;
    let cleanupDelayedAuth: (() => void) | undefined;

    const startAuth = async () => {
      setLoading(true);

      try {
        const [{ onAuthStateChanged }, { auth, db }] = await Promise.all([
          import('firebase/auth'),
          import('@/lib/firebase'),
        ]);

        await auth.authStateReady();
        if (!isMounted) return;

        unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          if (!hasResolvedInitialAuth.current) {
            setLoading(true);
          }
          await applyFirebaseUser(firebaseUser, db);
          if (isMounted) {
            hasResolvedInitialAuth.current = true;
            setLoading(false);
          }
        });
      } catch (nextError) {
        if (!isMounted) return;
        setError(nextError instanceof Error ? nextError : new Error('Failed to initialise authentication'));
        setUser(null);
        syncAuthStore(null);
        setLoading(false);
      }
    };

    if (isPublicGuestRoute() && !useAuthStore.getState().isAuthenticated) {
      hasResolvedInitialAuth.current = true;
      setLoading(false);

      const events = ['pointerdown', 'keydown', 'touchstart'];
      const startAfterIntent = () => {
        cleanupDelayedAuth?.();
        void startAuth();
      };

      events.forEach((eventName) => {
        window.addEventListener(eventName, startAfterIntent, { once: true, passive: true });
      });
      cleanupDelayedAuth = () => {
        events.forEach((eventName) => window.removeEventListener(eventName, startAfterIntent));
      };
    } else {
      void startAuth();
    }

    return () => {
      isMounted = false;
      cleanupDelayedAuth?.();
      unsubscribe?.();
    };
  }, [applyFirebaseUser]);

  useEffect(() => {
    const updateOnline = () => setIsOnline(typeof navigator === 'undefined' ? true : navigator.onLine);

    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);

    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);

  const refreshUserData = useCallback(async () => {
    const { auth, db } = await import('@/lib/firebase');
    await applyFirebaseUser(auth.currentUser, db);
  }, [applyFirebaseUser]);

  const contextValue = useMemo(
    () => ({
      user,
      loading,
      error,
      isAuthenticated: !!user,
      refreshUserData,
      isOnline,
    }),
    [user, loading, error, refreshUserData, isOnline],
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};
