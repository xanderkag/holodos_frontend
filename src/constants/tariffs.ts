export interface Tariff {
  id: 'free' | 'pro';
  label: string;
  photoLimit: number; // daily
  voiceLimit: number; // daily
  priority: 'normal' | 'priority';
  hasVoice: boolean;
  paywallText: string;
}

export const TARIFFS: Record<string, Tariff> = {
  free: {
    id: 'free',
    label: 'Бесплатный',
    photoLimit: 10,
    voiceLimit: 30,
    priority: 'normal',
    hasVoice: true,
    paywallText: 'Вы исчерпали дневной лимит (10 фото / 30 голосовых). Перейдите на Pro для 20 фото и 100 голосовых в день!'
  },
  pro: {
    id: 'pro',
    label: 'Professional',
    photoLimit: 20,
    voiceLimit: 100,
    priority: 'priority',
    hasVoice: true,
    paywallText: 'Дневной лимит Pro-аккаунта (20 фото / 100 голосовых) достигнут. Приходите завтра!'
  }
};
