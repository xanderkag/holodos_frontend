import type { Item, Message, DiaryEntry } from '../types';
import { BDEMO } from './data'; // Re-use baseline demo logic if wanted

export const isDemoMode = () => {
  if (typeof window === 'undefined') return false;
  return window.location.pathname === '/demo' || localStorage.getItem('demo_mode') === 'true';
};

export const DEMO_USER = {
  uid: 'demo_user_123',
  email: 'demo@holodos.su',
  displayName: 'Гость (Демо)',
  telegramHandle: 'demo_user',
  isDemo: true
};

export const DEMO_LIST: Item[] = [
  ...BDEMO.slice(0, 3).map(item => ({ ...item, isChecked: false, id: `dl_${item.id}` })),
  { id: 'dl_10', name: 'хлеб', cat: 'Хлеб и выпечка', qty: '1 шт', isChecked: true },
  { id: 'dl_11', name: 'вода', cat: 'Напитки', qty: '2 шт', isChecked: false }
];

export const DEMO_MESSAGES: Message[] = [
  { id: 'dm_1', role: 'assistant', content: 'Привет! Я HOLODOS. Вы находитесь в демо-режиме.\nВсе изменения сохраняются только на вашем устройстве и не синхронизируются с сервером.', timestamp: Date.now() - 10000 },
  { id: 'dm_2', role: 'user', content: 'Что можно делать в демо-режиме?', timestamp: Date.now() - 5000 },
  { id: 'dm_3', role: 'assistant', content: 'Вы можете просматривать интерфейс, добавлять продукты в "Покупки" и "Холодос", отмечать их и удалять. \n\n⚠️ Анализ фото и обработка сложных голосовых или текстовых запросов к ИИ в демо-режиме отключены, но вы можете оценить удобство ручного ввода и списков.', timestamp: Date.now() }
];

export const DEMO_DIARY: DiaryEntry[] = [];

// Mocking backend API post for demo mode
export const mockApiPost = async <T>(path: string, body: Record<string, unknown>): Promise<T> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 800));
  
  if (path === '/ai/text') {
    const text = body.text as string;
    
    // Hardcoded minimal processing for demo mode if someone really wants to type something simple
    const isAdding = text.toLowerCase().includes('добавь') || text.toLowerCase().includes('купи');
    const items = isAdding ? [{
      name: 'демо-продукт',
      qty: '1 шт',
      cat: 'Другое'
    }] : undefined;
    
    return {
      source: 'text',
      feedback: 'Это демо-режим. Запросы к ИИ обрабатываются в виде заглушки.\n\nПопробуйте полноценную версию после авторизации!',
      actions: items ? [{
        type: 'add',
        target: text.toLowerCase().includes('холодос') ? 'stock' : 'list',
        items
      }] : []
    } as T;
  }

  if (path === '/ai/image' || path === '/ai/voice') {
    return {
      source: path.includes('image') ? 'photo' : 'voice',
      feedback: 'Это демо-режим. Анализ файлов отключен.\n\nПопробуйте полноценную версию после авторизации!',
      actions: []
    } as T;
  }
  
  return {} as T;
};
