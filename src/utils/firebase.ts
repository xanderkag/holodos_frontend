import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signInWithCustomToken,
  signInWithRedirect,
  signInWithCredential,
  getRedirectResult
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  increment,
  initializeFirestore
} from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDgvHci7w8Nr36i4H2Nk1h9u0m1mJ36GCs",
  // v3.11.0: Using custom domain for Auth to kill Cookie blocking / redirect loops.
  // v3.11.4: Hardcoding to app.holodos.su to solve for Error 400: redirect_uri_mismatch.
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "holodos-6ff24.firebaseapp.com"),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "holodos-6ff24",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "holodos-6ff24.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "983609791949",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:983609791949:web:8425fe0a8e2d263e032084",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-47Z5XBK8KK"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Automatically uses browserLocalPersistence (localStorage) for stable Auth.

// v3.22.21: Android WebView WebSocket is unreliable → causes "client is offline" errors.
// iOS and Web use defaults (WebChannel / gRPC) which are stable.
// try/catch: if IndexedDB is corrupted after a crash, fallback to defaults.
import { getFirestore } from 'firebase/firestore';
let db: ReturnType<typeof initializeFirestore>;
try {
  const firestoreSettings: any = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
    ? { experimentalForceLongPolling: true, cacheSizeBytes: 10_485_760 } // 10MB cap
    : { cacheSizeBytes: 10_485_760 };
  db = initializeFirestore(app, firestoreSettings);
} catch (e) {
  console.warn('initializeFirestore failed, using getFirestore fallback:', e);
  db = getFirestore(app) as any;
}
export { db };


import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';

export const isNativePlatform = Capacitor.isNativePlatform();
import { logAuthAudit } from './authLogger';

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const loginWithGoogle = async () => {
  try {
    if (isNativePlatform) {
      // ─── Native Android / iOS path ───────────────────────────────────────
      // Uses native Google Sign-In SDK → returns idToken → Firebase credential
      // Bypasses Firebase authDomain/web-redirect entirely (no unauthorized-domain)
      console.log('Auth: Starting native Google Sign-In (Capacitor)');
      try { await GoogleAuth.initialize(); } catch (e) { console.log('Init error:', e); }
      logAuthAudit({ provider: 'google', channel: 'android', stage: 'attempt', message: 'Starting native Google Sign-In (Capacitor)' });
      const googleUser = await GoogleAuth.signIn();
      const credential = GoogleAuthProvider.credential(
        googleUser.authentication.idToken
      );
      const res = await signInWithCredential(auth, credential);
      logAuthAudit({ provider: 'google', channel: 'android', stage: 'success', message: 'Native Google Sign-In completed successfully' });
      return res;
    } else {
      // ─── Web path (browser only) ──────────────────────────────────────────
      const isMobileBrowser = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      console.log(`Auth: loginWithGoogle triggered. isMobileBrowser=${isMobileBrowser}, url=${window.location.href}`);
      if (isMobileBrowser) {
        console.log('Auth: Starting Google Login (REDIRECT)');
        logAuthAudit({ provider: 'google', channel: 'web', stage: 'redirect_start', message: 'Starting web redirect flow' });
        return await signInWithRedirect(auth, googleProvider);
      } else {
        console.log('Auth: Starting Google Login (POPUP)');
        logAuthAudit({ provider: 'google', channel: 'web', stage: 'redirect_start', message: 'Starting web popup flow' });
        const res = await signInWithPopup(auth, googleProvider);
        logAuthAudit({ provider: 'google', channel: 'web', stage: 'success', message: 'Web popup flow completed successfully' });
        return res;
      }
    }
  } catch (error: any) {
    console.error('Auth Error Details:', error.code, error.message);
    logAuthAudit({ 
      provider: 'google', 
      channel: isNativePlatform ? 'android' : 'web', 
      stage: 'failure', 
      message: error.message || String(error), 
      code: error.code 
    });
    if (error.code === 'auth/popup-blocked') {
      throw new Error('Браузер заблокировал всплывающее окно. Разрешите попапы для этого сайта и попробуйте снова.');
    }
    if (error.code === 'auth/popup-closed-by-user') {
      throw new Error('Окно входа было закрыто');
    }
    if (error.code === 'auth/unauthorized-domain') {
      throw new Error('Домен не авторизован в Firebase. Пожалуйста, проверьте настройки!');
    }
    throw error;
  }
};
export const loginWithEmail = (e: string, p: string) => signInWithEmailAndPassword(auth, e, p);
export const registerWithEmail = (e: string, p: string) => createUserWithEmailAndPassword(auth, e, p);
export const logout = () => signOut(auth);
export { getRedirectResult, signInAnonymously, signInWithCustomToken };

import { collection, query, where, getDocs, limit } from 'firebase/firestore';

export const findUserByTelegramId = async (tgId: number) => {
  const q = query(collection(db, 'users'), where('telegramId', '==', tgId), limit(1));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const d = snapshot.docs[0];
  return { id: d.id, ...d.data() };
};

export const findUserByEmail = async (email: string) => {
  const q = query(collection(db, 'users'), where('email', '==', email), limit(1));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const d = snapshot.docs[0];
  return { id: d.id, ...d.data() };
};

export const getUserData = async (userId: string) => {
  const d = await getDoc(doc(db, 'users', userId));
  return d.exists() ? d.data() : null;
};

function stripUndefined(obj: any): any {
  if (Array.isArray(obj)) return obj.map(v => stripUndefined(v));
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => [k, stripUndefined(v)])
    );
  }
  return obj;
}

export const saveUserData = async (userId: string, data: any, counters?: { voice?: number, image?: number }) => {
  const finalData = stripUndefined({ ...data });
  if (counters?.voice) finalData.voice_count = increment(counters.voice);
  if (counters?.image) finalData.image_count = increment(counters.image);
  await setDoc(doc(db, 'users', userId), finalData, { merge: true });
};

export const updateUserCounters = async (userId: string, counters: { voice?: number, image?: number }) => {
  const updateData: any = {};
  if (counters.voice) updateData.voice_count = increment(counters.voice);
  if (counters.image) updateData.image_count = increment(counters.image);
  await setDoc(doc(db, 'users', userId), updateData, { merge: true });
};
