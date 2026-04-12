import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { auth, loginWithGoogle, logout as firebaseLogout, saveUserData, signInWithCustomToken, isNativePlatform } from '../utils/firebase';
import { onAuthStateChanged, getRedirectResult } from 'firebase/auth';
import { App as CapApp } from '@capacitor/app';
import { useTelegram } from '../hooks/useTelegram';
import { mapAuthErrorToMessage } from '../utils/auth';
import { logAuthAudit } from '../utils/authLogger';

interface AuthContextType {
  user: any; // Using any to support both Firebase User and TG User
  loading: boolean;
  login: () => Promise<void>;
  loginWithTelegramWidget: (tgUser: any) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isTMA: boolean;
  authError: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const signingInRef = useRef(false); // prevents onAuthStateChanged null-flash during sign-in
  const { tg, user: tgUser, ready, expand, initData } = useTelegram(); // initData exposed v3.15.0

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  const loginWithTelegramWidget = useCallback(async (tgUserData: any) => {
    setLoading(true);
    setAuthError(null);
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
      console.log("Auth: Getting custom token via telegram backend...");
      
      // New Contract v3.15.0: Supporting source and raw initData
      const payload = tgUserData.hash 
        ? tgUserData // Widget (classic)
        : { source: 'tma', initData, user: tgUserData }; // TMA (secure)

      const response = await fetch(`${backendUrl}/auth/telegram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Ошибка бэкенда ${response.status}`);
      }

      const { token } = await response.json();
      const result = await signInWithCustomToken(auth, token);
      
      const fullName = tgUserData.first_name + (tgUserData.last_name ? ` ${tgUserData.last_name}` : '');
      const adminEmails = ['liapustin@gmail.com', 'a.u.lyapustin@yandex.ru'];
      const currentEmail = result.user.email;

      await saveUserData(result.user.uid, {
        telegramId: tgUserData.id,
        telegramHandle: tgUserData.username,
        displayName: fullName,
        photoURL: tgUserData.photo_url || null,
        // Mark as linked if it's one of the admin identities
        is_primary_admin: (!!currentEmail && adminEmails.includes(currentEmail)) || tgUserData.username === 'xanderkage'
      });

      logAuthAudit({ provider: 'telegram', channel: tgUserData?.hash ? 'telegram_widget' : 'telegram_miniapp', stage: 'success', message: 'Telegram authentication complete' });
      console.log("Auth: Telegram Login OK", result.user.uid);
    } catch (e: any) {
      logAuthAudit({ provider: 'telegram', channel: tgUserData?.hash ? 'telegram_widget' : 'telegram_miniapp', stage: 'failure', message: e.message || String(e), code: e.code });
      setAuthError(mapAuthErrorToMessage(e));
      throw e;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [initData]);


  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let initStarted = false;

    const initAuthSequence = async () => {
      if (initStarted) return;
      initStarted = true;

      // v3.14.1: Enhanced Diagnostics for Google Auth Redirect (The "Fact-Finding" Mission)
      const currentUrl = window.location.href;
      const currentReferrer = document.referrer;
      console.log(`Auth Trace [v3.14.1]: Initializing... URL: ${currentUrl}, Referrer: ${currentReferrer}`);

      try {
        // 1. Handle Yandex token (Priority)
        const urlParams = new URLSearchParams(window.location.search);
        const yandexToken = urlParams.get('yandex_token');
        const yandexError = urlParams.get('yandex_error');

        // Cleanup URL regardless of outcome
        if (yandexToken || yandexError) {
          window.history.replaceState({}, '', window.location.pathname);
        }

        if (yandexError) {
          const msg = `Error from Yandex redirect: ${yandexError}`;
          setAuthError(mapAuthErrorToMessage({ message: 'yandex_error', yandex_error: yandexError }));
          logAuthAudit({ provider: 'yandex', channel: 'web', stage: 'failure', message: msg, code: yandexError });
        } else if (yandexToken) {
          logAuthAudit({ provider: 'yandex', channel: 'web', stage: 'callback_received', message: 'Yandex token received via URL' });
          console.log("Auth: Processing Yandex success flow");
          signingInRef.current = true;
          try {
            const result = await signInWithCustomToken(auth, yandexToken);
            logAuthAudit({ provider: 'yandex', channel: 'web', stage: 'success', message: 'Yandex auth successful' });
            setUser(result.user);
          } catch (e: any) {
            logAuthAudit({ provider: 'yandex', channel: 'web', stage: 'failure', message: e.message || String(e), code: e.code });
            setAuthError(mapAuthErrorToMessage(e));
          } finally {
            signingInRef.current = false;
          }
        }

        // 2. Handle Google/Firebase Redirect Result
        // SKIP on native platform: getRedirectResult is not used on Capacitor Android/iOS.
        // Native Google auth goes through GoogleAuth.signIn() → signInWithCredential().
        if (!isNativePlatform) {
          try {
            console.log("Auth: Checking for Google redirect result...");
            const redirectResult = await getRedirectResult(auth);
            if (redirectResult) {
              console.log("Auth: Redirect result FOUND", redirectResult.user.uid);
              logAuthAudit({ provider: 'google', channel: 'web', stage: 'success', message: 'Google Redirect Successful' });
              setUser(redirectResult.user);
            } else {
              console.log("Auth: No Google redirect result found (Normal if manual entry or direct link)");
            }
          } catch (e: any) {
            console.error("Auth: Google redirect result error", e);
            logAuthAudit({ provider: 'google', channel: 'web', stage: 'failure', message: e.message || String(e), code: e.code });
            setAuthError(mapAuthErrorToMessage(e));
          }
        } else {
          console.log('Auth: Native platform — skipping getRedirectResult');
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
              const rootBg = isDark ? p.bg_color : '#f8f9ff'; // Clean light bg
              root.style.setProperty('--bg', p.secondary_bg_color || rootBg);
              
              if (isDark) {
                root.style.setProperty('--sf-glass-solid', p.bg_color);
                root.style.setProperty('--sf', p.bg_color);
                root.style.setProperty('--sf-glass', p.bg_color);
                root.style.setProperty('--br-glass', 'rgba(255,255,255,0.08)');
                root.style.setProperty('--border', 'rgba(255,255,255,0.06)');
              } else {
                // PURE LIGHT MODE: Whiter than white surfaces
                root.style.setProperty('--sf-glass-solid', '#ffffff');
                root.style.setProperty('--sf', '#ffffff');
                root.style.setProperty('--sf-glass', 'rgba(255, 255, 255, 0.6)');
                root.style.setProperty('--br-glass', 'rgba(0,0,0,0.05)');
                root.style.setProperty('--border', 'rgba(0,0,0,0.03)');
              }
            }
            if (p.text_color) {
              // Enforce high-contrast near-black for light theme text
              const textColor = isDark ? p.text_color : '#1c1c1e';
              root.style.setProperty('--t1', textColor);
            }
            if (p.hint_color) {
              const hintColor = isDark ? p.hint_color : '#8e8e93';
              root.style.setProperty('--t2', hintColor);
              root.style.setProperty('--t3', hintColor);
            }
            if (p.button_color) root.style.setProperty('--acc', p.button_color);
            if (p.header_color) tg.setHeaderColor(p.header_color);
          }
          
          if (tgUser) {
            console.log("Auth: TMA detected, authenticating via backend...");
            // Instead of anonymous, we use the same custom token flow as the widget
            try {
              await loginWithTelegramWidget(tgUser);
            } catch (e: any) {
              logAuthAudit({ provider: 'telegram', channel: 'telegram_miniapp', stage: 'failure', message: e.message || String(e), code: e.code });
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

      } catch (err: any) {
        logAuthAudit({ stage: 'failure', message: `Global init error: ${err.message || String(err)}`, code: err.code });
        if (mountedRef.current) setLoading(false);
      }
    };

    initAuthSequence();

    // ── App URL Open listener (Android deep links) ──────────────────────────
    // Handles return from Yandex OAuth when backend redirects to:
    //   holodos://auth?yandex_token=xxx   (custom scheme, future)
    //   https://app.holodos.su?yandex_token=xxx  (App Link, current)
    // Backend Yandex deep link is a separate backend task — not yet implemented.
    // This listener is ready to receive the callback when backend is updated.
    let appUrlListener: any = null;
    if (isNativePlatform) {
      CapApp.addListener('appUrlOpen', async (event: { url: string }) => {
        console.log('Auth: appUrlOpen received:', event.url);
        try {
          const url = new URL(event.url);
          const yandexToken = url.searchParams.get('yandex_token');
          const yandexError = url.searchParams.get('yandex_error');

          if (yandexToken) {
            console.log('Auth: Processing Yandex token from deep link');
            signingInRef.current = true;
            try {
              logAuthAudit({ provider: 'yandex', channel: 'android', stage: 'callback_received', message: 'Yandex token received via AppUrlOpen' });
              const result = await signInWithCustomToken(auth, yandexToken);
              logAuthAudit({ provider: 'yandex', channel: 'android', stage: 'success', message: 'Yandex native auth successful' });
              if (mountedRef.current) setUser(result.user);
            } catch (e: any) {
              logAuthAudit({ provider: 'yandex', channel: 'android', stage: 'failure', message: e.message || String(e), code: e.code });
              if (mountedRef.current) setAuthError(mapAuthErrorToMessage(e));
            } finally {
              signingInRef.current = false;
            }
          } else if (yandexError) {
            console.error('Auth: Yandex error from deep link:', yandexError);
            logAuthAudit({ provider: 'yandex', channel: 'android', stage: 'failure', message: `Yandex deep link error: ${yandexError}` });
            if (mountedRef.current) {
              setAuthError(mapAuthErrorToMessage({ message: 'yandex_error', yandex_error: yandexError }));
            }
          }
        } catch (e) {
          console.error('Auth: Failed to parse appUrlOpen URL:', e);
        }
      }).then((handle: any) => { appUrlListener = handle; });
    }

    return () => {
      if (unsubscribe) unsubscribe();
      if (appUrlListener) appUrlListener.remove();
    };
  }, [tg, tgUser, ready, expand, loginWithTelegramWidget]);



  const login = async () => {
    signingInRef.current = true;
    setAuthError(null);
    try {
      const result = await loginWithGoogle();
      if (result?.user) {
        setUser(result.user);
      }
    } catch (e: any) {
      logAuthAudit({ provider: 'google', channel: isNativePlatform ? 'android' : 'web', stage: 'failure', message: e.message || String(e), code: e.code });
      setAuthError(mapAuthErrorToMessage(e));
    } finally {
      signingInRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  };

  const logout = async () => {
    await firebaseLogout();
    setUser(null);
  };

  const adminEmails = ['liapustin@gmail.com', 'a.u.lyapustin@yandex.ru'];
  const adminHandles = ['xanderkage'];
  const isAdmin = adminEmails.includes(user?.email) || adminHandles.includes(user?.telegramHandle) || adminHandles.includes(user?.username);
  const isTMA = !!tg;

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithTelegramWidget, logout, isAdmin, isTMA, authError }}>
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
