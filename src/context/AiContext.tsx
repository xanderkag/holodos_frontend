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
import { track } from '../utils/analytics';
import type { AiAction, Message, AiResponse } from '../types';
import { checkUsage } from '../utils/subscription';
import type { PaywallType } from '../components/LimitPaywallModal';

/** Android Capacitor WebView throws different network errors by firmware/Chrome version.
 *  Cover all known variants so user sees ⏳ toast instead of raw error code. */
function isNetworkError(err: any): boolean {
  const msg: string = (err?.message || '').toLowerCase();
  const name: string = (err?.name || '').toLowerCase();
  return (
    err?.code === 'timeout' ||
    err?.code === 'network_error' ||
    name === 'networkerror' ||
    (name === 'typeerror' && msg.includes('fetch')) ||
    msg.includes('failed to fetch') ||
    msg.includes('network request failed') ||
    msg.includes('err_internet_disconnected') ||
    msg.includes('err_network_changed') ||
    msg.includes('load failed') ||
    msg.includes('networkerror') ||
    msg.includes('the internet connection appears to be offline')
  );
}

interface AiContextType {
  isAiLoading: boolean;
  analyzeImage: (base64: string, tab?: string) => Promise<void>;
  sendChatCommand: (text: string) => Promise<void>;
  applyActions: (res: AiResponse) => Promise<void>;
  executeOption: (messageId: string, option: any) => Promise<void>;
  pendingActions: AiAction[];
  setPendingActions: (actions: AiAction[]) => void;
  confirmPendingAction: () => Promise<void>;
  activeUndos: string[];
  undoAction: (msgId: string) => void;
  handleLimitError: (message: string, type?: PaywallType) => void;
  paywallType: PaywallType;
  setPaywallType: (t: PaywallType) => void;
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
  const [pendingMessageId, setPendingMessageId] = useState<string | undefined>(undefined);
  const [paywallType, setPaywallType] = useState<PaywallType>(null);
  
  // Undo System States
  const [activeUndos, setActiveUndos] = useState<string[]>([]);
  const undoBackups = useRef<Map<string, { list: any[]; stock: any[]; baseline: any[]; diary: any[] }>>(new Map());
  const handleLimitError = useCallback((message: string, type: PaywallType = 'voice', subscription?: any) => {
    if (subscription) {
      syncBackendSubscription(subscription);
    }
    track('limit_hit', { type: type || 'unknown' });
    track('paywall_shown', { type: type || 'unknown' });
    setMessages(prev => [...prev, { 
      id: Date.now().toString(), 
      role: 'system', 
      content: message, 
      timestamp: Date.now() 
    }]);
    addLogEvent(`⚠️ ${message}`, 'ai');
    setPaywallType(type);
  }, [setMessages, addLogEvent, syncBackendSubscription]);

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
    
    // Phase 2: Backend Undo Hook
    apiPost('/ai/undo', { messageId: msgId, userId: user?.uid, userEmail: user?.email }).catch(err => {
      logDiagnostic(`Undo Backend Error: ${err.message}`, 'warn');
    });
    
    showToast("Отменено");
    addLogEvent("Пользователь отменил действие ИИ", "remove");
    setTimeout(() => saveAll().catch(() => {}), 200);
  }, [setList, setStock, setBaseline, setDiary, setMessages, saveAll, addLogEvent, user]);

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
            qty: it.qty || (it.quantity && it.unit ? `${it.quantity} ${it.unit}` : it.quantity ? `${it.quantity}` : '1'),
            updatedAt: Date.now()
          } as any;
          if (to === 'diary') {
            item.consumedAt = Date.now();
            // Use AI-supplied meal_type if present and not 'unknown'; fallback to time-of-day
            const aiMealType = (it as any).meal_type;
            if (aiMealType && aiMealType !== 'unknown') {
              item.mealType = aiMealType;
            } else {
              const hr = new Date().getHours();
              item.mealType = hr < 11 ? 'breakfast' : hr < 16 ? 'lunch' : hr < 21 ? 'dinner' : 'snack';
            }
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
            qty: it.qty || (it.quantity && it.unit ? `${it.quantity} ${it.unit}` : it.quantity ? `${it.quantity}` : '1'),
            kcal: it.kcal !== undefined ? it.kcal : it.calories,
            protein: it.protein,
            fat: it.fat,
            carbs: it.carbs,
            updatedAt: Date.now()
          } as any;
          if (target === 'diary') {
            item.consumedAt = Date.now();
            // Use AI-supplied meal_type if present and not 'unknown'; fallback to time-of-day
            const aiMealType = (it as any).meal_type;
            if (aiMealType && aiMealType !== 'unknown') {
              item.mealType = aiMealType;
            } else {
              const hr = new Date().getHours();
              item.mealType = hr < 11 ? 'breakfast' : hr < 16 ? 'lunch' : hr < 21 ? 'dinner' : 'snack';
            }
            if (messageId) item.chatMessageId = messageId;
            item.needsClarification = it.needsClarification || false;
            item.clarificationField = it.clarificationField;
            item.clarificationHint = it.clarificationHint;
            item.confidence = it.confidence || 1.0;
          }
          return item;
        });
        if (target === 'diary') {
          newState = [...newState, ...toAdd];
        } else {
          newState = mergeItems(newState, toAdd);
        }
        summaries.push(`+ ${items.map(i => i.name).join(', ')} в "${getTargetName(target)}"`);
        if (target === 'diary') track('diary_entry_added', { count: items.length });
        else track('item_added', { target: target || 'list', count: items.length });
      } else if (type === 'remove') {
        const lowerNames = items.map(n => n.name?.toLowerCase());
        newState = newState.filter(it => !lowerNames.includes(it.name.toLowerCase()));
        summaries.push(`Удалил ${items.map(n => n.name).join(', ')} из "${getTargetName(target)}"`);
      } else if (type === 'check') {
        const lowerNames = items.map(n => n.name?.toLowerCase());
        newState = newState.map(it => lowerNames.includes(it.name.toLowerCase()) ? { ...it, isChecked: true } : it);
        
        // ADD MISSING ITEMS AUTOMATICALLY
        const existingNames = newState.map(it => it.name.toLowerCase());
        const missingItems = items.filter(n => !n.name || !existingNames.includes(n.name.toLowerCase()));
        
        if (missingItems.length > 0) {
          const toAdd = missingItems.map((it: any) => ({
            id: it.id || uid(), 
            name: it.name || '', 
            cat: it.cat || (classify(it.name || '')).cat || 'Другое', 
            isChecked: true, // checked immediately
            qty: it.qty || (it.quantity && it.unit ? `${it.quantity} ${it.unit}` : it.quantity ? `${it.quantity}` : '1'),
            kcal: it.kcal !== undefined ? it.kcal : it.calories,
            protein: it.protein,
            fat: it.fat,
            carbs: it.carbs,
            updatedAt: Date.now()
          } as any));
          newState = [...toAdd, ...newState];
        }
        
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
    
    try {
      const actions = res.actions || [];
      const hasValidActions = Array.isArray(actions) && actions.length > 0;
      
      // ── stock_analysis branch ──────────────────────────────────────────────
      // Backend returns tagged_items (possibly empty) + empty actions array.
      // Do NOT apply actions; instead push a special chat message.
      const isStockAnalysis = Array.isArray(res.tagged_items) && actions.length === 0;
      if (isStockAnalysis) {
        const feedbackStr = typeof res.feedback === 'string' ? res.feedback : 'Анализ запасов выполнен';
        const stockMsg: Message = {
          id: uid(),
          role: 'assistant',
          content: feedbackStr,
          timestamp: Date.now(),
          type: 'stock_analysis',
          stockTaggedItems: res.tagged_items,
        };
        setMessages(prev => [...prev, stockMsg]);
        addLogEvent(`🔍 stock_analysis: ${res.tagged_items?.length ?? 0} tagged`, 'ai');
        return;
      }
      // ──────────────────────────────────────────────────────────────────────
      
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
      setPendingMessageId(res.messageId);
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

    if (!res.appliedToDb) {
      setList(nextList);
      setStock(nextStock);
      setBaseline(nextBaseline);
      if (setDiary) setDiary(nextDiary);
    }
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
      }, 30000);
    }
    
      if (hasValidActions) {
        showToast("✅ Действие выполнено");
      }
      
      // Urgent save to Firebase to prevent data loss on high-latency snapshots
      if (!res.appliedToDb) {
        setTimeout(() => saveAll().catch(() => {}), 200);
      }
    } catch (err: any) {
      logDiagnostic(`CHAT CRASH (applyActions): ${err.message}`, 'error');
      showToast("❌ Ошибка обработки ответа: " + err.message);
    }
  }, [executeActions, setBaseline, setList, setMessages, setStock, setDiary, saveAll, addLogEvent]);

  const confirmPendingAction = useCallback(async () => {
    if (!pendingActions.length) return;
    
    // Phase 2: if backend gave a messageId, call POST /ai/confirm and just clear local
    if (pendingMessageId && user) {
      apiPost('/ai/confirm', { messageId: pendingMessageId, userId: user.uid, userEmail: user.email })
        .catch(err => logDiagnostic(`Confirm Backend Error: ${err.message}`, 'error'));
      showToast("✅ Запрос на подтверждение отправлен");
      setPendingActions([]);
      setPendingMessageId(undefined);
      return;
    }

    // Fallback Phase 1: Local apply
    applyActions({ actions: pendingActions, feedback: "Подтверждено", source: 'text' });
    setPendingActions([]);
    setPendingMessageId(undefined);
  }, [pendingActions, pendingMessageId, user, applyActions]);

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
    saveAll().catch(() => {});
  }, [executeActions, setBaseline, setList, setMessages, setStock, setDiary, saveAll, addLogEvent]);

  const analyzeImage = async (base64: string, tab: string = 'unknown') => {
    if (!user || isAiLoading) return;
    
    const usage = checkUsage({ stats, isSubscribed, subscriptionType } as any, 'image');
    if (!usage.allowed) {
      setPaywallType('image');
      addLogEvent(`⚠️ Лимит фото исчерпан (${usage.limit}/${usage.limit})`, 'ai');
      return;
    }

    setIsAiLoading(true);
    addSystemMessage('📷 Отправлено фото. Анализирую...', 'system');
    showToast("✨ Анализирую фото...");
    try {
      const result = await apiAnalyzeImage(
        base64, tab, user.email || 'unknown', user.uid, 
        list, stock, diary, baseline, usage.priority
      );
      if (result) {
        result.source = 'photo';
        track('photo_analyzed', { tab, priority: usage.priority });
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
      if (isNetworkError(err)) {
        showToast('⏳ Проблема со связью. Сервер не ответил, попробуйте еще раз');
        addLogEvent('⚠️ Фото не отправлено из-за обрыва связи', 'ai');
        addSystemMessage('⚠️ Фото не было проанализировано из-за обрыва связи', 'system');
        track('ai_error', { type: 'image', reason: 'timeout' });
        logAiAudit({ message: 'Network error or timeout during image analysis', status: 'timeout', code: err?.code || 'network_error', action: 'analyzeImage' });
      } else if (err?.status === 413 || err?.code === 'payload_too_large') {
        showToast('⚠️ Файл слишком большой. Попробуйте сжать или обрезать фото');
        addSystemMessage('⚠️ Фото слишком большое для загрузки. Попробуйте обрезать или сжать', 'system');
        track('ai_error', { type: 'image', reason: 'payload_too_large' });
        logAiAudit({ message: 'Payload too large', status: '413', action: 'analyzeImage' });
      } else if (err?.name === 'ApiError' && err.status === 403 && err.code === 'limit_reached') {
        handleLimitError(err.message || 'Лимит загрузки чеков и фото исчерпан', 'image', err.data?.subscription);
      } else {
        track('ai_error', { type: 'image', reason: err?.code || 'unknown' });
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
        setPaywallType('voice');
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
      
      track(isVoice ? 'voice_sent' : 'chat_sent', { priority: (usage as any).priority || 'normal' });
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
      if (isNetworkError(err)) {
        showToast('⏳ Проблема со связью. Сервер не ответил, попробуйте еще раз');
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'system', content: "Сообщение не отправлено из-за обрыва связи", timestamp: Date.now() }]);
        addLogEvent('⚠️ Текст не отправлен из-за обрыва связи', 'ai');
        track('ai_error', { type: isVoice ? 'voice' : 'chat', reason: 'timeout' });
        logAiAudit({ message: 'Network error or timeout during text command', status: 'timeout', code: err?.code || 'network_error', action: 'sendChatCommand' });
      } else if (err?.status === 413 || err?.code === 'payload_too_large') {
        showToast('⚠️ Текст слишком большой');
        track('ai_error', { type: isVoice ? 'voice' : 'chat', reason: 'payload_too_large' });
        logAiAudit({ message: 'Payload too large', status: '413', action: 'sendChatCommand' });
      } else if (err?.name === 'ApiError' && err.status === 403 && err.code === 'limit_reached') {
        handleLimitError(err.message || 'Лимит сообщений исчерпан', isVoice ? 'voice' : 'chat', err.data?.subscription);
      } else {
        logDiagnostic(`CHAT Exception: ${err.message}`, 'error');
        track('ai_error', { type: isVoice ? 'voice' : 'chat', reason: err?.code || 'unknown' });
        showToast(`❌ Ошибка ИИ: ${err.message}`);
      }
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <AiContext.Provider value={{ 
      isAiLoading, analyzeImage, sendChatCommand, 
      applyActions, executeOption, pendingActions, setPendingActions, confirmPendingAction,
      handleLimitError, activeUndos, undoAction,
      paywallType, setPaywallType
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
