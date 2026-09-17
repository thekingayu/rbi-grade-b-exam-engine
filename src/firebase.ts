import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyCFlebKt2hcMhhQXJiyU-yjmYyIqxBl6hg",
  authDomain: "rbi-prep-engine.firebaseapp.com",
  projectId: "rbi-prep-engine",
  storageBucket: "rbi-prep-engine.firebasestorage.app",
  messagingSenderId: "867708856220",
  appId: "1:867708856220:web:f0573cc7529d2b86330a59",
  measurementId: "G-NBMNRVVB3Y"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
