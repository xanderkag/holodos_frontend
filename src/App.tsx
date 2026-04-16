import { useState, useEffect, useCallback, useRef } from 'react';
import { AuthScreen } from './screens/AuthScreen';
import { AdminScreen } from './screens/AdminScreen';
import { Header } from './components/Header';
import { TabBar } from './components/TabBar';
import ListScreen from './screens/ListScreen';
import BaselineScreen from './screens/BaselineScreen';
import ChatScreen from './screens/ChatScreen';
import DiaryScreen from './screens/DiaryScreen';
import EventsScreen from './screens/EventsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { SmartInput } from './components/SmartInput';
import { SmartHints } from './components/SmartHints';
import { ToastContainer, showToast } from './components/Toast';
import { DebugOverlay } from './components/DebugOverlay';
import { useAuth } from './context/AuthContext';
import { useData } from './context/DataContext';
import { useAi } from './context/AiContext';
import { logDiagnostic, setAiLogCallback } from './utils/ai';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Capacitor } from '@capacitor/core';
import { APP_VERSION } from './constants/version';
import { mergeItems, uid, classify } from './utils/data';
import type { DebugLog } from './components/DebugOverlay';
import { useDiaryActions } from './hooks/useDiaryActions';




const ONBOARDING_STEPS = [
  { id: 'onb1', text: "👋 Привет! Я помогаю управлять холодильником и списком покупок.", delay: 1000 },
  { id: 'onb2', text: "📷 Сфотографируй холодильник — распознаю содержимое и добавлю всё по категориям.", delay: 2800 },
  { id: 'onb3', text: "🧾 Скинь скриншот списка из чата — разберу и занесу нужное.", delay: 4600 },
  { id: 'onb4', text: "🎙️ Скажи голосом «купи хлеб и молоко» или «добавь йогурт в холодос» — выполню.", delay: 6400 },
  { id: 'onb5', text: "🗑️ Могу очистить холодильник или весь список одной командой.", delay: 8200 },
  { id: 'onb6', text: "✨ Попробуй — начни вопрос со слэша / или просто напиши список продуктов.", delay: 10000 },
];

export default function App() {
  const { user, loading: authLoading, isAdmin, loginWithTelegramWidget } = useAuth();
  const { 
    list, setList, stock, setStock, baseline, setBaseline, 
    stores, setStores, myRecipes, setMyRecipes, 
    messages, setMessages,
    uiSettings, setUiSettings, diary, setDiary,
    stats,
    resetAll, isDataLoaded, addSystemMessage, addLogEvent,
    syncBackendSubscription
  } = useData();
  const { 
    isAiLoading, analyzeImage, sendChatCommand, 
    applyActions, pendingActions, setPendingActions, handleLimitError
  } = useAi();

  const [currentTab, setCurrentTab] = useState('chat');
  const [currentStore, setCurrentStore] = useState(0);
  const [baselineSubMode, setBaselineSubMode] = useState<'stock' | 'base' | 'recipes'>('stock');
  const [logs, setLogs] = useState<DebugLog[]>([]);
  const [showDebug, setShowDebug] = useState(() => localStorage.getItem('showDebug') === 'true');
  const [showAdmin, setShowAdmin] = useState(false);
  const [onboardingTimers, setOnboardingTimers] = useState<any[]>([]);
  const [isOnboardingTyping, setIsOnboardingTyping] = useState(false);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const prevMessagesLength = useRef(messages.length);
  // Smart input visibility & gesture state
  const [smartInputState, setSmartInputState] = useState<'hidden' | 'active' | 'recording' | 'media'>('hidden');
  const handleSmartInputStateChange = (newState: typeof smartInputState) => setSmartInputState(newState);
  const handleMainTabChange = (tab: string) => {
    if (tab === 'chat') {
      if (smartInputState === 'hidden') {
        // First click: Open input but stay on current tab
        setSmartInputState('active');
      } else {
        // Second click: Input is already open
        if (smartInputState === 'recording') {
          setSmartInputState('active'); // Stop recording without switching tabs
        } else if (currentTab !== 'chat') {
          // If we were on another tab, NOW transfer to chat
          setCurrentTab('chat');
        } else {
          // Already in chat screen, second click closes the input
          setSmartInputState('hidden');
        }
      }
      // Note: We don't call setCurrentTab(tab) here yet on first click
      // to allow "Add locally on any tab" behavior as requested.
      return;
    }
    
    // Normal tab switching
    setCurrentTab(tab);
    // Auto-hide input when switching to other tabs like Settings
    if (smartInputState !== 'hidden') setSmartInputState('hidden');
  };

  // Capacitor native features: Delaying slightly to allow the webview to settle
  useEffect(() => {
    const startupTimeout = setTimeout(() => {
      if (Capacitor.isNativePlatform()) {
        logDiagnostic('NATIVE: Finalizing handshake', 'info');
        if (Capacitor.getPlatform() === 'ios') {
          // Force apply iOS safe area fallbacks in case 'env' calculates to 0px
          document.documentElement.style.setProperty('--sat-force', '47px');
          document.documentElement.style.setProperty('--sab-force', '34px');
        } else if (Capacitor.getPlatform() === 'android') {
          // Fallback for Android status bar which often reports 0px for env(safe-area-inset-top)
          document.documentElement.style.setProperty('--sat-force', '36px');
        }
        StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
        SplashScreen.hide().catch(() => {});
      }
    }, 500);
    return () => clearTimeout(startupTimeout);
  }, []);

  // UI Settings application
  useEffect(() => {
    document.body.dataset.density = uiSettings.density || 'comfortable';
    document.body.dataset.theme = uiSettings.theme || 'system';
  }, [uiSettings]);

  // Debug Logs
  const addDiagLog = useCallback((msg: string, level: DebugLog['level'] = 'info') => {
    const newLog: DebugLog = {
      id: Math.random().toString(36).substring(2),
      time: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      level,
      message: msg
    };
    setLogs(prev => [...prev.slice(-49), newLog]);
  }, []);


  useEffect(() => {
    setAiLogCallback((msg, level) => addDiagLog(msg, level as any));
  }, [addDiagLog]);

  // Track messages state changes
  useEffect(() => {
    if (messages.length > prevMessagesLength.current) {
      const lastMsg = messages[messages.length - 1];
      logDiagnostic(`APP: Messages updated. Total: ${messages.length}. Last: ${lastMsg.role}. Preview: "${lastMsg.content.substring(0, 30)}..."`, 'info');
      
      // If a new assistant or system message arrives while NOT on chat tab, show badge
      if (currentTab !== 'chat' && lastMsg.role !== 'user') {
        setHasUnreadMessages(true);
      }
    }
    prevMessagesLength.current = messages.length;
  }, [messages, currentTab]);

  useEffect(() => {
    if (currentTab === 'chat') {
      setHasUnreadMessages(false);
    }
  }, [currentTab]);

  // Onboarding logic
  useEffect(() => {
    logDiagnostic(`APP: v${APP_VERSION} Build initialized (STATIC HEIC + SYSTEM LOGS)`, 'info');
  }, []);

  const runOnboarding = useCallback((force = false) => {
    if (!force && localStorage.getItem('onboarding_shown') === 'true') return;
    onboardingTimers.forEach(t => clearTimeout(t));
    if (force) setMessages(prev => prev.filter(m => !m.id.startsWith('onb')));
    
    const timers: any[] = [];
    setIsOnboardingTyping(true);
    
    ONBOARDING_STEPS.forEach((step, idx) => {
      if (idx > 0) {
        const tStartTyping = setTimeout(() => setIsOnboardingTyping(true), step.delay - 1200);
        timers.push(tStartTyping);
      }
      
      const t = setTimeout(() => {
        setIsOnboardingTyping(false);
        setMessages(prev => {
          if (prev.find(m => m.id === step.id)) return prev;
          return [...prev, { id: step.id, role: 'assistant', content: step.text, timestamp: Date.now() }];
        });
        if (step.id === 'onb6') {
          localStorage.setItem('onboarding_shown', 'true');
        }
      }, step.delay);
      timers.push(t);
    });
    setOnboardingTimers(timers);
  }, [onboardingTimers, setMessages]);

  useEffect(() => {
    if (isDataLoaded && currentTab === 'chat' && localStorage.getItem('onboarding_shown') !== 'true') {
      runOnboarding();
    }
  }, [isDataLoaded, currentTab, runOnboarding]);

  // Command handlers
  const handleSmartSend = (text: string) => {
    const parts = text.split(',').map(p => p.trim()).filter(p => p.length > 0);
    if (!parts.length) return;
    const newItems = parts.map(p => {
      const match = p.match(/^(.*?)\s+(\d+)$/);
      const name = match ? match[1] : p;
      const amountStr = match ? match[2] : '1';
      const c = classify(name);
      return { 
        id: uid(), 
        name, 
        cat: c.cat || 'Другое', 
        isChecked: false, 
        qty: `${amountStr} шт`,
        kcal: c.kcal,
        protein: c.protein,
        fat: c.fat,
        carbs: c.carbs
      };
    });
    const targetSetter = currentTab === 'baseline' ? setStock : setList;
    const targetName = currentTab === 'baseline' ? 'Холодос' : 'Список';

    targetSetter(p => mergeItems(p, newItems as any));
    showToast(`✅ ${newItems.length} в ${targetName}`);
    addSystemMessage(`Добавлено вручную: ${newItems.map(i => i.name).join(', ')}`);
    addLogEvent(`РБ: Добавлено в ${targetName}: ${newItems.map(i => i.name).join(', ')}`, 'add');
  };

  const { handleAddToDiary } = useDiaryActions(setDiary, addSystemMessage);

  // Diary AI: фото → дневник
  const handleDiaryPhotoSelect = useCallback(async (imageBase64: string) => {
    const loadingId = uid();
    setMessages(prev => [...prev, {
      id: loadingId,
      role: 'assistant' as const,
      content: '📸 Анализирую фото и записываю в дневник...',
      timestamp: Date.now(),
      type: 'loading',
    }]);
    setCurrentTab('chat');

    await analyzeImage(imageBase64, 'diary');

    setMessages(prev => prev.filter(m => m.id !== loadingId));
  }, [setMessages, setCurrentTab, analyzeImage]);

  if (authLoading) return (
    <div className="empty" style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff', color: '#1c1c1e' }}>
      <div className="cat-name" style={{ color: '#1c1c1e', fontWeight: 800 }}>Инициализация...</div>
      <div style={{ fontSize: '12px', opacity: 0.5, marginTop: '8px' }}>v{APP_VERSION} (Checking Auth)</div>
    </div>
  );
  if (!user) return <AuthScreen />;

  const isStaging = window.location.hostname.includes('app-staging');

  return (
    <div className="app-container">
      {user?.isDemo && (
        <div 
          className="demo-badge"
          style={{
            position: 'fixed',
            top: 'env(safe-area-inset-top, 0px)',
            right: isStaging ? '120px' : '16px',
            background: '#ff2d55',
            color: '#fff',
            fontSize: '10px',
            fontWeight: 800,
            padding: '2px 8px',
            borderRadius: '0 0 10px 10px',
            zIndex: 9999,
            pointerEvents: 'auto', // Important so they can click it
            textTransform: 'uppercase',
            letterSpacing: '1px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
            cursor: 'pointer'
          }}
          onClick={() => {
            localStorage.removeItem('demo_mode');
            window.location.href = '/';
          }}
        >
          DEMO (ВЫЙТИ)
        </div>
      )}
      {isStaging && (
        <div 
          className="staging-badge"
          style={{
            position: 'fixed',
            top: 'env(safe-area-inset-top, 0px)',
            right: '16px',
            background: 'var(--acc)',
            color: '#fff',
            fontSize: '10px',
            fontWeight: 800,
            padding: '2px 8px',
            borderRadius: '0 0 10px 10px',
            zIndex: 9999,
            pointerEvents: 'none',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.5)'
          }}
        >
          STAGING v{APP_VERSION}
        </div>
      )}
      <Header
        title={currentTab === 'list' ? 'Покупки' : currentTab === 'baseline' ? 'Холодос' : currentTab === 'chat' ? 'Чат' : currentTab === 'history' ? 'Дневник' : currentTab === 'events' ? 'События' : 'Настройки'}
        stores={stores}
        currentStore={currentStore}
        onStoreChange={setCurrentStore}
        showStoreSelector={currentTab === 'list'}
        onAddStore={(name) => setStores(p => [...p, { name, ord: stores[0]?.ord || [] }])}
      />
      
      <main className="content-area">
        {currentTab === 'chat' && (
          <ChatScreen
            messages={messages}
            isLoading={isAiLoading || isOnboardingTyping}
            onUndo={() => {}}
            onShowInstructions={() => runOnboarding(true)}
            onChatTap={() => handleSmartInputStateChange('active')}
          />
        )}
        {currentTab === 'history' && (
          <DiaryScreen
            onImageSelect={handleDiaryPhotoSelect}
            onGoToChat={() => setCurrentTab('chat')}
          />
        )}
        {currentTab === 'events' && <EventsScreen />}
        {currentTab === 'baseline' && <BaselineScreen stock={stock} setStock={setStock} baseline={baseline} setBaseline={setBaseline} myRecipes={myRecipes} setMyRecipes={setMyRecipes} toList={(it) => { setList(prev => mergeItems(prev, [it])); showToast("✅ В список"); addSystemMessage(`Добавлено в покупки: ${it.name}`); }} mode={baselineSubMode} setMode={setBaselineSubMode} onEat={handleAddToDiary} />}
        {currentTab === 'list' && (
          <ListScreen 
            list={list} 
            setList={setList} 
            toStock={(it) => {
              setStock(prev => mergeItems(prev, [it]));
              showToast(`🧊 ${it.name} в Холодосе`);
              addSystemMessage(`Перемещено в холодильник: ${it.name}`);
              addLogEvent(`"${it.name}" перемещен в Холодос`, 'move');
            }}
            categoryOrder={stores[currentStore]?.ord || []} 
            setCategoryOrder={(o) => { 
              const s = [...stores]; 
              if (s[currentStore]) s[currentStore].ord = o; 
              setStores(s); 
            }} 
          />
        )}
        {currentTab === 'settings' && (
          <SettingsScreen
            user={user}
            stats={stats}
            isAdmin={isAdmin}
            onAdminClick={() => setShowAdmin(true)}
            showDebug={showDebug}
            setShowDebug={setShowDebug}
            uiSettings={uiSettings}
            onUpdateUiSettings={(s) => setUiSettings(p => ({ ...p, ...s }))}
            onFactoryReset={resetAll}
            onLinkTelegram={loginWithTelegramWidget}
          />
        )}
      </main>

      {/* Computed Smart Hints */}
      {(() => {
        let activeHints = null;
        if (currentTab === 'baseline' && baselineSubMode === 'base' && smartInputState !== 'hidden') {
          activeHints = (
            <SmartHints hints={[
              { 
                id: 'add-all', 
                label: 'Добавить всё', 
                icon: '🛒', 
                onClick: () => {
                  baseline.forEach(i => setList(prev => mergeItems(prev, [i])));
                  showToast(`+ ${baseline.length} в Покупки`);
                  addSystemMessage(`В список добавлено ${baseline.length} Любимых товаров`);
                  setSmartInputState('hidden'); // auto-hide
                }
              },
              { 
                id: 'add-missing', 
                label: 'Добавить недостающее', 
                icon: '➕', 
                onClick: () => {
                  const missing = baseline.filter(bk => !stock.some(sk => sk.name.toLowerCase() === bk.name.toLowerCase()));
                  missing.forEach(i => setList(prev => mergeItems(prev, [i])));
                  showToast(missing.length > 0 ? `+ ${missing.length} недостающих` : 'Всё уже есть в наличии!');
                  if (missing.length > 0) addSystemMessage(`В список добавлено ${missing.length} недостающих товаров`);
                  setSmartInputState('hidden'); // auto-hide
                }
              }
            ]} />
          );
        }

        return (
          <SmartInput
            placeholder={currentTab === 'list' ? "Добавить в список..." : "Пиши команду..."}
            onSend={(text) => {
              if (text.startsWith('/')) {
                sendChatCommand(text);
              } else {
                handleSmartSend(text);
              }
            }}
            shoppingList={list} 
            stock={stock}
            diary={diary}
            baseline={baseline}
            onVoiceResponse={(result) => {
              if (result?.subscription) syncBackendSubscription(result.subscription);
              applyActions(result);
            }} 
            onImageSelect={analyzeImage}
            onLimitError={handleLimitError}
            smartInputState={smartInputState}
            onStateChange={handleSmartInputStateChange}
            hints={activeHints}
          />
        );
      })()}

      <TabBar 
        tabs={[
          { id: 'list', label: 'Покупки', icon: '🧾' }, 
          { id: 'baseline', label: 'Холодос', icon: '🧊' }, 
          { 
            id: 'chat', 
            label: currentTab === 'chat' || smartInputState !== 'hidden' ? 'Чат' : 'AI', 
            icon: currentTab === 'chat' || smartInputState !== 'hidden' ? '💬' : '➕', 
            hasBadge: hasUnreadMessages 
          }, 
          { id: 'history', label: 'Дневник', icon: '📓' }, 
          { id: 'settings', label: 'Настройки', icon: '⚙️' }
        ]} 
        activeTab={currentTab}
        setActiveTab={handleMainTabChange}
        smartInputState={smartInputState}
        onChatTabSwipe={(direction) => {
          setSmartInputState(direction === 'right' ? 'recording' : 'media');
        }}
        onChatTabRepeat={() => {
          if (smartInputState === 'recording') {
            setSmartInputState('active'); // This will trigger stopRecording in SmartInput useEffect
          } else {
            setCurrentTab('chat');
          }
        }}
        onChatTabGestureEnd={() => {}}
      />

      <div className="global-bottom-blur" />
      {showAdmin && <AdminScreen onClose={() => setShowAdmin(false)} />}
      <ToastContainer />

      {pendingActions.length > 0 && (
        <div className="confirmation-overlay">
          <div className="confirmation-card glass-panel animated-pop">
            <h3>Подтвердите действие</h3>
            <div className="confirmation-actions">
              <button className="confirm-btn" onClick={() => { applyActions({ actions: pendingActions, feedback: "Подтверждено" }); setPendingActions([]); }}>Подтвердить</button>
              <button className="cancel-btn" onClick={() => setPendingActions([])}>Отмена</button>
            </div>
          </div>
        </div>
      )}
      
      {isAdmin && showDebug && <DebugOverlay logs={logs} onClear={() => setLogs([])} onClose={() => setShowDebug(false)} />}
    </div>
  );
}
