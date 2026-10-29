import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';

// Dynamically check for firebase-applet-config.json if provisioned
const appletConfigs = (import.meta as any).glob('/firebase-applet-config.json', { eager: true });
const appletConfig = (appletConfigs?.['/firebase-applet-config.json'] as any)?.default;

// Firebase configuration for Spark Free Tier
export const firebaseConfig = {
  apiKey: appletConfig?.apiKey || import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyPlaceholderClientKey',
  authDomain:
    appletConfig?.authDomain ||
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    `${import.meta.env.VITE_FIREBASE_PROJECT_ID || 'codescout-free'}.firebaseapp.com`,
  projectId: appletConfig?.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID || 'codescout-free',
  storageBucket:
    appletConfig?.storageBucket ||
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    `${import.meta.env.VITE_FIREBASE_PROJECT_ID || 'codescout-free'}.appspot.com`,
  messagingSenderId:
    appletConfig?.messagingSenderId || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '123456789',
  appId: appletConfig?.appId || import.meta.env.VITE_FIREBASE_APP_ID || '1:123456789:web:abcdef',
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  typeof firebaseConfig.apiKey === 'string' &&
  !firebaseConfig.apiKey.toLowerCase().includes('placeholder')
);

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export type AuthUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
};

// Internal state for development/preview environments
let previewUser: AuthUser | null = null;
const authListeners: Array<(user: AuthUser | null) => void> = [];

/**
 * Sign in using Google popup with automatic preview fallback if credentials not yet configured
 */
export async function signInWithGoogle(): Promise<AuthUser> {
  // If a valid production Firebase API Key is configured, use standard Google OAuth popup
  if (isFirebaseConfigured) {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL,
      };
    } catch (popupError: any) {
      // If user closed the popup or canceled, rethrow cleanly
      if (popupError?.code === 'auth/popup-closed-by-user' || popupError?.code === 'auth/cancelled-popup-request') {
        throw new Error('Sign-in popup was closed before completing.');
      }
      throw popupError;
    }
  }

  // Graceful development & AI Studio preview fallback when API key is a placeholder
  const isDevPreview =
    typeof window !== 'undefined' &&
    (window.location.hostname.includes('run.app') ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      Boolean(import.meta.env.DEV));

  if (isDevPreview) {
    const mockUser: AuthUser = {
      uid: 'preview-user-101',
      email: 'user@codescout.app',
      displayName: 'CodeScout Architect',
      photoURL: null,
    };
    previewUser = mockUser;
    authListeners.forEach((cb) => cb(mockUser));
    return mockUser;
  }

  throw new Error('Firebase Authentication is not configured. Please configure VITE_FIREBASE_API_KEY in your environment.');
}

/**
 * Sign out current user
 */
export async function signOutUser(): Promise<void> {
  if (previewUser) {
    previewUser = null;
    authListeners.forEach((cb) => cb(null));
  }
  if (isFirebaseConfigured) {
    await fbSignOut(auth);
  }
}

/**
 * Get current ID token
 */
export async function getCurrentIdToken(forceRefresh = false): Promise<string | null> {
  if (previewUser) {
    return 'mock-preview-token';
  }
  const currentUser = auth.currentUser;
  if (!currentUser) return null;
  return currentUser.getIdToken(forceRefresh);
}

/**
 * Subscribe to auth state changes
 */
export function subscribeToAuth(callback: (user: AuthUser | null) => void): () => void {
  authListeners.push(callback);
  if (previewUser) {
    callback(previewUser);
  }

  const unsubscribeFirebase = onAuthStateChanged(auth, (user: FirebaseUser | null) => {
    if (!previewUser) {
      if (user) {
        callback({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
        });
      } else {
        callback(null);
      }
    }
  });

  return () => {
    const idx = authListeners.indexOf(callback);
    if (idx !== -1) authListeners.splice(idx, 1);
    unsubscribeFirebase();
  };
}
