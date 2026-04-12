/** 
 * HOLODOS AI: Официальная адресная карта (v3.11.0)
 * Здесь мы фиксируем все URL проекта, чтобы не было путаницы между хостингами.
 */

// Основной домен (Production)
export const PROD_URL = 'https://holodos.su'; 

// Тестовый домен на Firebase (Staging / "Web-hosting")
export const STAGING_URL = 'https://holodos-staging-6ff24.web.app';

// Случайный домен на Firebase (не использовать)
export const OBSOLETE_FIREBASE_URL = 'https://holodos-6ff24.web.app';

// Тестовый домен на Vercel (Staging)
export const APP_STAGING_URL = 'https://app-staging.holodos.su';

// Текущий адрес приложения (определяется автоматически)
export const APP_URL = window.location.hostname.includes('app-staging') 
  ? APP_STAGING_URL 
  : (window.location.hostname.includes('holodos.su') ? PROD_URL : PROD_URL);

// Вебхуки n8n
export const N8N_BASE_URL = 'https://n8n.chevich.com';
