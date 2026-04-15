import { useState, useEffect } from 'react';
import { showToast } from '../components/Toast';
import { compressImage } from '../utils/image';
import { logDiagnostic } from '../utils/ai';
import { DiaryMacrosSummary } from '../components/Diary/DiaryMacrosSummary';
import { DiaryMealGroup } from '../components/Diary/DiaryMealGroup';
import { EditItemModal } from '../components/EditItemModal';
import { SubHeader } from '../components/SubHeader';
import { useData } from '../context/DataContext';
import { useDiaryActions } from '../hooks/useDiaryActions';
import { useHealthSync } from '../hooks/useHealthSync';
import type { DiaryEntry, MealType } from '../types';
import { getUserSubscriptionInfo } from '../utils/subscription';
import './DiaryScreen.css';

interface DiaryScreenProps {
  onImageSelect: (base64: string) => void;
  onGoToChat?: () => void;
}

export default function DiaryScreen({ onImageSelect, onGoToChat }: DiaryScreenProps) {
  const {
    diary, setDiary, addSystemMessage, addLogEvent, stock, baseline,
    stats, isSubscribed, subscriptionType
  } = useData();
  const { handleAddToDiary, clarifyDiaryItem } = useDiaryActions(setDiary, addSystemMessage);
  const { healthData, isSyncing, syncData, requestPermissions } = useHealthSync();
  
  useEffect(() => {
    logDiagnostic(`DIARY: Rendering... (SyncState: ${isSyncing})`, 'info');
  }, [isSyncing]);

  const [water, setWater] = useState(1250);
  const [addingCustomForMeal, setAddingCustomForMeal] = useState<MealType | null>(null);
  const [editingEntry, setEditingEntry] = useState<DiaryEntry | null>(null);



  const todayStart = new Date().setHours(0,0,0,0);
  const todaysDiary = (diary || []).filter(d => d.consumedAt >= todayStart);
  const pendingClarification = todaysDiary.filter(d => d.needsClarification);

  let eatenKcal = 0;
  let eatenP = 0;
  let eatenF = 0;
  let eatenC = 0;

  todaysDiary.forEach(d => {
    eatenKcal += d.kcal || 0;
    eatenP += d.protein || 0;
    eatenF += d.fat || 0;
    eatenC += d.carbs || 0;
  });

  const targetKcal = 2000;
  const targetP = 120;
  const targetF = 70;
  const targetC = 200;
  const remainingKcal = Math.max(0, targetKcal - eatenKcal);

  const MEALS = [
    { id: 'breakfast', label: 'Завтрак', icon: '🍳' },
    { id: 'lunch', label: 'Обед', icon: '🍲' },
    { id: 'dinner', label: 'Ужин', icon: '🍽️' },
    { id: 'snack', label: 'Перекусы', icon: '🍎' }
  ];

  const today = new Date().toLocaleDateString('ru-RU', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long' 
  });

  const addWater = () => {
    setWater(prev => prev + 250);
    showToast('💧 + 250 мл (Дневник)');
    if (addSystemMessage) addSystemMessage('💧 Выпито 250 мл воды', 'log');
    if (addLogEvent) addLogEvent('Выпито 250 мл воды', 'log');
  };

  const handleRemoveItem = (id: string, silent = true) => {
    // v2.88.0: Silent by default for swipes, use Toast + System Log instead of alerts
    if (!silent && !window.confirm('Удалить эту запись?')) return;
    const item = diary.find(d => d.id === id);
    setDiary(prev => prev.filter(d => d.id !== id));
    showToast('✕ Удалено из дневника');
    if (addSystemMessage && item) {
       addSystemMessage(`✕ Удалено из Дневника: **${item.name}**`, 'diary');
    }
  };

  const handleUpdateItem = (entry: DiaryEntry) => {
    setDiary(prev => prev.map(d => d.id === entry.id ? entry : d));
    showToast('📝 Запись обновлена');
  };

  const handleAddMeal = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        logDiagnostic(`n8n-Diary: Selected ${file.name} (${Math.round(file.size / 1024)} KB)`, 'info');
        const reader = new FileReader();
        reader.onload = async (re: any) => {
          try {
            const base64 = re.target.result;
            logDiagnostic('n8n-Diary: Resizing...', 'info');
            const compressed = await compressImage(base64, 800);
            onImageSelect(compressed);
          } catch (err: any) {
            logDiagnostic(`n8n ERROR (diary-comp): ${err.message}`, 'error');
            showToast('Ошибка обработки: ' + err.message);
          }
        };
        reader.onerror = () => {
          logDiagnostic('n8n ERROR (FileReader): Read failed', 'error');
          showToast('Не удалось прочитать файл');
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  return (
    <div className="screen scrollable diary-screen">
      <SubHeader>
        <div className="diary-header-content" style={{display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center'}}>
          <h2 style={{fontSize: '14px', fontWeight: '800', margin: 0, color: 'var(--t1)', textTransform: 'uppercase'}}>Дневник</h2>
          <div style={{fontSize: '12px', fontWeight: '700', color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '1px'}}>{today}</div>
        </div>
      </SubHeader>

      {/* Subscription & Limits Info (v2.90.0) */}
      <div className="subscription-limits-bar" style={{padding: '0 20px', marginBottom: '12px'}}>
        {(() => {
          const info = getUserSubscriptionInfo({ stats, isSubscribed, subscriptionType } as any);
          return (
            <div className="glass-panel" style={{padding: '8px 12px', fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)'}}>
              <div style={{display: 'flex', gap: '12px'}}>
                <span title="Лимит фото">📸 {info.limits.photos.remaining} / {info.limits.photos.limit}</span>
                <span title="Лимит голоса">🎙️ {info.limits.voice.remaining} / {info.limits.voice.limit}</span>
              </div>
              <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                <span style={{
                  padding: '2px 6px', 
                  borderRadius: '4px', 
                  background: info.tariffId === 'pro' ? 'var(--accent)' : 'rgba(255,255,255,0.1)',
                  color: info.tariffId === 'pro' ? '#000' : 'inherit',
                  fontWeight: '600',
                  fontSize: '10px',
                  textTransform: 'uppercase'
                }}>
                  {info.tariffLabel}
                </span>
                {info.tariffId === 'free' && (
                  <button 
                    onClick={() => showToast('🚀 Скоро: Подписка Pro')}
                    style={{border: 'none', background: 'none', color: 'var(--accent)', fontSize: '10px', fontWeight: '600', padding: 0, textDecoration: 'underline'}}
                  >
                    Upgrade
                  </button>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      <DiaryMacrosSummary 
        remainingKcal={remainingKcal}
        eatenKcal={eatenKcal}
        activeKcal={healthData?.calories || 0}
        eatenP={eatenP}
        targetP={targetP}
        eatenF={eatenF}
        targetF={targetF}
        eatenC={eatenC}
        targetC={targetC}
      />

      {/* Health Sync Dashboard */}
      <div className="diary-section" style={{marginBottom: '16px'}}>
        <div className={`health-sync-card glass-panel animated-pop ${isSyncing ? 'syncing' : ''}`} onClick={syncData}>
          <div className="hsc-header">
            <span className="hsc-title">🏥 Здоровье и Активность</span>
            <div className="hsc-sync-btn">
              {isSyncing ? '⌛' : '🔄'}
            </div>
          </div>
          
          <div className="hsc-grid">
            <div className="hsc-stat">
              <span className="hsc-val">{Number(healthData?.steps || 0).toLocaleString() || '0'}</span>
              <span className="hsc-lbl">шагов</span>
            </div>
            <div className="hsc-stat">
              <span className="hsc-val">{healthData?.weight || '--'}</span>
              <span className="hsc-lbl">кг</span>
            </div>
            <div className="hsc-stat">
              <span className="hsc-val">{Math.round(healthData?.calories || 0) || '0'}</span>
              <span className="hsc-lbl">ккал</span>
            </div>
          </div>

          {healthData?.lastSync && (
            <div className="hsc-footer">
              Синхронизировано: {new Date(healthData.lastSync).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </div>
          )}
          {!healthData && (
            <button className="hsc-connect-btn" onClick={(e) => { e.stopPropagation(); requestPermissions(); }}>
              Подключить Apple Health / Google Fit
            </button>
          )}
        </div>
      </div>

      {/* Pending clarification banner */}
      {pendingClarification.length > 0 && (
        <div
          style={{
            margin: '0 20px 12px',
            padding: '10px 14px',
            borderRadius: '14px',
            background: 'rgba(255, 149, 0, 0.1)',
            border: '1px solid rgba(255, 149, 0, 0.3)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '13px', color: 'var(--t1)', fontWeight: '600' }}>
            ⚠️ Уточни {pendingClarification.length} позиц.
          </span>
          {onGoToChat && (
            <button
              onClick={onGoToChat}
              style={{
                padding: '4px 12px',
                borderRadius: '20px',
                border: 'none',
                background: 'var(--acc)',
                color: '#fff',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
              }}
            >
              в чат
            </button>
          )}
        </div>
      )}

      {/* Nutrition / Meals */}
      <div className="diary-section">
        <h3 className="section-title">🍽️ Приемы пищи</h3>

        {MEALS.map(meal => (
          <DiaryMealGroup
            key={meal.id}
            meal={meal}
            items={todaysDiary.filter(d => (d.mealType || 'snack') === meal.id)}
            onAddClick={() => setAddingCustomForMeal(meal.id as MealType)}
            onRemoveItem={handleRemoveItem}
            onEditItem={setEditingEntry}
            onClarifyItem={(itemId, quantity, unit) => {
              if (quantity > 0) {
                clarifyDiaryItem(itemId, {
                  qty: `${quantity} ${unit}`,
                  kcal: undefined, // будет пересчитано вручную пользователем
                });
              } else {
                clarifyDiaryItem(itemId, { needsClarification: false });
              }
            }}
          />
        ))}

        <EditItemModal 
          isOpen={!!addingCustomForMeal || !!editingEntry}
          onClose={() => { setAddingCustomForMeal(null); setEditingEntry(null); }}
          onSave={() => {}} // Not used for diary log
          onDelete={editingEntry ? () => { handleRemoveItem(editingEntry.id); setEditingEntry(null); } : undefined}
          onLogDiary={(diaryData: any) => {
            if (editingEntry) {
              handleUpdateItem({
                ...editingEntry,
                name: diaryData.itemDraft?.name || diaryData.name || editingEntry.name,
                qty: `${diaryData.portionQty} ${diaryData.portionUnit}`,
                kcal: diaryData.kcal,
                protein: diaryData.protein,
                fat: diaryData.fat,
                carbs: diaryData.carbs,
                consumedAt: diaryData.consumedAt,
                mealType: diaryData.mealType
              });
            } else {
              handleAddToDiary({
                name: diaryData.itemDraft?.name || diaryData.name || 'Без названия',
                qty: `${diaryData.portionQty} ${diaryData.portionUnit}`,
                kcal: diaryData.kcal,
                protein: diaryData.protein,
                fat: diaryData.fat,
                carbs: diaryData.carbs,
                consumedAt: diaryData.consumedAt
              }, addingCustomForMeal!);
            }
            setAddingCustomForMeal(null);
            setEditingEntry(null);
          }}
          initialName={editingEntry?.name || ""}
          initialQty={editingEntry?.qty || "100 г"}
          initialCat={editingEntry?.cat || "Другое"}
          initialKcal={editingEntry?.kcal}
          initialProtein={editingEntry?.protein}
          initialFat={editingEntry?.fat}
          initialCarbs={editingEntry?.carbs}
          initialMealType={editingEntry?.mealType || (addingCustomForMeal || undefined)}
          initialConsumedAt={editingEntry?.consumedAt}
          initialMode="dnevnik"
          baseline={baseline}
          stock={stock}
        />

        <button className="add-more-vision-btn glass-panel" style={{marginTop: '12px'}} onClick={() => handleAddMeal()}>
           📸 Распознать еду по фото
        </button>
      </div>



      {/* Water Tracker */}
      <div className="diary-section">
        <div className="water-card glass-panel">
          <div className="water-info">
            <h3 className="section-title" style={{margin: 0}}>💧 Вода</h3>
            <div className="water-progress">{water} / 2500 мл</div>
          </div>
          <div className="water-controls">
            <div className="water-glass-row">
              {Array.from({length: 8}).map((_, i) => (
                <div key={i} className={`water-drop ${i < water/250 ? 'filled' : ''}`}></div>
              ))}
            </div>
            <button className="water-btn" onClick={addWater}>＋ 250 мл</button>
          </div>
        </div>
      </div>

    </div>
  );
};
