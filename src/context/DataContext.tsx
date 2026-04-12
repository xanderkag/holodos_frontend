import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import { db, getUserData, saveUserData } from '../utils/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import type { Item, Store, Recipe, Message, VoiceLog, UserData, UiSettings, DiaryEntry, LogEvent } from '../types';
import { BDEMO, STORES, MY_RECIPES_DEMO, uid } from '../utils/data';

interface DataContextType {
  list: Item[];
  setList: React.Dispatch<React.SetStateAction<Item[]>>;
  stock: Item[];
  setStock: React.Dispatch<React.SetStateAction<Item[]>>;
  baseline: Item[];
  setBaseline: (s: Item[] | ((prev: Item[]) => Item[])) => void;
  stores: Store[];
  setStores: (s: Store[] | ((prev: Store[]) => Store[])) => void;
  myRecipes: Recipe[];
  setMyRecipes: (s: Recipe[] | ((prev: Recipe[]) => Recipe[])) => void;
  messages: Message[];
  setMessages: (s: Message[] | ((prev: Message[]) => Message[])) => void;
  voiceLogs: VoiceLog[];
  setVoiceLogs: (s: VoiceLog[] | ((prev: VoiceLog[]) => VoiceLog[])) => void;
  uiSettings: UiSettings;
  setUiSettings: React.Dispatch<React.SetStateAction<UiSettings>>;
  diary: DiaryEntry[];
  setDiary: React.Dispatch<React.SetStateAction<DiaryEntry[]>>;
  events: LogEvent[];
  addLogEvent: (text: string, type: LogEvent['type']) => void;
  stats: UserData['stats'];
  incrementStat: (type: 'voice' | 'chat' | 'image') => void;
  isSubscribed: boolean;
  subscriptionStatus: UserData['subscriptionStatus'];
  subscriptionType: UserData['subscriptionType'];
  subscriptionEndDate?: number;
  isDataLoaded: boolean;
  saveAll: () => Promise<void>;
  resetAll: () => Promise<void>;
  addSystemMessage: (text: string, type?: string) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  
  const [list, setList] = useState<Item[]>([]);
  const [stock, setStock] = useState<Item[]>([]);
  const [baseline, setBaseline] = useState<Item[]>(BDEMO);
  const [stores, setStores] = useState<Store[]>(STORES);
  const [myRecipes, setMyRecipes] = useState<Recipe[]>(MY_RECIPES_DEMO);
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', content: 'Привет! Я твой ИИ ассистент HOLODOS. Чем могу помочь?', timestamp: Date.now() }
  ]);
  const [voiceLogs, setVoiceLogs] = useState<VoiceLog[]>([]);
  const [uiSettings, setUiSettings] = useState<UiSettings>({ density: 'comfortable', theme: 'system' });
  const [diary, setDiary] = useState<DiaryEntry[]>([]);
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [stats, setStats] = useState<UserData['stats']>({
    voice: { d: 0, m: 0, t: 0 },
    chat: { d: 0, m: 0, t: 0 },
    image: { d: 0, m: 0, t: 0 }
  });
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<UserData['subscriptionStatus']>('free');
  const [subscriptionType, setSubscriptionType] = useState<UserData['subscriptionType']>('free');
  const [subscriptionEndDate, setSubscriptionEndDate] = useState<number | undefined>(undefined);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // Sync Guard Refs: Master state mirrors for atomic saves
  const listRef = useRef<Item[]>([]);
  const stockRef = useRef<Item[]>([]);
  const baselineRef = useRef<Item[]>([]);
  const diaryRef = useRef<DiaryEntry[]>([]);
  const messagesRef = useRef<Message[]>([]);
  const storesRef = useRef<Store[]>([]);
  const recipesRef = useRef<Recipe[]>([]);
  const uiRef = useRef<UiSettings>({ density: 'comfortable', theme: 'system' });
  const eventsRef = useRef<LogEvent[]>([]);
  const statsRef = useRef<UserData['stats']>({
    voice: { d: 0, m: 0, t: 0 },
    chat: { d: 0, m: 0, t: 0 },
    image: { d: 0, m: 0, t: 0 }
  });

  const lastSaveTime = useRef(0);
  const localMutationTime = useRef(0);

  const resetLocalState = useCallback(() => {
    setIsDataLoaded(false);
    setList([]); listRef.current = [];
    setStock([]); stockRef.current = [];
    setBaseline(BDEMO); baselineRef.current = BDEMO;
    setMessages([{ id: '1', role: 'assistant', content: 'Привет! Я твой ИИ ассистент HOLODOS. Чем могу помочь?', timestamp: Date.now() }]);
    messagesRef.current = [{ id: '1', role: 'assistant', content: 'Привет! Я твой ИИ ассистент HOLODOS. Чем могу помочь?', timestamp: Date.now() }];
    setVoiceLogs([]);
    setStats({
      voice: { d: 0, m: 0, t: 0 },
      chat: { d: 0, m: 0, t: 0 },
      image: { d: 0, m: 0, t: 0 }
    });
    setStores(STORES); storesRef.current = STORES;
    setMyRecipes(MY_RECIPES_DEMO); recipesRef.current = MY_RECIPES_DEMO;
    setDiary([]); diaryRef.current = [];
    setEvents([]); eventsRef.current = [];
    localMutationTime.current = Date.now();
  }, []);

  // Initial Data Load & Subscription
  useEffect(() => {
    if (!user) {
      resetLocalState();
      return;
    }

    let isMounted = true;
    console.log("DataContext: Connecting for", user.email);

    // 0. Instant Load from LocalStorage (Mastering responsiveness)
    const cached = localStorage.getItem('holodos_cache');
    if (cached) {
      try {
        const d = JSON.parse(cached);
        // Sync Guard: Only use cache if it was saved within the last 24 hours
        const cacheAge = Date.now() - (d._lastSync || 0);
        if (cacheAge < 24 * 60 * 60 * 1000) {
          if (d.list) { setList(d.list); listRef.current = d.list; }
          if (d.stock) { setStock(d.stock); stockRef.current = d.stock; }
          if (d.baseline) { setBaseline(d.baseline); baselineRef.current = d.baseline; }
          if (d.stores) { setStores(d.stores); storesRef.current = d.stores; }
          if (d.myRecipes) { setMyRecipes(d.myRecipes); recipesRef.current = d.myRecipes; }
          if (d.messages) { setMessages(d.messages); messagesRef.current = d.messages; }
          if (d.diary) { setDiary(d.diary); diaryRef.current = d.diary; }
          if (d.events) { setEvents(d.events); eventsRef.current = d.events; }
          if (d.stats) { setStats(d.stats); statsRef.current = d.stats; }
          setIsDataLoaded(true);
        }
      } catch (e) {
        console.error("Cache restore failed", e);
      }
    }

    // Initial Data Load

    // Initial Fetch
    getUserData(user.uid).then(data => {
      if (!isMounted) return;
      if (data) {
        setList(data.list || []); listRef.current = data.list || [];
        setStock(data.stock || []); stockRef.current = data.stock || [];
        setBaseline(data.baseline || BDEMO); baselineRef.current = data.baseline || BDEMO;
        setStores(data.stores || STORES); storesRef.current = data.stores || STORES;
        setMyRecipes(data.myRecipes || MY_RECIPES_DEMO); recipesRef.current = data.myRecipes || MY_RECIPES_DEMO;
        setMessages(data.messages || []); messagesRef.current = data.messages || [];
        setVoiceLogs(data.voiceLogs || []);
        setStats(data.stats || {
          voice: { d: 0, m: 0, t: 0 },
          chat: { d: 0, m: 0, t: 0 },
          image: { d: 0, m: 0, t: 0 }
        });
        statsRef.current = data.stats || {
          voice: { d: 0, m: 0, t: 0 },
          chat: { d: 0, m: 0, t: 0 },
          image: { d: 0, m: 0, t: 0 }
        };
        setUiSettings(data.uiSettings || { density: 'comfortable', theme: 'system' }); uiRef.current = data.uiSettings || { density: 'comfortable', theme: 'system' };
        setDiary(data.diary || []); diaryRef.current = data.diary || [];
        setEvents(data.events || []); eventsRef.current = data.events || [];
        
        setIsSubscribed(data.isSubscribed || false);
        setSubscriptionStatus(data.subscriptionStatus || 'free');
        setSubscriptionType(data.subscriptionType || 'free');
        setSubscriptionEndDate(data.subscriptionEndDate);

        setIsDataLoaded(true);
        // Update cache
        localStorage.setItem('holodos_cache', JSON.stringify({ ...data, _lastSync: Date.now() }));
      } else {
        // New user initialization
        const initial: UserData = { 
          list: [], 
          stock: [], baseline: BDEMO, stores: STORES, 
          myRecipes: MY_RECIPES_DEMO, messages: [], voiceLogs: [], 
          isSubscribed: false,
          subscriptionStatus: 'free',
          subscriptionType: 'free',
          stats: {
            voice: { d: 0, m: 0, t: 0 },
            chat: { d: 0, m: 0, t: 0 },
            image: { d: 0, m: 0, t: 0 }
          },
          uiSettings: { density: 'comfortable', theme: 'system' },
          diary: [],
          events: []
        };
        saveUserData(user.uid, initial).then(() => {
          if (isMounted) setIsDataLoaded(true);
        });
      }
    });

    // Real-time listener
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
      if (!isMounted) return;
      
      // SYNC GUARD (v2.14.6): Skip if snapshot has pending writes (our change echo)
      // OR if we mutated state locally within the last 10 seconds.
      // This protects against "stale" server snapshots arriving before the server accepts our new state.
      const isRecentlyMutated = Date.now() - localMutationTime.current < 10000;
      if (snapshot.metadata.hasPendingWrites || isRecentlyMutated) {
        if (isRecentlyMutated) console.log("SYNC: Atomic Sync Guard Blocked snapshot (Recent Mutation)");
        return;
      }

      const d = snapshot.data() as UserData | undefined;
      if (d) {
        // DATA INTEGRITY FIX: If we have no pending writes, trust the server state completely.
        // This ensures deletions are handled correctly and items don't "reappear".
        setList(d.list || []); listRef.current = d.list || [];
        setStock(d.stock || []); stockRef.current = d.stock || [];
        setBaseline(d.baseline || BDEMO); baselineRef.current = d.baseline || BDEMO;
        setDiary(d.diary || []); diaryRef.current = d.diary || [];
        setEvents(d.events || []); eventsRef.current = d.events || [];
        
        if (d.messages) { setMessages(d.messages); messagesRef.current = d.messages; }
        if (d.stores) { setStores(d.stores); storesRef.current = d.stores; }
        if (d.myRecipes) { setMyRecipes(d.myRecipes); recipesRef.current = d.myRecipes; }
        if (d.voiceLogs) setVoiceLogs(d.voiceLogs);
        if (d.uiSettings) { setUiSettings(d.uiSettings); uiRef.current = d.uiSettings; }
        
        setIsSubscribed(d.isSubscribed || false);
        setSubscriptionStatus(d.subscriptionStatus || 'free');
        setSubscriptionType(d.subscriptionType || 'free');
        setSubscriptionEndDate(d.subscriptionEndDate);

        // Stats Persistence
        if (d.stats) {
          const s = d.stats;
          const lastD = d.lastStatsReset?.d || '';
          const lastM = d.lastStatsReset?.m || '';
          const nowD = new Date().toISOString().split('T')[0];
          const nowM = nowD.substring(0, 7);

          const finalStats = { ...s };
          if (lastD !== nowD) { finalStats.voice.d = 0; finalStats.chat.d = 0; finalStats.image.d = 0; }
          if (lastM !== nowM) { finalStats.voice.m = 0; finalStats.chat.m = 0; finalStats.image.m = 0; }

          setStats(finalStats);
          statsRef.current = finalStats;
        }

        // Silent cache update with timestamp
        localStorage.setItem('holodos_cache', JSON.stringify({ ...d, _lastSync: Date.now() }));
      }
    });

    return () => {
      isMounted = false;
      unsub();
    };
  }, [user, resetLocalState]);

  // Guarded Setters: Update localMutationTime and add timestamps
  const addTimestamps = (val: any) => {
    const t = Date.now();
    if (Array.isArray(val)) {
      return val.map(item => ({ ...item, updatedAt: item.updatedAt || t }));
    }
    if (typeof val === 'function') {
      return (prev: any) => {
        const next = val(prev);
        if (Array.isArray(next)) {
          return next.map(item => ({ ...item, updatedAt: item.updatedAt || t }));
        }
        return next;
      };
    }
    return val;
  };

  const guardedSetList = useCallback((val: any) => { 
    localMutationTime.current = Date.now(); 
    setList(prev => {
      const next = typeof val === 'function' ? addTimestamps(val(prev)) : addTimestamps(val);
      listRef.current = next;
      return next;
    }); 
  }, []);
  const guardedSetStock = useCallback((val: any) => { 
    localMutationTime.current = Date.now(); 
    setStock(prev => {
      const next = typeof val === 'function' ? addTimestamps(val(prev)) : addTimestamps(val);
      stockRef.current = next;
      return next;
    }); 
  }, []);
  const guardedSetBaseline = useCallback((val: any) => { 
    localMutationTime.current = Date.now(); 
    setBaseline(prev => {
      const next = typeof val === 'function' ? addTimestamps(val(prev)) : addTimestamps(val);
      baselineRef.current = next;
      return next;
    }); 
  }, []);
  const guardedSetMessages = useCallback((val: any) => { 
    localMutationTime.current = Date.now(); 
    setMessages(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      messagesRef.current = next;
      return next;
    }); 
  }, []);
  const guardedSetDiary = useCallback((val: any) => { 
    localMutationTime.current = Date.now(); 
    setDiary(prev => {
      const next = typeof val === 'function' ? addTimestamps(val(prev)) : addTimestamps(val);
      diaryRef.current = next;
      return next;
    }); 
  }, []);
  const guardedSetVoiceLogs = useCallback((val: any) => { localMutationTime.current = Date.now(); setVoiceLogs(val); }, []);
  const guardedSetStores = useCallback((val: any) => { localMutationTime.current = Date.now(); setStores(prev => { const n = typeof val==='function'?val(prev):val; storesRef.current = n; return n; }); }, []);
  const guardedSetMyRecipes = useCallback((val: any) => { localMutationTime.current = Date.now(); setMyRecipes(prev => { const n = typeof val==='function'?val(prev):val; recipesRef.current = n; return n; }); }, []);

  const addLogEvent = useCallback((text: string, type: LogEvent['type'] = 'add') => {
    localMutationTime.current = Date.now();
    setEvents(prev => {
      const next = [{ id: uid(), text, type, timestamp: Date.now() }, ...prev.slice(0, 99)];
      eventsRef.current = next;
      return next;
    });
  }, []);

  const incrementStat = useCallback((type: 'voice' | 'chat' | 'image') => {
    localMutationTime.current = Date.now();
    setStats(prev => {
      if (!prev) return prev;
      const next = {
        ...prev,
        [type]: {
          d: prev[type].d + 1,
          m: prev[type].m + 1,
          t: prev[type].t + 1
        }
      };
      statsRef.current = next;
      return next;
    });
  }, []);

  // Debounced Auto-save: Uses REF MIRRORS (listRef, stockRef...) to avoid stale closure bugs
  useEffect(() => {
    if (user && isDataLoaded) {
      const timer = setTimeout(() => {
        lastSaveTime.current = Date.now();
        saveUserData(user.uid, { 
          list: listRef.current, 
          stock: stockRef.current, 
          baseline: baselineRef.current, 
          stores: storesRef.current, 
          myRecipes: recipesRef.current, 
          messages: messagesRef.current, 
          voiceLogs: voiceLogs, 
          uiSettings: uiRef.current, 
          diary: diaryRef.current,
          events: eventsRef.current,
          stats: statsRef.current,
          isSubscribed,
          subscriptionStatus,
          subscriptionType,
          subscriptionEndDate,
          lastStatsReset: {
            d: new Date().toISOString().split('T')[0],
            m: new Date().toISOString().split('T')[0].substring(0, 7)
          }
        });
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [list, stock, baseline, stores, myRecipes, messages, voiceLogs, uiSettings, diary, user, isDataLoaded]);

  const saveAll = async () => {
    if (!user) return;
    lastSaveTime.current = Date.now();
    await saveUserData(user.uid, { 
      list: listRef.current, 
      stock: stockRef.current, 
      baseline: baselineRef.current, 
      stores: storesRef.current, 
      myRecipes: recipesRef.current, 
      messages: messagesRef.current, 
      voiceLogs: voiceLogs, 
      uiSettings: uiRef.current, 
      diary: diaryRef.current,
      events: eventsRef.current
    });
  };

  const addSystemMessage = useCallback((text: string, type = 'action') => {
    guardedSetMessages((prev: Message[]) => [
      ...prev,
      { id: uid(), role: 'system', content: text, timestamp: Date.now(), type }
    ]);
  }, [guardedSetMessages]);

  const resetAll = async () => {
    if (!user) return;
    setIsDataLoaded(false);
    const initial: UserData = { 
      list: [], stock: [], baseline: BDEMO, stores: STORES, 
      myRecipes: MY_RECIPES_DEMO, 
      messages: [{ id: uid(), role: 'assistant', content: 'Данные сброшены. Чем могу помочь?', timestamp: Date.now() }], 
      voiceLogs: [], 
      uiSettings: { density: 'comfortable', theme: 'system' },
      diary: [],
      events: []
    };
    await saveUserData(user.uid, initial);
    resetLocalState();
    setIsDataLoaded(true);
  };

  return (
    <DataContext.Provider value={{ 
      list, setList: guardedSetList, 
      stock, setStock: guardedSetStock, 
      baseline, setBaseline: guardedSetBaseline, 
      stores, setStores: guardedSetStores,
      myRecipes, setMyRecipes: guardedSetMyRecipes,
      messages, setMessages: guardedSetMessages, 
      voiceLogs, setVoiceLogs: guardedSetVoiceLogs,
      uiSettings, setUiSettings,
      diary, setDiary: guardedSetDiary,
      events, addLogEvent,
      stats, incrementStat,
      isSubscribed, subscriptionStatus, subscriptionType, subscriptionEndDate,
      isDataLoaded,
      saveAll,
      resetAll,
      addSystemMessage 
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
