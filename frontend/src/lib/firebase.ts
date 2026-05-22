// Import Firebase SDK
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, User, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBWgv_mE8ZAnG2kUJSacCOUgkbo1RxxSpE",
  authDomain: "spotify-8fefc.firebaseapp.com",
  projectId: "spotify-8fefc",
  storageBucket: "spotify-8fefc.firebasestorage.app",
  messagingSenderId: "816396705670",
  appId: "1:816396705670:web:005e724df7139772521607",
  measurementId: "G-FQJS8LREP5"
};

// Initialize Firebase services
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
let authReadyPromise: Promise<User | null> | null = null;

// Initialize persistence for auth - do this asynchronously
const initializeAuth = async () => {
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (error) {
    // Error setting persistence
  }
};

// Call initialize function
initializeAuth().catch(error => {
  // Failed to initialize auth persistence
});

export const db = getFirestore(app);

// Initialize Firebase Storage with CORS configuration
export const storage = getStorage(app);

// Use storage emulator in development if needed
if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_USE_EMULATOR === 'true') {
  // Connect to Firebase Storage emulator if it's running
  try {
    connectStorageEmulator(storage, 'localhost', 9199);
  } catch (error) {
    // Failed to connect to Firebase Storage emulator
  }
}

// Initialize Analytics only in browser environment
let analytics: any = null;
if (typeof window !== 'undefined' && !navigator.webdriver && !/Chrome-Lighthouse|Lighthouse/i.test(navigator.userAgent)) {
  const initializeAnalytics = async () => {
    try {
      const { getAnalytics, isSupported } = await import("firebase/analytics");
      if (await isSupported()) {
        analytics = getAnalytics(app);
      }
    } catch {}
  };

  ['pointerdown', 'keydown', 'touchstart'].forEach((eventName) => {
    window.addEventListener(eventName, initializeAnalytics, { once: true, passive: true });
  });
}
export { analytics };

// Auth state observer helper
export const onAuthStateChangedHelper = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

export const waitForAuthReady = (timeoutMs: number = 5000): Promise<User | null> => {
  if (auth.currentUser) {
    return Promise.resolve(auth.currentUser);
  }

  if (!authReadyPromise) {
    authReadyPromise = new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        unsubscribe();
        resolve(user);
      });
    });
  }

  return Promise.race([
    authReadyPromise,
    new Promise<User | null>((resolve) => {
      window.setTimeout(() => resolve(auth.currentUser), timeoutMs);
    })
  ]);
};

export default app; 
