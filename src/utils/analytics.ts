/**
 * analytics.ts — Centralized Firebase Analytics wrapper
 *
 * All product events go through this module. In DEV mode, events are
 * printed to the console instead of being sent to Firebase, so the GA4
 * dashboard stays clean during development.
 *
 * Usage:
 *   import { track } from './analytics';
 *   track('voice_sent', { tab: 'list' });
 */

import { getAnalytics, logEvent, setUserId, setUserProperties, isSupported } from 'firebase/analytics';
import { getApps } from 'firebase/app';
import { Capacitor } from '@capacitor/core';

// Reuse the already-initialized Firebase app
const getApp = () => {
  const apps = getApps();
  if (!apps.length) throw new Error('Firebase app not initialized');
  return apps[0];
};

let analyticsInstance: ReturnType<typeof getAnalytics> | null = null;

const getAnalyticsInstance = async () => {
  if (analyticsInstance) return analyticsInstance;
  // Firebase Analytics Web SDK does NOT work in Capacitor Android/iOS WebViews.
  // isSupported() can hang or throw in this environment → skip entirely.
  if (Capacitor.isNativePlatform()) return null;
  try {
    const supported = await isSupported();
    if (!supported) return null;
    analyticsInstance = getAnalytics(getApp());
    return analyticsInstance;
  } catch {
    return null;
  }
};

// ── Core tracker ──────────────────────────────────────────────────────────────

type EventName =
  // Auth
  | 'login'            // user logged in
  | 'signup'           // new user created
  | 'logout'           // user logged out
  // AI Actions
  | 'voice_sent'       // voice command dispatched
  | 'photo_analyzed'   // image analyzed by AI
  | 'chat_sent'        // text command sent to AI
  // Data Actions
  | 'item_added'       // item added to list/stock/diary/baseline
  | 'item_removed'     // item removed from list/stock/diary/baseline
  | 'item_moved'       // item moved between lists
  | 'diary_entry_added'// food entry added to diary
  // Navigation
  | 'tab_changed'      // user switched to another tab
  // Limits
  | 'limit_hit'        // user hit a subscription limit
  | 'paywall_shown'    // paywall modal shown
  // Onboarding
  | 'onboarding_started'
  | 'onboarding_completed'
  // Crashes / Errors
  | 'ai_error';        // AI request failed

export async function track(event: EventName, params?: Record<string, string | number | boolean>): Promise<void> {
  if (import.meta.env.DEV) {
    console.log(`[Analytics] ${event}`, params || '');
    return;
  }
  try {
    const analytics = await getAnalyticsInstance();
    if (!analytics) return;
    logEvent(analytics, event as string, params);
  } catch {
    // analytics must never crash the app
  }
}

// ── Identity ──────────────────────────────────────────────────────────────────

/**
 * Call once after successful auth to associate events with the user.
 * Does NOT send PII — only the Firebase UID (opaque ID).
 */
export async function identifyUser(uid: string, props?: {
  plan?: string;
  platform?: string;
  channel?: string; // 'google' | 'telegram' | 'yandex' | 'demo'
}): Promise<void> {
  if (import.meta.env.DEV) {
    console.log(`[Analytics] identify uid=${uid}`, props || '');
    return;
  }
  try {
    const analytics = await getAnalyticsInstance();
    if (!analytics) return;
    setUserId(analytics, uid);
    if (props) {
      setUserProperties(analytics, props as Record<string, string>);
    }
  } catch {
    // noop
  }
}
