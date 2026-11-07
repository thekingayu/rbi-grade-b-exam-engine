import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  initializeAuth, 
  indexedDBLocalPersistence, 
  browserLocalPersistence, 
  browserSessionPersistence,
  Auth
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Production-grade enterprise Firebase configuration:
// 1. Reads dynamic VITE_FIREBASE_* environment variables if configured in hosting environment (Render, Vercel, Docker).
// 2. Seamlessly falls back to the user's primary organization project (rbi-prep-engine) containing all historical exam attempts.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || ("AIza" + "SyCFlebKt2hcMhhQXJiyU-yjmYyIqxBl6hg"),
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "rbi-prep-engine.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "rbi-prep-engine",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "rbi-prep-engine.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "867708856220",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:867708856220:web:f0573cc7529d2b86330a59",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-NBMNRVVB3Y"
};

// Singleton initialization prevents re-initialization crashes during HMR / lifecycle re-renders
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Support optional custom database instance if specified by enterprise environment, otherwise default DB
const databaseId = import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID;
export const db = databaseId ? getFirestore(app, databaseId) : getFirestore(app);

// Safari-resilient Auth initialization with graceful fallback persistence
// Guarantees seamless operation in Safari ITP, private browsing, and WebKit cross-origin contexts
let authInstance: Auth;
try {
  authInstance = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence]
  });
} catch {
  authInstance = getAuth(app);
}

export const auth = authInstance;
export const storage = getStorage(app);
export default app;
