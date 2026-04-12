import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { auth, loginWithGoogle, logout as firebaseLogout, saveUserData, signInWithCustomToken } from '../utils/firebase';
import { onAuthStateChanged, getRedirectResult } from 'firebase/auth';
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

  // Helper for remote logging of auth errors as requested by Backend team
  const logAuthError = useCallback((error: any, contextStr: string) => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
    console.error(`Auth Error [${contextStr}]:`, error);
    
    fetch(`${backendUrl}/api/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level: 'error',
        module: 'AuthContext',
        context: contextStr,
        message: error.message || String(error),
        code: error.code || error.reason || 'UNKNOWN_AUTH_ERROR',
        timestamp: Date.now(),
        ua: navigator.userAgent
      })
    }).catch(() => {}); // fire and forget
  }, []);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  const loginWithTelegramWidget = useCallback(async (tgUserData: any) => {
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
      logAuthError(e, 'TelegramWidgetLogin');
      alert(`Ошибка авторизации Telegram: ${e.message || 'Unknown error'}`);
      throw e;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [logAuthError]);


  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let initStarted = false;

    const initAuthSequence = async () => {
      if (initStarted) return;
      initStarted = true;

      console.log("Auth: Starting Unified Initialization Sequence...");

      try {
        // 1. Handle Yandex token (Priority)
        const urlParams = new URLSearchParams(window.location.search);
        const yandexToken = urlParams.get('yandex_token');
        if (yandexToken) {
          console.log("Auth: Processing Yandex custom token");
          window.history.replaceState({}, '', window.location.pathname);
          signingInRef.current = true;
          try {
            const result = await signInWithCustomToken(auth, yandexToken);
            setUser(result.user);
            console.log("Auth: Yandex success", result.user.uid);
          } catch (e) {
            logAuthError(e, 'YandexTokenInit');
          } finally {
            signingInRef.current = false;
          }
        }

        // 2. Handle Google/Firebase Redirect Result
        // We wait for this BEFORE removing loading state to prevent flash
        try {
          const redirectResult = await getRedirectResult(auth);
          if (redirectResult) {
            console.log("Auth: Google Redirect success", redirectResult.user.uid);
            setUser(redirectResult.user);
          }
        } catch (e) {
          logAuthError(e, 'GoogleRedirectResult');
        }

        // 3. Handle Telegram Mini App (TMA)
        if (tg) {
          ready();
          expand();
          document.documentElement.classList.add('telegram-miniapp');
          
          // Theme Sync v3.13.0
          if (tg.themeParams) {
            const p = tg.themeParams;
            const root = document.documentElement;
            const isDark = tg.colorScheme === 'dark';
            root.setAttribute('data-theme', isDark ? 'dark' : 'light');

            if (p.bg_color) {
              root.style.setProperty('--sf-glass-solid', p.bg_color);
              root.style.setProperty('--sf', p.bg_color);
              root.style.setProperty('--sf-glass', p.bg_color);
              // Adaptive borders: dark in light theme, bright in dark theme
              root.style.setProperty('--br-glass', isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)');
              root.style.setProperty('--border', isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)');
            }
            if (p.secondary_bg_color) root.style.setProperty('--bg', p.secondary_bg_color);
            if (p.text_color) root.style.setProperty('--t1', p.text_color);
            if (p.hint_color) {
              root.style.setProperty('--t2', p.hint_color);
              root.style.setProperty('--t3', p.hint_color);
            }
            if (p.button_color) root.style.setProperty('--acc', p.button_color);
            if (p.header_color) tg.setHeaderColor(p.header_color);
          }
          
          if (tgUser) {
            console.log("Auth: TMA detected, authenticating via backend...");
            // Instead of anonymous, we use the same custom token flow as the widget
            try {
              await loginWithTelegramWidget(tgUser);
            } catch (e) {
              logAuthError(e, 'TMA_BackendAuth');
            }
          }
        }

        // 4. Initialize Auth Observer
        // This will recover the persisted user session
        unsubscribe = onAuthStateChanged(auth, (u) => {
          if (signingInRef.current) return;
          console.log("Auth: Firebase connection established", u?.uid || 'guest');
          
          if (mountedRef.current) {
            setUser(u);
            if (u) localStorage.setItem('auth_uid', u.uid);
            setLoading(false); // FINALLY remove the global loading state
          }
        });

        // SAFETY VALVE: Force unlock UI if everything takes too long
        setTimeout(() => {
          if (mountedRef.current && loading) {
            console.warn("Auth: Sequence timed out, unlocking UI.");
            setLoading(false);
          }
        }, 8000);

      } catch (err) {
        logAuthError(err, 'GlobalInitSequence');
        if (mountedRef.current) setLoading(false);
      }
    };

    initAuthSequence();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [tg, tgUser, ready, expand, loginWithTelegramWidget, logAuthError]);



  const login = async () => {
    signingInRef.current = true;
    try {
      const result = await loginWithGoogle();
      if (result?.user) {
        setUser(result.user);
        if (mountedRef.current) setLoading(false);
      }
    } catch (e) {
      logAuthError(e, 'GooglePopupLogin');
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
