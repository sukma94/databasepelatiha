import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBsIALg3hlGpGk09tjpUAyQ8081d0IFHDQ",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "databasepeserta-sportunys.firebaseapp.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "databasepeserta-sportunys",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "databasepeserta-sportunys.firebasestorage.app",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "284250782274",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:284250782274:web:e24ce5c1cb73c05f5e0bdb",
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-E53V9D8SNC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const analytics = typeof window !== "undefined" ? getAnalytics(app) : null;
export const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
export const auth = getAuth(app);
