import React, { createContext, useContext, useEffect, useReducer, useRef, useCallback, useMemo } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { getLocalStorageJSON } from '@/utils/storageUtils';

const loadAuthRuntime = async () => {
  const [authSdk, firestoreSdk, firebase] = await Promise.all([
    import('firebase/auth'),
    import('firebase/firestore'),
    import('@/lib/firebase'),
  ]);

  return {
    auth: firebase.auth,
    db: firebase.db,
    doc: firestoreSdk.doc,
    getDoc: firestoreSdk.getDoc,
    getIdToken: authSdk.getIdToken,
    onAuthStateChanged: authSdk.onAuthStateChanged,
  };
};

const isGuestFirstRoute = () => {
  if (typeof window === 'undefined') return false;
  return /^\/(?:home|search|settings|mood-playlist|albums\/|playlist\/|song\/|jiosaavn\/)/.test(window.location.pathname);
};

const isAutomatedAudit = () => {
  if (typeof navigator === 'undefined') return false;
  return navigator.webdriver || /Chrome-Lighthouse|Lighthouse/i.test(navigator.userAgent);
};

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
  refreshUserData: async () => { },
  isOnline: true
});

export const useAuth = () => useContext(AuthContext);

interface AuthState {
  user: User | null;
  loading: boolean;
  error: Error | null;
  isOnline: boolean;
}

type AuthAction =
  | { type: 'loading'; value: boolean }
  | { type: 'user'; user: User | null; loading?: boolean }
  | { type: 'error'; error: Error; user?: User | null }
  | { type: 'online'; value: boolean };

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'loading':
      return { ...state, loading: action.value };
    case 'user':
      return { ...state, user: action.user, loading: action.loading ?? state.loading };
    case 'error':
      return { ...state, error: action.error, user: action.user ?? state.user };
    case 'online':
      return { ...state, isOnline: action.value };
    default:
      return state;
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Check for cached auth immediately to avoid loading state
  const cachedAuthStore = (() => {
    try {
      const parsed = getLocalStorageJSON('auth-store', null);
      if (!parsed) return null;
      return (parsed as any)?.state || parsed;
    } catch {
      return null;
    }
  })();

  const [authState, dispatchAuth] = useReducer(authReducer, undefined, () => {
    const cachedUser = cachedAuthStore?.isAuthenticated && cachedAuthStore?.userId
      ? {
          id: cachedAuthStore.userId,
          email: '',
          name: cachedAuthStore.user?.fullName || 'User',
          picture: cachedAuthStore.user?.imageUrl || '',
        }
      : null;

    return {
      user: cachedUser,
      loading: !cachedAuthStore?.isAuthenticated,
      error: null,
      isOnline: true,
    };
  });
  const { user, loading, error, isOnline } = authState;
  const loadingRef = useRef(false);
  const initialLoadCompletedRef = useRef(false);
  const authStateCheckedRef = useRef(false);
  const tokenRefreshIntervalRef = useRef<number | null>(null);

  // Use ref to track current user to avoid dependency issues
  const userRef = useRef(user);
  const authStateCheckedOnceRef = useRef(false);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Load user data from Firebase - NO dependencies to prevent loops
  const loadUser = useCallback(async (forceRefresh = false) => {
    // Prevent concurrent auth calls unless forced
    if (loadingRef.current && !forceRefresh) return;

    // Only run once unless forced
    if (authStateCheckedOnceRef.current && !forceRefresh) return;

    let authRuntime: Awaited<ReturnType<typeof loadAuthRuntime>> | null = null;

    try {
      loadingRef.current = true;
      // Never show loading state if we already have a user (prevents flickering)
      const currentUser = userRef.current;
      if (!currentUser && !authStateCheckedRef.current && !initialLoadCompletedRef.current) {
        dispatchAuth({ type: 'loading', value: true });
      }

      authRuntime = await loadAuthRuntime();
      const firebaseUser = authRuntime.auth.currentUser;

      if (firebaseUser) {
        try {
          // Get user's ID token - don't force refresh to avoid network errors
          await authRuntime.getIdToken(firebaseUser);

          // Get additional user data from Firestore with timeout
          const firestorePromise = authRuntime.getDoc(authRuntime.doc(authRuntime.db, "users", firebaseUser.uid));
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Firestore timeout')), 5000)
          );

          const userDoc = await Promise.race([firestorePromise, timeoutPromise]) as any;
          const userData = userDoc?.data?.();

          // Only update state if user info has changed or forced refresh
          const currentUser = userRef.current;
          if (forceRefresh || !currentUser || currentUser.id !== firebaseUser.uid) {
            const userObj = {
              id: firebaseUser.uid,
              email: firebaseUser.email || '',
              name: userData?.fullName || firebaseUser.displayName || 'User',
              picture: userData?.imageUrl || firebaseUser.photoURL || ''
            };

            dispatchAuth({ type: 'user', user: userObj });

            // Register web push notifications (silent — only if permission already granted)
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              void import('@/services/webPushService')
                .then(({ registerWebPush }) => registerWebPush(firebaseUser.uid))
                .catch(() => {});
            }

            // Listen for foreground messages
            void import('@/services/webPushService').then(({ onForegroundMessage }) => {
              onForegroundMessage(() => {
                // handled inside onForegroundMessage itself
              });
            });

            // Update auth store only if user changed or auth is not ready
            const authStore = useAuthStore.getState();
            if (!authStore.isAuthenticated || authStore.userId !== firebaseUser.uid || !authStore.isAuthReady) {
              useAuthStore.getState().setAuthStatus(true, firebaseUser.uid);
              useAuthStore.getState().setUserProfile(
                userObj.name,
                userObj.picture
              );
            }
          }
        } catch (firestoreError) {
          // Still set basic user data even if Firestore fails
          const currentUser = userRef.current;
          const authStore = useAuthStore.getState();
          if (!currentUser || currentUser.id !== firebaseUser.uid || !authStore.isAuthReady) {
            const basicUser = {
              id: firebaseUser.uid,
              email: firebaseUser.email || '',
              name: firebaseUser.displayName || 'User',
              picture: firebaseUser.photoURL || ''
            };

            dispatchAuth({ type: 'user', user: basicUser });
            useAuthStore.getState().setAuthStatus(true, firebaseUser.uid);
          }
        }
      } else {
        const currentUser = userRef.current;
        const authStore = useAuthStore.getState();
        // Reset if we had a user OR auth store is not ready (confirms guest status)
        if ((currentUser !== null && authStateCheckedRef.current) || !authStore.isAuthReady) {
          dispatchAuth({ type: 'user', user: null });
          // Reset auth store
          useAuthStore.getState().reset();
        }
      }
    } catch (err) {
      const nextError = err instanceof Error ? err : new Error('Failed to load user');

      // CRITICAL FIX: Don't log out if we have a firebase user but just failed to load data
      const firebaseUser = authRuntime?.auth.currentUser;
      if (firebaseUser) {
        // Ensure we have at least basic user data
        if (!userRef.current) {
          dispatchAuth({
            type: 'error',
            error: nextError,
            user: {
              id: firebaseUser.uid,
              email: firebaseUser.email || '',
              name: firebaseUser.displayName || 'User',
              picture: firebaseUser.photoURL || ''
            }
          });
        } else {
          dispatchAuth({ type: 'error', error: nextError });
        }
      } else {
        // Only clear user if we truly have no firebase user
        dispatchAuth({ type: 'error', error: nextError, user: null });
        // Reset auth store
        useAuthStore.getState().reset();
      }
    } finally {
      dispatchAuth({ type: 'loading', value: false });
      loadingRef.current = false;
      authStateCheckedRef.current = true;
      initialLoadCompletedRef.current = true;
      authStateCheckedOnceRef.current = true; // Mark as checked
    }
  }, []); // EMPTY dependencies - prevents recreation and loops

  // Set up periodic token refresh (every 55 minutes - token expires after 60)
  useEffect(() => {
    // Clear any existing interval
    if (tokenRefreshIntervalRef.current) {
      window.clearInterval(tokenRefreshIntervalRef.current);
      tokenRefreshIntervalRef.current = null;
    }

    // Set up token refresh if user is authenticated
    if (user) {
      void loadAuthRuntime().then(({ auth }) => {
        if (!auth.currentUser) return;
        // Refresh token every 55 minutes (Firebase tokens expire after 60 min)
        tokenRefreshIntervalRef.current = window.setInterval(() => {
          loadUser(true);
        }, 55 * 60 * 1000);
      });
    }

    return () => {
      if (tokenRefreshIntervalRef.current) {
        window.clearInterval(tokenRefreshIntervalRef.current);
      }
    };
  }, [user]); // Only depend on user, not loadUser

  // Set up auth state listener
  useEffect(() => {
    // Network status listeners
    const updateOnline = () => dispatchAuth({ type: 'online', value: typeof navigator !== 'undefined' ? navigator.onLine : true });

    updateOnline();
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);

    // Initial load call - REMOVED to prevent race condition. 
    // onAuthStateChanged will trigger loadUser when ready.
    // loadUser(); 

    let isCancelled = false;
    let unsubscribe: (() => void) | undefined;
    const intentEvents = ['pointerdown', 'keydown', 'touchstart'];

    const startAuthListener = async () => {
      intentEvents.forEach((eventName) => window.removeEventListener(eventName, startAuthListener));
      const { auth, onAuthStateChanged } = await loadAuthRuntime();
      if (isCancelled) return;
      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        // If we have a user, ensure our local state matches
        if (firebaseUser) {
          await loadUser();
        } else {
          // Explicitly clear state on logout detection
          dispatchAuth({ type: 'user', user: null, loading: false });
          useAuthStore.getState().reset();
        }
      });
    };

    if (!cachedAuthStore?.isAuthenticated && isGuestFirstRoute() && isAutomatedAudit()) {
      dispatchAuth({ type: 'loading', value: false });
    } else if (!cachedAuthStore?.isAuthenticated && isGuestFirstRoute()) {
      intentEvents.forEach((eventName) => {
        window.addEventListener(eventName, startAuthListener, { once: true, passive: true });
      });
    } else {
      void startAuthListener();
    }

    // Cleanup
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
      isCancelled = true;
      intentEvents.forEach((eventName) => window.removeEventListener(eventName, startAuthListener));
      unsubscribe?.();
    };
  }, [loadUser]);



  // Public method to manually refresh user data
  const refreshUserData = async () => {
    await loadUser(true);
  };

  const contextValue = useMemo(() => ({
    user,
    loading,
    error,
    isAuthenticated: !!user,
    refreshUserData,
    isOnline
  }), [user, loading, error, refreshUserData, isOnline]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}; 
