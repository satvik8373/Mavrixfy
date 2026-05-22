import { useEffect, useReducer, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { PageLoading } from '@/components/ui/loading';

import { useAuth } from '@/contexts/AuthContext';

/**
 * This component handles the authentication callback after a user signs in.
 * It updates the auth store and redirects to the home page.
 */
const AuthCallbackPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated: isSignedIn, loading, user } = useAuth();
  const isLoaded = !loading;
  const [error, dispatchError] = useReducer((_error: string | null, nextError: string | null) => nextError, null);
  const authProcessedRef = useRef(false);

  useEffect(() => {
    let navigationTimeoutId: ReturnType<typeof setTimeout> | undefined;

    // Wait for auth to be loaded
    if (!isLoaded || authProcessedRef.current) return;

    // Prevent multiple auth processing
    if (user?.id) {
      authProcessedRef.current = true;
    }

    try {
      // Update the auth state in the store
      const userId = user?.id || null;
      
      if (userId) {
        // Check if auth state already matches to prevent loops
        const authStore = useAuthStore.getState();
        if (!authStore.isAuthenticated || authStore.userId !== userId) {
          useAuthStore.getState().setAuthStatus(!!isSignedIn, userId);
        }

        // Set a small delay for navigation to allow state updates to complete
        navigationTimeoutId = setTimeout(() => {
          navigate('/');
        }, 300);
      } else if (isLoaded && !isSignedIn) {
        dispatchError('Authentication failed. Please try again.');
      }
    } catch (err) {
      dispatchError('An error occurred during authentication. Please try again.');
    }

    return () => {
      if (navigationTimeoutId) {
        clearTimeout(navigationTimeoutId);
      }
    };
  }, [isLoaded, isSignedIn, navigate, user]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-900">
        <div className="text-center">
          <h1 className="text-xl font-medium text-red-500 mb-2">Authentication Error</h1>
          <p className="text-zinc-400">{error}</p>
          <button type="button"
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 bg-zinc-800 text-white rounded-md hover:bg-zinc-700"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return <PageLoading text="Authentication successful" />;
};

export default AuthCallbackPage; 
