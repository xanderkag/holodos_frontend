import type { UserData } from '../types';
import { TARIFFS } from '../constants/tariffs';
import type { Tariff } from '../constants/tariffs';

export interface UsageStatus {
  allowed: boolean;
  remaining: number;
  limit: number;
  reason?: string;
  paywallText?: string;
  priority: 'normal' | 'priority';
}

export const getActiveTariff = (user: Partial<UserData>): Tariff => {
  const type = user.subscriptionType || 'free';
  return TARIFFS[type] || TARIFFS.free;
};

export const checkUsage = (user: Partial<UserData>, type: 'image' | 'voice'): UsageStatus => {
  const tariff = getActiveTariff(user);
  const currentUsage = user.stats?.[type]?.d || 0;
  const limit = type === 'image' ? tariff.photoLimit : tariff.voiceLimit;
  
  const allowed = currentUsage < limit;
  const remaining = Math.max(0, limit - currentUsage);

  return {
    allowed,
    remaining,
    limit,
    reason: allowed ? undefined : 'limit_reached',
    paywallText: allowed ? undefined : tariff.paywallText,
    priority: tariff.priority
  };
};

export const getUserSubscriptionInfo = (user: Partial<UserData>) => {
  const tariff = getActiveTariff(user);
  const imageStatus = checkUsage(user, 'image');
  const voiceStatus = checkUsage(user, 'voice');

  return {
    isSubscribed: user.isSubscribed || false,
    status: user.subscriptionStatus || 'free',
    tariffLabel: tariff.label,
    tariffId: tariff.id,
    limits: {
      photos: { used: user.stats?.image?.d || 0, limit: tariff.photoLimit, remaining: imageStatus.remaining },
      voice: { used: user.stats?.voice?.d || 0, limit: tariff.voiceLimit, remaining: voiceStatus.remaining }
    },
    priority: tariff.priority
  };
};
