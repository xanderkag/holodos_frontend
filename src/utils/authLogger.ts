import { isNativePlatform } from './firebase';

export type AuthProvider = 'google' | 'yandex' | 'telegram';
export type AuthChannel = 'web' | 'android' | 'telegram_widget' | 'telegram_miniapp';
export type AuthStage = 'attempt' | 'redirect_start' | 'redirect_result' | 'callback_received' | 'success' | 'failure';

interface LogAuthOptions {
  message: string;
  code?: string;
  provider?: AuthProvider;
  channel?: AuthChannel;
  stage?: AuthStage;
  route?: string;
  meta?: any;
}

/**
 * Очищает токены из логов (заменяет на логи: hasToken, удаляет строковый токен)
 */
const sanitizeMeta = (meta: any) => {
  if (!meta) return undefined;
  const safeMeta = { ...meta };
  
  if (safeMeta.token) {
    safeMeta.hasToken = !!safeMeta.token;
    delete safeMeta.token;
  }
  if (safeMeta.idToken) {
    safeMeta.hasIdToken = !!safeMeta.idToken;
    delete safeMeta.idToken;
  }
  if (safeMeta.customToken) {
    safeMeta.hasCustomToken = !!safeMeta.customToken;
    delete safeMeta.customToken;
  }

  return safeMeta;
};

/**
 * Единый логгер авторизации для синхронизации с backend-аудитом
 */
export const logAuthAudit = async (options: LogAuthOptions) => {
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
  
  const payload = {
    level: options.stage === 'failure' ? 'error' : 'info',
    module: 'auth',
    context: 'client_audit',
    message: options.message,
    code: options.code || null,
    provider: options.provider || null,
    channel: options.channel || null,
    stage: options.stage || null,
    appUrl: window.location.href,
    route: options.route || window.location.pathname,
    meta: {
      ...sanitizeMeta(options.meta),
      isNativePlatform,
      referrer: document.referrer || null,
      origin: window.location.origin,
    },
    timestamp: Date.now(),
    ua: navigator.userAgent
  };

  try {
    fetch(`${backendUrl}/api/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(e => console.warn('AuthLogger: fetch failed', e));
  } catch (e) {
    console.warn('AuthLogger: catch block', e);
  }
};
