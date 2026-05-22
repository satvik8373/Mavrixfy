import { useEffect, useReducer } from 'react';
import { imageCache } from '@/utils/imageCache';

interface AvatarState {
  avatarUrl: string;
  avatarLoading: boolean;
  hasError: boolean;
}

type AvatarAction =
  | { type: 'idle'; fallbackUrl: string }
  | { type: 'loading' }
  | { type: 'loaded'; url: string; hasError: boolean }
  | { type: 'failed'; fallbackUrl: string };

const avatarReducer = (state: AvatarState, action: AvatarAction): AvatarState => {
  switch (action.type) {
    case 'idle':
      return {
        avatarUrl: action.fallbackUrl,
        avatarLoading: false,
        hasError: false,
      };
    case 'loading':
      return {
        ...state,
        avatarLoading: true,
      };
    case 'loaded':
      return {
        avatarUrl: action.url,
        avatarLoading: false,
        hasError: action.hasError,
      };
    case 'failed':
      return {
        avatarUrl: action.fallbackUrl,
        avatarLoading: false,
        hasError: true,
      };
    default:
      return state;
  }
};

/**
 * Hook for loading avatar images with rate limiting and fallback
 */
export const useOptimizedAvatar = (
  imageUrl: string | null | undefined,
  fallbackUrl = 'https://ui-avatars.com/api/?background=1db954&color=fff&name=User'
) => {
  const [avatarState, dispatchAvatar] = useReducer(avatarReducer, {
    avatarUrl: fallbackUrl,
    avatarLoading: false,
    hasError: false,
  });

  useEffect(() => {
    if (!imageUrl) {
      dispatchAvatar({ type: 'idle', fallbackUrl });
      return;
    }

    let isMounted = true;
    dispatchAvatar({ type: 'loading' });

    imageCache.loadImage(imageUrl, fallbackUrl)
      .then(url => {
        if (isMounted) {
          dispatchAvatar({
            type: 'loaded',
            url,
            hasError: url === fallbackUrl && imageUrl !== fallbackUrl,
          });
        }
      })
      .catch(() => {
        if (isMounted) {
          dispatchAvatar({ type: 'failed', fallbackUrl });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [imageUrl, fallbackUrl]);

  return {
    avatarUrl: avatarState.avatarUrl,
    isLoading: avatarState.avatarLoading,
    hasError: avatarState.hasError,
  };
};

export default useOptimizedAvatar;
