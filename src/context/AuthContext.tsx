import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { auth, loginWithGoogle, logout as firebaseLogout, findUserByTelegramId, saveUserData, signInAnonymously, signInWithCustomToken } from '../utils/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useTelegram } from '../hooks/useTelegram';

interface AuthContextType {
  user: any; // Using any to support both Firebase User and TG User
  loading: boolean;
  login: () => Promise<void>;
  loginWithTelegramWidget: (tgUser: any) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isTMA: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const signingInRef = useRef(false); // prevents onAuthStateChanged null-flash during sign-in
  const { tg, user: tgUser, ready, expand } = useTelegram(); // ready/expand used in TMA path

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  const syncTelegramUser = useCallback(async () => {
    if (!tgUser) return;

    try {
      let existing: any = await findUserByTelegramId(tgUser.id);
      const currentUser = auth.currentUser;

      const fullName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ');

      if (currentUser && !currentUser.isAnonymous) {
        // CASE A: Already logged in via Google. Link TG → Google account.
        const tgDocUid = existing?.id || `tg_${tgUser.id}`;

        // Save linkedUid on TG doc so next TG login uses Google's data
        await saveUserData(tgDocUid, {
          telegramId: tgUser.id,
          telegramHandle: tgUser.username,
          displayName: fullName,
          photoURL: tgUser.photo_url || null,
          linkedUid: currentUser.uid,
        });

        // Update Google account with TG info
        await saveUserData(currentUser.uid, {
          telegramId: tgUser.id,
          telegramHandle: tgUser.username,
          displayName: fullName,
          photoURL: tgUser.photo_url || currentUser.photoURL,
        });

        setUser({
          ...currentUser,
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.displayName || fullName,
          photoURL: currentUser.photoURL || tgUser.photo_url,
          isTelegram: true,
          tgId: tgUser.id,
          telegramHandle: tgUser.username
        });
        console.log("Auth: Linked Telegram to active Firebase account", fullName);
        return;
      }

      // CASE B: TG-only login
      if (existing) {
        // If this TG account is linked to a Google account — use Google's UID for data
        const effectiveUid = existing.linkedUid || existing.id;
        setUser({
          uid: effectiveUid,
          email: existing.email || `${tgUser.username || tgUser.id}@telegram`,
          displayName: fullName,
          photoURL: tgUser.photo_url || existing.photoURL,
          isTelegram: true,
          tgId: tgUser.id,
          telegramHandle: tgUser.username
        });
      } else {
        const newUid = `tg_${tgUser.id}`;
        const newUserData = {
          telegramId: tgUser.id,
          telegramHandle: tgUser.username,
          displayName: fullName,
          photoURL: tgUser.photo_url,
          email: `${tgUser.username || tgUser.id}@telegram`,
          createdAt: Date.now()
        };
        await saveUserData(newUid, newUserData);
        setUser({ uid: newUid, ...newUserData, isTelegram: true });
      }
    } catch (e: any) {
      console.error('TMA Auth Error:', e);
      alert(`Ошибка Telegram: ${e.message || 'Unknown error'}`);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [tgUser]);

  useEffect(() => {
    // Telegram MiniApp path
    if (tg) {
      ready();
      expand();
      document.documentElement.classList.add('telegram-miniapp');

      if (!auth.currentUser) {
        signInAnonymously(auth).catch((e) => {
          console.error("Auth: TMA Anonymous sign-in failed", e);
        });
      }

      if (tgUser) {
        console.log("Auth: Syncing TMA User");
        syncTelegramUser();
      } else {
        setLoading(false);
      }
      return;
    }

    // Web path — handle Yandex callback token if present
    const urlParams = new URLSearchParams(window.location.search);
    const yandexToken = urlParams.get('yandex_token');
    const yandexError = urlParams.get('yandex_error');
    if (yandexToken || yandexError) {
      window.history.replaceState({}, '', window.location.pathname);
    }

    let unsubscribe: (() => void) | null = null;

    const startAuthListener = () => {
      unsubscribe = onAuthStateChanged(auth, (u) => {
        if (signingInRef.current) return;
        setUser(u);
        if (u) localStorage.setItem('auth_uid', u.uid);
        setLoading(false);
        console.log("Auth: State →", u?.uid || 'null');
      });
    };

    if (yandexToken) {
      // Yandex: sign in first, THEN start listener — prevents null flash
      console.log("Auth: Signing in with Yandex custom token");
      signingInRef.current = true;
      signInWithCustomToken(auth, yandexToken)
        .then((result) => {
          console.log("Auth: Yandex OK", result.user.uid);
          setUser(result.user);
          setLoading(false);
          signingInRef.current = false;
          startAuthListener();
        })
        .catch((e) => {
          console.error("Auth: Yandex token failed", e);
          signingInRef.current = false;
          startAuthListener();
        });
    } else {
      startAuthListener();
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [tg, tgUser, syncTelegramUser]);

  useEffect(() => {
    if (tg && tg.themeParams) {
      const p = tg.themeParams;
      const root = document.documentElement;
      if (p.bg_color) {
        root.style.setProperty('--sf-glass-solid', p.bg_color);
        root.style.setProperty('--sf', p.bg_color);          // fixes item rows
        root.style.setProperty('--sf-glass', p.bg_color);
        root.style.setProperty('--br-glass', 'rgba(255,255,255,0.08)');
        root.style.setProperty('--border', 'rgba(255,255,255,0.06)');
      }
      if (p.secondary_bg_color) root.style.setProperty('--bg', p.secondary_bg_color);
      if (p.text_color) root.style.setProperty('--t1', p.text_color);
      if (p.hint_color) {
        root.style.setProperty('--t2', p.hint_color);
        root.style.setProperty('--t3', p.hint_color);
      }
      if (p.button_color) root.style.setProperty('--acc', p.button_color);

      // Update header color to match
      if (p.header_color) tg.setHeaderColor(p.header_color);
    }
  }, [tg]);

  const loginWithTelegramWidget = async (tgUserData: any) => {
    setLoading(true);
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
      console.log("Auth: Getting custom token from backend...");
      
      const response = await fetch(`${backendUrl}/auth/telegram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tgUserData),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Ошибка бэкенда ${response.status}`);
      }

      const { token } = await response.json();
      console.log("Auth: Received custom token, signing in...");

      const result = await signInWithCustomToken(auth, token);
      
      // Update/Sync profile in Firestore (safely authenticated now)
      const fullName = tgUserData.first_name + (tgUserData.last_name ? ` ${tgUserData.last_name}` : '');
      await saveUserData(result.user.uid, {
        telegramId: tgUserData.id,
        telegramHandle: tgUserData.username,
        displayName: fullName,
        photoURL: tgUserData.photo_url || null,
        // email is handled by backend or default
      });

      console.log("Auth: Telegram Login OK", result.user.uid);
    } catch (e: any) {
      console.error('Widget Auth Error:', e);
      alert(`Ошибка авторизации Telegram: ${e.message || 'Unknown error'}`);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  const login = async () => {
    signingInRef.current = true;
    try {
      const result = await loginWithGoogle();
      if (result?.user) {
        setUser(result.user);
        setLoading(false);
      }
    } finally {
      // Allow onAuthStateChanged to resume after popup resolves
      signingInRef.current = false;
    }
  };

  const logout = async () => {
    await firebaseLogout();
    setUser(null);
  };

  const botName = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'xanderkage';
  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL || 'liapustin@gmail.com';
  const isAdmin = user?.email === adminEmail || user?.telegramHandle === botName;
  const isTMA = !!tg;

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithTelegramWidget, logout, isAdmin, isTMA }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
