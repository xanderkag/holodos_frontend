import { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { useData } from './DataContext';
import { useAuth } from './AuthContext';
import { analyzeImage as apiAnalyzeImage } from '../utils/ai';
import { apiPost } from '../utils/api';
import { logAiAudit } from '../utils/aiLogger';
import { showToast } from '../components/Toast';
import { uid, mergeItems, classify, norm } from '../utils/data';
import { logDiagnostic } from '../utils/ai';
import type { AiAction, Message, AiResponse } from '../types';
import { checkUsage } from '../utils/subscription';

interface AiContextType {
  isAiLoading: boolean;
  analyzeImage: (base64: string, tab?: string) => Promise<void>;
  sendChatCommand: (text: string) => Promise<void>;
  applyActions: (res: AiResponse) => Promise<void>;
  executeOption: (messageId: string, option: any) => Promise<void>;
  pendingActions: AiAction[];
  setPendingActions: (actions: AiAction[]) => void;
  activeUndos: string[];
  undoAction: (msgId: string) => void;
  handleLimitError: (message: string) => void;
}

const AiContext = createContext<AiContextType | undefined>(undefined);

export function AiProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { 
    list, setList, stock, setStock, baseline, setBaseline, 
    diary, setDiary, messages, setMessages, incrementStat,
    addLogEvent, saveAll, addSystemMessage,
    stats, isSubscribed, subscriptionType,
    syncBackendSubscription
  } = useData();

  const [isAiLoading, setIsAiLoading] = useState(false);
  const [pendingActions, setPendingActions] = useState<AiAction[]>([]);
  
  // Undo System States
  const [activeUndos, setActiveUndos] = useState<string[]>([]);
  const undoBackups = useRef<Map<string, { list: any[]; stock: any[]; baseline: any[]; diary: any[] }>>(new Map());

  const handleLimitError = useCallback((message: string) => {
    setMessages(prev => [...prev, { 
      id: Date.now().toString(), 
      role: 'system', 
      content: message, 
      timestamp: Date.now() 
    }]);
    addLogEvent(`⚠️ ${message}`, 'ai');
    showToast(message);
  }, [setMessages, addLogEvent]);

  const undoAction = useCallback((msgId: string) => {
    const backup = undoBackups.current.get(msgId);
    if (!backup) return;
    
    // Restore states
    setList(backup.list);
    setStock(backup.stock);
    setBaseline(backup.baseline);
    if (setDiary) setDiary(backup.diary);
    
    // Modify message to show it was undone
    setMessages(prev => prev.map(m => 
      m.id === msgId ? { ...m, content: '❌ Действие отменено пользователем', type_info: 'undo', isUndoable: false, actions: [] } : m
    ));
    
    // Clear from active undos
    setActiveUndos(prev => prev.filter(id => id !== msgId));
    undoBackups.current.delete(msgId);
    
    showToast("Отменено");
    addLogEvent("Пользователь отменил действие ИИ", "remove");
    setTimeout(() => saveAll(), 200);
  }, [setList, setStock, setBaseline, setDiary, setMessages, saveAll, addLogEvent]);

  const executeActions = useCallback((actions: AiAction[], messageId?: string) => {
    let currentList = [...list];
    let currentStock = [...stock];
    let currentBaseline = [...baseline];
    let currentDiary = [...(diary || [])];
    const summaries: string[] = [];

    const getTargetName = (t: string) => {
      switch(t) {
        case 'stock': return 'Холодос';
        case 'baseline': return 'Базу';
        case 'diary': return 'Дневник';
        case 'list': return 'Покупки';
        default: return 'Список';
      }
    };
    
    actions.forEach(action => {
      const { type, target, items, from, to } = action;
      if (type === 'noop') {
        if (items && items.length > 0) {
          summaries.push(`Пропустил (уже в "${getTargetName(target || 'stock' as any)}"): ${items.map(n => n.name).join(', ')}`);
        }
        return;
      }
      
      const getTargetState = (t: string) => 
        t === 'stock' ? currentStock : 
        t === 'baseline' ? currentBaseline : 
        t === 'diary' ? currentDiary : 
        currentList;

      const setTargetState = (t: string, s: any[]) => {
        if (t === 'stock') currentStock = s;
        else if (t === 'baseline') currentBaseline = s;
        else if (t === 'diary') currentDiary = s;
        else currentList = s;
      };

      if (type === 'remove_all' && target) {
        setTargetState(target, []);
        summaries.push(`Список "${getTargetName(target)}" очищен`);
        return;
      }

      if (type === 'move' && from && to && items) {
        const fromState = getTargetState(from);
        const toState = getTargetState(to);
        const itemNames = items.map(i => norm(i.name));
        setTargetState(from, fromState.filter(it => !itemNames.includes(norm(it.name))));
        const toAdd = items.map((it: any) => {
          const item = { 
            id: it.id || uid(), 
            name: it.name || '', 
            cat: it.cat || (classify(it.name || '')).cat || 'Другое', 
            isChecked: it.isChecked || false, 
            qty: it.qty || '1',
            updatedAt: Date.now()
          } as any;
          if (to === 'diary') {
            item.consumedAt = Date.now();
            const hr = new Date().getHours();
            item.mealType = hr < 11 ? 'breakfast' : hr < 16 ? 'lunch' : hr < 21 ? 'dinner' : 'snack';
            if (messageId) item.chatMessageId = messageId;
            item.needsClarification = it.needsClarification || false;
            item.clarificationField = it.clarificationField;
            item.clarificationHint = it.clarificationHint;
            item.confidence = it.confidence || 1.0;
          }
          return item;
        });
        setTargetState(to, mergeItems(toState, toAdd));
        summaries.push(`Переложил ${items.map(i => i.name).join(', ')} из "${getTargetName(from)}" в "${getTargetName(to)}"`);
        return;
      }

      if (!target || !items) return;
      const state = getTargetState(target);
      let newState = [...state];

      if (type === 'add') {
        const toAdd = items.map((it: any) => {
          const item = { 
            id: it.id || uid(), 
            name: it.name || '', 
            cat: it.cat || (classify(it.name || '')).cat || 'Другое', 
            isChecked: it.isChecked || false, 
            qty: it.qty || '1',
            updatedAt: Date.now()
          } as any;
          if (target === 'diary') {
            item.consumedAt = Date.now();
            const hr = new Date().getHours();
            item.mealType = hr < 11 ? 'breakfast' : hr < 16 ? 'lunch' : hr < 21 ? 'dinner' : 'snack';
            if (messageId) item.chatMessageId = messageId;
            item.needsClarification = it.needsClarification || false;
            item.clarificationField = it.clarificationField;
            item.clarificationHint = it.clarificationHint;
            item.confidence = it.confidence || 1.0;
          }
          return item;
        });
        newState = mergeItems(newState, toAdd);
        summaries.push(`+ ${items.map(i => i.name).join(', ')} в "${getTargetName(target)}"`);
      } else if (type === 'remove') {
        const lowerNames = items.map(n => n.name?.toLowerCase());
        newState = newState.filter(it => !lowerNames.includes(it.name.toLowerCase()));
        summaries.push(`Удалил ${items.map(n => n.name).join(', ')} из "${getTargetName(target)}"`);
      } else if (type === 'check') {
        const lowerNames = items.map(n => n.name?.toLowerCase());
        newState = newState.map(it => lowerNames.includes(it.name.toLowerCase()) ? { ...it, isChecked: true } : it);
        summaries.push(`Отметил ${items.map(n => n.name).join(', ')} как купленное`);
      } else if (type === 'uncheck') {
        const lowerNames = items.map(n => n.name?.toLowerCase());
        newState = newState.map(it => lowerNames.includes(it.name.toLowerCase()) ? { ...it, isChecked: false } : it);
        summaries.push(`Снял галочку с ${items.map(n => n.name).join(', ')}`);
      } else if ((type as string) === 'skip' || (type as string) === 'noop') {
        summaries.push(`Уже в "${getTargetName(target)}": ${items.map(n => n.name).join(', ')}`);
      }

      setTargetState(target, newState);
    });

    return { 
      summaries, 
      nextList: currentList, 
      nextStock: currentStock, 
      nextBaseline: currentBaseline,
      nextDiary: currentDiary
    };
  }, [list, stock, baseline, diary]);

  const applyActions = useCallback(async (res: any) => {
    if (!res) return;
    
    const actions = res.actions || [];
    const hasValidActions = Array.isArray(actions) && actions.length > 0;
    
    if (!hasValidActions) {
      if (res.feedback) {
        showToast("💬 Получен ответ от ИИ (в чате)");
      } else {
        logDiagnostic('CHAT: Empty response from backend, no feedback or actions. Ignored.', 'error');
        showToast("⚠️ ИИ не смог распознать данные");
        addSystemMessage("⚠️ ИИ не нашел параметров или продуктов для добавления", "system");
        return;
      }
    }
    
    const generatedMsgId = uid();
    
    // Snapshot for Undo mechanism
    const backupState = {
      list: [...list],
      stock: [...stock],
      baseline: [...baseline],
      diary: [...(diary || [])]
    };
    
    // BULK PROTECT: Force confirmation for sensitive or large operations
    const isSensitive = actions.some((a: any) => 
      a.type === 'remove_all' || 
      (a.type === 'move' && a.items && a.items.length > 3) ||
      (a.type === 'remove' && a.items && a.items.length > 5)
    );

    if (res.requiresConfirmation || isSensitive) {
      setPendingActions(actions);
      showToast(isSensitive ? "⚠️ Требуется подтверждение для массового действия" : "🔐 Требуется подтверждение");
      return;
    }

    const sanitizedActions = (res.actions || []).map((action: any) => {
      if (!action.items) return action;
      return {
        ...action,
        items: action.items.map((item: any) => {
          let name = item.name || 'Продукт';
          const n = name.toLowerCase();
          const pPatterns = ['упаковка', 'контейнер', 'пластиковая', 'пакет', 'банка', 'коробка'];
          const isGeneric = pPatterns.some(p => n.includes(p)) && n.split(' ').length <= 3;
          
          if (isGeneric) name = `❓ ${name} (уточни)`;
          
          let qty = '1';
          if (item.qty) qty = String(item.qty);
          else if ((item as any).quantity) qty = String((item as any).quantity);
          
          return { ...item, name, qty };
        })
      };
    });

    const { summaries, nextList, nextStock, nextBaseline, nextDiary } = executeActions(sanitizedActions, generatedMsgId);
    
    const feedbackStr = typeof res.feedback === 'string' ? res.feedback : "Команда выполнена";
    const detailedFeedback = summaries.length > 0
      ? `${feedbackStr}\n\n${summaries.join('.\n')}`
      : feedbackStr;

    const isDiaryAction = sanitizedActions.some((a: any) => a.target === 'diary' || a.from === 'diary' || a.to === 'diary');

    const newAssistantMsg: Message = {
      id: generatedMsgId,
      role: 'assistant',
      content: detailedFeedback,
      timestamp: Date.now(),
      type: isDiaryAction ? 'diary' : 'ai_vision',
      isUndoable: summaries.length > 0,
      diaryEntryId: isDiaryAction ? generatedMsgId : undefined,
      diarySource: isDiaryAction ? (res.source || 'text') : undefined,
    };

    setList(nextList);
    setStock(nextStock);
    setBaseline(nextBaseline);
    if (setDiary) setDiary(nextDiary);
    setMessages(prev => {
      const newList = [...prev, { ...newAssistantMsg, actions: res.actions, suggestions: res.suggestions }];
      logDiagnostic(`CHAT: applyActions finished. Msg ID: ${newAssistantMsg.id}, Total now: ${newList.length}`, 'info');
      logDiagnostic(`CHAT Content Preview: "${newAssistantMsg.content.substring(0, 40)}..."`, 'info');
      return newList;
    });

    if (summaries.length > 0) {
      addLogEvent(`🤖 ИИ: ${summaries.join('. ')}`, 'ai');
      
      // Register Undo timeout
      undoBackups.current.set(generatedMsgId, backupState);
      setActiveUndos(prev => [...prev, generatedMsgId]);
      setTimeout(() => {
        setActiveUndos(prev => prev.filter(id => id !== generatedMsgId));
        undoBackups.current.delete(generatedMsgId);
      }, 15000);
    }
    
    if (hasValidActions) {
      showToast("✅ Действие выполнено");
    }
    
    // Urgent save to Firebase to prevent data loss on high-latency snapshots
    setTimeout(() => saveAll(), 200);
  }, [executeActions, setBaseline, setList, setMessages, setStock, setDiary, saveAll, addLogEvent]);

  const executeOption = useCallback(async (messageId: string, option: any) => {
    const { nextList, nextStock, nextBaseline, nextDiary } = executeActions([option.action]);
    
    setList(nextList);
    setStock(nextStock);
    setBaseline(nextBaseline);
    if (setDiary) setDiary(nextDiary);
    
    setMessages(prev => prev.map(m => {
      if (m.id === messageId) {
        let newActions = m.actions;
        if (option.skipIndex !== undefined && newActions) {
          newActions = [...newActions];
          newActions[option.skipIndex] = { ...newActions[option.skipIndex], applied: true };
        }
        return { ...m, suggestions: [], actions: newActions };
      }
      return m;
    }));
    
    showToast("✨ Выбор принят");
    addLogEvent(`Выбор из чата: ${option.label}`, 'check');
    saveAll();
  }, [executeActions, setBaseline, setList, setMessages, setStock, setDiary, saveAll, addLogEvent]);

  const analyzeImage = async (base64: string, tab: string = 'unknown') => {
    if (!user || isAiLoading) return;
    
    const usage = checkUsage({ stats, isSubscribed, subscriptionType } as any, 'image');
    if (!usage.allowed) {
      showToast(usage.paywallText || "Лимит фото исчерпан");
      addLogEvent(`⚠️ Лимит фото исчерпан (${usage.limit}/${usage.limit})`, 'ai');
      return;
    }

    setIsAiLoading(true);
    addSystemMessage('📷 Отправлено фото. Анализирую...', 'system');
    showToast("✨ Анализирую фото...");
    try {
      const result = await apiAnalyzeImage(
        base64, user.email || 'unknown', user.uid, tab, 
        list, stock, diary, baseline, usage.priority
      );
      if (result) {
        result.source = 'photo';
        if (result.subscription) {
          // Backend sent authoritative usage snapshot — use it, skip local increment
          syncBackendSubscription(result.subscription);
        } else {
          // Fallback: backend didn't return subscription data yet, increment locally
          incrementStat('image');
        }
        await applyActions(result);
      }
    } catch (err: any) {
      if (err?.code === 'timeout' || err?.message === 'Failed to fetch') {
        showToast('⏳ Проблема со связью. Сервер не ответил, попробуйте еще раз');
        addLogEvent('⚠️ Фото не отправлено из-за обрыва связи', 'ai');
        addSystemMessage('⚠️ Фото не было проанализировано из-за обрыва связи', 'system');
        logAiAudit({ message: 'Network error or timeout during image analysis', status: 'timeout', code: err?.code || 'network_error', action: 'analyzeImage' });
      } else if (err?.status === 413 || err?.code === 'payload_too_large') {
        showToast('⚠️ Файл слишком большой. Попробуйте сжать или обрезать фото');
        addSystemMessage('⚠️ Фото слишком большое для загрузки. Попробуйте обрезать или сжать', 'system');
        logAiAudit({ message: 'Payload too large', status: '413', action: 'analyzeImage' });
      } else if (err?.name === 'ApiError' && err.status === 403 && err.code === 'limit_reached') {
        // Sync backend subscription snapshot into local state
        if (err.data?.subscription) syncBackendSubscription(err.data.subscription);
        showToast(err.message || "Лимит фото исчерпан");
        addLogEvent(`⚠️ ${err.message}`, 'ai');
      } else {
        showToast(`❌ Ошибка: ${err.message}`);
      }
    } finally {
      setIsAiLoading(false);
    }
  };

  const sendChatCommand = async (text: string) => {
    if (!text.trim() || isAiLoading) return;
    const cleanText = text.startsWith('/') ? text.substring(1).trim() : text.trim();
    
    const isVoice = !text.startsWith('/');
    if (isVoice) {
      const voiceUsage = checkUsage({ stats, isSubscribed, subscriptionType } as any, 'voice');
      if (!voiceUsage.allowed) {
        showToast(voiceUsage.paywallText || "Лимит голосовых исчерпан");
        addLogEvent(`⚠️ Лимит голоса исчерпан (${voiceUsage.limit}/${voiceUsage.limit})`, 'ai');
        return;
      }
    }

    setMessages(prev => [...prev, { id: uid(), role: 'user', content: text, timestamp: Date.now() }]);
    setIsAiLoading(true);

    try {
      const usage = isVoice 
        ? checkUsage({ stats, isSubscribed, subscriptionType } as any, 'voice')
        : { priority: 'normal' as const };
      
      logDiagnostic('CHAT: Sending text command via backend /ai/text...', 'net');
      const result = await apiPost<any>('/ai/text', {
        type: 'chat',
        text: cleanText,
        priority: usage.priority,
        userId: user?.uid,
        userEmail: user?.email,
        appUrl: window.location.origin,
        currentList: list,
        currentStock: stock,
        currentDiary: diary,
        currentBaseline: baseline,
        list: list,
        stock: stock,
        history: messages.slice(-5).map(m => ({ role: m.role, content: m.content }))
      });
      logDiagnostic('CHAT: Success received', 'net');
      if (result) {
        result.source = 'text';
        if (result.subscription) {
          // Backend sent authoritative usage snapshot — use it, skip local increment
          syncBackendSubscription(result.subscription);
        } else {
          // Fallback: backend didn't return subscription data yet, increment locally
          incrementStat(isVoice ? 'voice' : 'chat');
        }
      }
      await applyActions(result);
    } catch (err: any) {
      if (err?.code === 'timeout' || err?.message === 'Failed to fetch') {
        showToast('⏳ Проблема со связью. Сервер не ответил, попробуйте еще раз');
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'system', content: "Сообщение не отправлено из-за обрыва связи", timestamp: Date.now() }]);
        addLogEvent('⚠️ Текст не отправлен из-за обрыва связи', 'ai');
        logAiAudit({ message: 'Network error or timeout during text command', status: 'timeout', code: err?.code || 'network_error', action: 'sendChatCommand' });
      } else if (err?.status === 413 || err?.code === 'payload_too_large') {
        showToast('⚠️ Текст слишком большой');
        logAiAudit({ message: 'Payload too large', status: '413', action: 'sendChatCommand' });
      } else if (err?.name === 'ApiError' && err.status === 403 && err.code === 'limit_reached') {
        // Sync backend subscription snapshot into local state
        if (err.data?.subscription) syncBackendSubscription(err.data.subscription);
        setMessages(prev => [...prev, { 
          id: Date.now().toString(), 
          role: 'system', 
          content: err.message || "Лимит исчерпан", 
          timestamp: Date.now() 
        }]);
        addLogEvent(`⚠️ ${err.message}`, 'ai');
      } else {
        logDiagnostic(`CHAT Exception: ${err.message}`, 'error');
        showToast(`❌ Ошибка ИИ: ${err.message}`);
      }
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <AiContext.Provider value={{ 
      isAiLoading, analyzeImage, sendChatCommand, 
      applyActions, executeOption, pendingActions, setPendingActions,
      handleLimitError, activeUndos, undoAction
    }}>
      {children}
    </AiContext.Provider>
  );
}

export function useAi() {
  const context = useContext(AiContext);
  if (context === undefined) {
    throw new Error('useAi must be used within an AiProvider');
  }
  return context;
}
