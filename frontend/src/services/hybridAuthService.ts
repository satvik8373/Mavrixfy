import {
  signOut as firebaseSignOut,
  updateProfile,
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase";
import { useAuthStore } from "@/stores/useAuthStore";
import axiosInstance from "@/lib/axios";
import { API_BASE_URL } from "@/lib/apiConfig";
import { isWebView, clearAuthCache } from "@/utils/webViewDetection";
import { signInWithFacebook, initializeFacebookSDK } from "./facebookAuthService";
import { buildNewUserProfileDocument, buildUserProfileDocument } from "@/services/userProfileDocument";


const API_URL = API_BASE_URL;

/**
 * Hybrid authentication service that works with both Firebase and the backend API
 * - Uses Firebase for authentication
 * - Creates user in Firestore database
 * - Syncs user data with backend API
 */

// Cache login attempts to prevent duplicate calls
const loginCache = new Map();

// Define FirestoreUser interface
interface FirestoreUser {
  uid: string;
  email: string | null;
  displayName?: string;
  photoURL?: string | null;
  createdAt: any; // Firebase Timestamp
  updatedAt: any; // Firebase Timestamp
}

// Define custom user profile interface
interface UserProfile {
  id: string;
  email: string | null;
  name: string;
  picture: string | null;
}

// Sign in with email and password
export const login = async (email: string, password: string): Promise<UserProfile | null> => {
  try {
    // Generate a cache key
    // const cacheKey = `${email}:${Date.now()}`;

    // Check if we have an ongoing login attempt with this email
    const existingLoginPromise = loginCache.get(email);
    if (existingLoginPromise) {
      return existingLoginPromise;
    }

    // Create a promise for this login attempt and cache it
    const loginPromise = (async () => {
      // Step 1: Firebase Authentication
      let userCredential;
      try {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      } catch (error: any) {
        const errorCode = error.code;
        const errorMessage = error.message;

        // Provide more user-friendly error messages
        if (errorCode === 'auth/user-not-found') {
          throw new Error("No account found with this email address");
        } else if (errorCode === 'auth/wrong-password') {
          throw new Error("Incorrect password");
        } else if (errorCode === 'auth/too-many-requests') {
          throw new Error("Too many failed login attempts. Please try again later or reset your password");
        } else if (errorCode === 'auth/invalid-credential') {
          throw new Error("Invalid login credentials");
        } else {
          throw new Error(`Authentication failed: ${errorMessage}`);
        }
      }

      if (!userCredential?.user) {
        throw new Error("Login failed: No user returned from Firebase");
      }

      const firebaseUser = userCredential.user;

      // Get fresh ID token with short timeout
      const idToken = await firebaseUser.getIdToken(true);

      // Step 2: Fetch Firestore User Profile (optimized with timeout)
      let firestoreUser = null;

      try {
        // Use Promise.race to timeout Firestore read after 2 seconds
        const firestorePromise = getDoc(doc(db, "users", firebaseUser.uid));
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Firestore timeout')), 2000)
        );

        const userDoc = await Promise.race([firestorePromise, timeoutPromise]) as any;

        if (userDoc?.exists()) {
          firestoreUser = userDoc.data() as FirestoreUser;
        } else {
          // Create basic profile if not found
          firestoreUser = {
            ...buildNewUserProfileDocument(firebaseUser, {
              email: firebaseUser.email || email,
              displayName: firebaseUser.displayName || email.split('@')[0],
              fullName: firebaseUser.displayName || email.split('@')[0],
              imageUrl: firebaseUser.photoURL || null,
              photoURL: firebaseUser.photoURL || null,
            }),
          };

          // Create document in background
          setDoc(doc(db, "users", firebaseUser.uid), firestoreUser).catch(() => {
            // Ignore errors
          });
        }
      } catch (error) {
        // Use Firebase data as fallback
        firestoreUser = {
          ...buildNewUserProfileDocument(firebaseUser, {
            email: firebaseUser.email || email,
            displayName: firebaseUser.displayName || email.split('@')[0],
            fullName: firebaseUser.displayName || email.split('@')[0],
            imageUrl: firebaseUser.photoURL || null,
            photoURL: firebaseUser.photoURL || null,
          }),
        };
      }

      // Step 3: Update Auth Store IMMEDIATELY for instant UI response
      const userProfile: UserProfile = {
        id: firebaseUser.uid,
        email: firebaseUser.email || email,
        name: firestoreUser?.displayName || firebaseUser.displayName || email.split('@')[0],
        picture: firestoreUser?.photoURL || firebaseUser.photoURL || null,
      };

      // Set user auth state in store BEFORE any async operations
      useAuthStore.getState().setAuthStatus(true, firebaseUser.uid);
      useAuthStore.getState().setUserProfile(userProfile.name, userProfile.picture || undefined);

      // Step 4: Sync with Backend API in background (non-blocking)
      syncWithBackend(idToken, firebaseUser).catch(() => {
        // Ignore backend sync errors - user is already authenticated
      });

      return userProfile;
    })();

    // Store the promise in the cache
    loginCache.set(email, loginPromise);

    // Set a timeout to clear the cache entry to prevent memory leaks
    setTimeout(() => {
      loginCache.delete(email);
    }, 30000); // Clear after 30 seconds

    return await loginPromise;
  } catch (error: any) {
    // Clear cache on error
    loginCache.delete(email);
    throw error;
  }
};

// Helper function to synchronize with the backend
async function syncWithBackend(idToken: string, firebaseUser: any) {
  try {
    // Set the auth token for API requests
    axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${idToken}`;

    // Sync user with backend (Firebase token verified server-side)
    const response = await axiosInstance.post('/auth/firebase', {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
    });

    return response.data;
  } catch (error) {
    throw error;
  }
}

// Register new user
export const register = async (email: string, password: string, fullName: string): Promise<UserProfile> => {
  try {
    // Create user in Firebase Authentication
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Update profile with display name
    await updateProfile(user, {
      displayName: fullName,
    });

    // Send email verification
    try {
      await sendEmailVerification(user, {
        url: window.location.origin + '/home',
        handleCodeInApp: false
      });
    } catch (verificationError) {
      // Continue with registration even if verification email fails
    }

    // Create user document in Firestore
    await setDoc(doc(db, "users", user.uid), buildNewUserProfileDocument(user, {
      email,
      fullName,
      displayName: fullName,
      imageUrl: null,
      photoURL: null,
      provider: "password",
      emailVerified: false
    }));

    // Create a user profile object
    const userProfile: UserProfile = {
      id: user.uid,
      email: user.email,
      name: fullName,
      picture: null
    };

    // Synchronize with backend if it's available
    if (API_URL) {
      try {
        // Get Firebase ID token
        const idToken = await user.getIdToken();

        // Call backend API to create user
        const response = await fetch(`${API_URL}/auth/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            email,
            fullName,
            uid: user.uid
          })
        });

        if (!response.ok) {
          // Failed to register user with backend, but Firebase registration successful
        }
      } catch (error) {
        // Backend registration failed, but Firebase registration successful
      }
    }

    // Update auth store
    useAuthStore.getState().setAuthStatus(true, user.uid);
    useAuthStore.getState().setUserProfile(fullName, undefined);

    return userProfile;
  } catch (error: any) {
    throw new Error(error.message || "Failed to register");
  }
};

// Send email verification
export const sendVerificationEmail = async (): Promise<void> => {
  try {
    const user = auth.currentUser;
    
    if (!user) {
      throw new Error('No user is currently signed in');
    }

    if (user.emailVerified) {
      throw new Error('Email is already verified');
    }

    await sendEmailVerification(user, {
      url: window.location.origin + '/home',
      handleCodeInApp: false
    });
  } catch (error: any) {
    throw new Error(error.message || "Failed to send verification email");
  }
};

// Check if email is verified
export const checkEmailVerified = async (): Promise<boolean> => {
  try {
    const user = auth.currentUser;
    
    if (!user) {
      return false;
    }

    // Reload user to get latest email verification status
    await user.reload();
    
    // Update Firestore if verification status changed
    if (user.emailVerified) {
      try {
        await setDoc(doc(db, "users", user.uid), buildUserProfileDocument(user, {
          emailVerified: true,
        }), { merge: true });
      } catch (error) {
        // Failed to update Firestore
      }
    }
    
    return user.emailVerified;
  } catch (error: any) {
    return false;
  }
};

// Sign out
export const signOut = async () => {
  try {
    // Get current user ID before signing out
    const userId = auth.currentUser?.uid;

    // Reset auth store before Firebase signout for faster UI response
    useAuthStore.getState().reset();

    // Sign out from Firebase (can be slow sometimes)
    await firebaseSignOut(auth);

    // Sign out from backend if it's available (do in background)
    if (API_URL && userId) {
      fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ uid: userId })
      }).catch(error => {
        // Backend logout error
      });
    }

    // Clear auth-related localStorage items
    localStorage.removeItem('firebase:authUser:AIzaSyBWgv_mE8ZAnG2kUJSacCOUgkbo1RxxSpE:[DEFAULT]');
    localStorage.removeItem('auth-store');

    // Clear any potential Firebase auth related items
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('firebase') || key.includes('auth'))) {
        localStorage.removeItem(key);
      }
    }

    // Also clear session storage
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (key.includes('firebase') || key.includes('auth'))) {
        sessionStorage.removeItem(key);
      }
    }

    return { success: true };
  } catch (error: any) {
    // Still reset store even if Firebase logout fails
    useAuthStore.getState().reset();

    // Don't throw error, just return success: false
    return { success: false, error: error.message };
  }
};

// Update user profile
export const updateUserProfile = async (user: User, data: {
  fullName?: string,
  imageFile?: File
}) => {
  try {
    let imageUrl = user.photoURL;

    // Upload image if provided
    if (data.imageFile) {
      const storageRef = ref(storage, `profile-images/${user.uid}`);
      await uploadBytes(storageRef, data.imageFile);
      imageUrl = await getDownloadURL(storageRef);
    }

    // Update display name if provided
    if (data.fullName) {
      await updateProfile(user, {
        displayName: data.fullName,
        ...(imageUrl ? { photoURL: imageUrl } : {})
      });
    } else if (imageUrl !== user.photoURL) {
      await updateProfile(user, {
        photoURL: imageUrl
      });
    }

    // Update user document in Firestore
    await setDoc(doc(db, "users", user.uid), buildUserProfileDocument(user, {
      fullName: data.fullName || user.displayName || "User",
      displayName: data.fullName || user.displayName || "User",
      imageUrl,
      photoURL: imageUrl,
    }), { merge: true });

    // Synchronize with backend if it's available
    if (API_URL) {
      try {
        // Get Firebase ID token
        const idToken = await user.getIdToken();

        // Call backend API to update user
        const response = await fetch(`${API_URL}/auth/update-profile`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            uid: user.uid,
            fullName: data.fullName || user.displayName,
            imageUrl: imageUrl
          })
        });

        if (!response.ok) {
          // Failed to update profile with backend, but Firebase update successful
        }
      } catch (error) {
        // Backend profile update failed, but Firebase update successful
      }
    }

    // Update auth store
    useAuthStore.getState().setUserProfile(
      data.fullName || user.displayName || "",
      imageUrl || undefined
    );

    return { success: true };
  } catch (error: any) {
    throw new Error(error.message || "Failed to update profile");
  }
};

// Reset password
export const resetPassword = async (email: string) => {
  try {
    await sendPasswordResetEmail(auth, email);

    // Notify backend if it's available
    if (API_URL) {
      try {
        const response = await fetch(`${API_URL}/auth/reset-password-request`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email })
        });

        if (!response.ok) {
          // Failed to notify backend about password reset, but Firebase reset successful
        }
      } catch (error) {
        // Backend password reset notification failed, but Firebase reset successful
      }
    }

    return { success: true };
  } catch (error: any) {
    throw new Error(error.message || "Failed to send password reset email");
  }
};



// Get current user
export const getCurrentUser = () => {
  return auth.currentUser;
};

// Helper to detect if running in PWA mode
const isPWA = (): boolean => {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://');
};

// Helper to detect iOS
const isIOS = (): boolean => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

// Sign in with Google
export const signInWithGoogle = async (): Promise<UserProfile> => {
  try {
    // Clear auth cache especially in WebView to prevent stale state
    clearAuthCache();

    // Create a new GoogleAuthProvider instance with optimal settings
    const provider = new GoogleAuthProvider();

    // Configure provider based on environment
    if (isWebView()) {
      // WebView-specific configuration
      provider.setCustomParameters({
        prompt: 'select_account',
        // Ensure popup mode works in WebView
        display: 'popup'
      });
    } else {
      // Standard browser configuration
      provider.setCustomParameters({
        prompt: 'select_account'
      });
    }

    // Use popup only - redirect causes "missing initial state" error in PWA/WebView
    const userCredential = await signInWithPopup(auth, provider);
    const user = userCredential.user;

    // Create a user profile object
    const userProfile: UserProfile = {
      id: user.uid,
      email: user.email,
      name: user.displayName || user.email?.split('@')[0] || 'User',
      picture: user.photoURL,
    };

    // Update auth store immediately for faster UI response
    useAuthStore.getState().setAuthStatus(true, user.uid);
    useAuthStore.getState().setUserProfile(
      userProfile.name,
      userProfile.picture || undefined
    );

    // Perform Firestore and backend operations in the background 
    // without blocking the UI response
    (async () => {
      try {
        // Get Firebase ID token
        const idToken = await user.getIdToken();

        // Check if user exists in Firestore
        const userDoc = await getDoc(doc(db, "users", user.uid));

        if (!userDoc.exists()) {
          // Create user document in Firestore if this is their first sign in
          await setDoc(doc(db, "users", user.uid), buildNewUserProfileDocument(user, {
            email: user.email,
            fullName: user.displayName || user.email?.split('@')[0] || 'User',
            displayName: user.displayName || user.email?.split('@')[0] || 'User',
            imageUrl: user.photoURL,
            photoURL: user.photoURL,
            provider: "google.com",
          }));
        }

        // Synchronize with backend (non-blocking)
        try {
          axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${idToken}`;
          await axiosInstance.post('/auth/firebase', {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || user.email?.split('@')[0] || 'User',
          });
        } catch (_) {
          // ignore; do not block UI on backend sync
        }

        // Migrate any liked songs from anonymous user
        // This step is no longer needed as we are using Firestore exclusively
        // await migrateAnonymousLikedSongs(user.uid);
      } catch (error) {
        // Background operations failed, but user is authenticated
      }
    })();

    return userProfile;
  } catch (error: any) {
    throw new Error(error.message || "Failed to login with Google");
  }
};

// Add a refresh user data function that can be called from components
export const refreshUserData = async (): Promise<UserProfile | null> => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return null;
    }

    // Get fresh ID token
    await currentUser.getIdToken(true);

    // Fetch user data from Firestore
    const userDoc = await getDoc(doc(db, "users", currentUser.uid));
    let firestoreUser = null;

    if (userDoc.exists()) {
      firestoreUser = userDoc.data() as FirestoreUser;
    }

    // Update auth store
    const userProfile: UserProfile = {
      id: currentUser.uid,
      email: currentUser.email,
      name: firestoreUser?.displayName || currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
      picture: firestoreUser?.photoURL || currentUser.photoURL || null,
    };

    useAuthStore.getState().setAuthStatus(true, currentUser.uid);
    useAuthStore.getState().setUserProfile(userProfile.name, userProfile.picture || undefined);

    return userProfile;
  } catch (error) {
    return null;
  }
};

// Export Facebook login function
export { signInWithFacebook } from "./facebookAuthService"; 
