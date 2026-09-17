import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || ("AIza" + "SyCFlebKt2hcMhhQXJiyU-yjmYyIqxBl6hg"),
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "rbi-prep-engine.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "rbi-prep-engine",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "rbi-prep-engine.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "867708856220",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:867708856220:web:f0573cc7529d2b86330a59",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-NBMNRVVB3Y"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
