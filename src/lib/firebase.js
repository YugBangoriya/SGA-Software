// ─────────────────────────────────────────────────────────────────────────────
// src/lib/firebase.js
// Firebase initialisation — connects the PWA to all Firebase services.
//
// ⚠️  SETUP INSTRUCTIONS FOR DEVELOPER:
//   1. Go to https://console.firebase.google.com
//   2. Create project "shree-ganesh-automobile"
//   3. Add a Web app → copy the firebaseConfig object below
//   4. Enable: Authentication (Email/Password), Firestore, Storage, Hosting
//   5. Replace the placeholder values below with your real config
//   6. NEVER commit real API keys to git — use .env.local for production
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  serverTimestamp,
  orderBy,
  limit,
  addDoc,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

// ── Replace these with your real Firebase project config ─────────────────────
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            || "YOUR_API_KEY",
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        || "YOUR_PROJECT.firebaseapp.com",
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         || "YOUR_PROJECT_ID",
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     || "YOUR_PROJECT.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID|| "YOUR_SENDER_ID",
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             || "YOUR_APP_ID",
};

// Initialise Firebase
export const app = initializeApp(firebaseConfig);
export const auth    = getAuth(app);
export const db      = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// ── Re-export commonly used Firestore helpers so imports stay clean ───────────
export {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  serverTimestamp,
  orderBy,
  limit,
  addDoc,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
  sendPasswordResetEmail,
};

export default app;