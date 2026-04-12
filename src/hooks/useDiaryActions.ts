import { useCallback } from 'react';
import { uid } from '../utils/data';
import { showToast } from '../components/Toast';
import type { DiaryEntry, MealType } from '../types';

export const useDiaryActions = (setDiary: React.Dispatch<React.SetStateAction<DiaryEntry[]>>, addSystemMessage?: (text: string, type?: string) => void) => {
  const getMealType = (): MealType => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return 'breakfast';
    if (hour >= 12 && hour < 17) return 'lunch';
    if (hour >= 17 && hour < 22) return 'dinner';
    return 'snack';
  };

  const handleAddToDiary = useCallback((item: any, specificMealType?: MealType) => {
    setDiary(prev => {
      const arr = prev || [];
      return [...arr, { ...item, id: uid(), consumedAt: Date.now(), mealType: specificMealType || getMealType() }];
    });
    const mealName = specificMealType || getMealType();
    const mealRus = mealName === 'breakfast' ? 'Завтрак' : mealName === 'lunch' ? 'Обед' : mealName === 'dinner' ? 'Ужин' : 'Перекус';
    if (addSystemMessage) {
      addSystemMessage(`🍽️ Добавлено в Дневник (${mealRus}): **${item.name}**`, 'diary');
    }
    showToast(`🍽️ ${item.name} съедено (в Дневнике)`);
  }, [setDiary, addSystemMessage]);

  const addAiEntries = useCallback((
    items: Array<{
      name: string;
      quantity?: number;
      unit?: string;
      calories?: number;
      protein?: number;
      fat?: number;
      carbs?: number;
      needsClarification?: boolean;
      clarificationField?: 'quantity' | 'unit' | 'name' | 'calories';
      clarificationHint?: string;
      confidence?: number;
    }>,
    source: 'voice' | 'photo',
    transcript?: string,
    entryId?: string,
  ): DiaryEntry[] => {
    const mealType = getMealType();
    const entries: DiaryEntry[] = items.map(item => ({
      id: uid(),
      name: item.name,
      cat: 'Другое',
      qty: item.quantity != null ? `${item.quantity} ${item.unit || 'г'}` : undefined,
      kcal: item.calories,
      protein: item.protein,
      fat: item.fat,
      carbs: item.carbs,
      consumedAt: Date.now(),
      mealType,
      source,
      sourceTranscript: transcript,
      chatMessageId: entryId,
      needsClarification: item.needsClarification,
      clarificationField: item.clarificationField,
      clarificationHint: item.clarificationHint,
      confidence: item.confidence,
    }));
    setDiary(prev => [...(prev || []), ...entries]);
    return entries;
  }, [setDiary]);

  const clarifyDiaryItem = useCallback((entryId: string, update: Partial<DiaryEntry>) => {
    setDiary(prev => prev.map(d =>
      d.id === entryId
        ? { ...d, ...update, needsClarification: false, clarificationHint: undefined }
        : d,
    ));
  }, [setDiary]);

  return { handleAddToDiary, addAiEntries, clarifyDiaryItem };
};
