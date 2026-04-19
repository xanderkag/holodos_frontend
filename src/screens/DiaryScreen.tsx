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
import './DiaryScreen.css';

interface DiaryScreenProps {
  onImageSelect: (base64: string) => void;
  onGoToChat?: () => void;
}

export default function DiaryScreen({ onImageSelect, onGoToChat }: DiaryScreenProps) {
  const {
    diary, setDiary, addSystemMessage, addLogEvent, stock, baseline, calorieNorm
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

  const targetKcal = calorieNorm || 2000;
  const targetP = 120;
  const targetF = 70;
  const targetC = 200;
  const remainingKcal = Math.max(0, targetKcal - eatenKcal);
  const progressPercent = Math.min(100, Math.max(0, (eatenKcal / targetKcal) * 100));

  const MEALS = [
    { id: 'breakfast', label: 'Завтрак', icon: '🍳' },
    { id: 'lunch', label: 'Обед', icon: '🍲' },
    { id: 'dinner', label: 'Ужин', icon: '🍽️' },
    { id: 'snack', label: 'Перекусы', icon: '🍎' }
  ];

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
        <div className="ui-capsule" style={{ width: '220px', position: 'relative', overflow: 'hidden', padding: '2px' }}>
          {/* Progress Fill */}
          <div 
            className="ui-pill active"
            style={{
              position: 'absolute',
              left: '2px', top: '2px', bottom: '2px',
              width: `calc(${progressPercent}% - 4px)`,
              minWidth: progressPercent > 0 ? '12px' : '0px',
              transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
              zIndex: 1,
              opacity: progressPercent > 0 ? 1 : 0
            }}
          />
          {/* Text Overlay — no mix-blend-mode (Android WebView renders black artifacts) */}
          <div style={{
            position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', 
            width: '100%', padding: '4px 12px', fontSize: '13px', fontWeight: '600',
          }}>
            <span style={{
              color: progressPercent > 40 ? '#fff' : 'var(--t1)',
              transition: 'color 0.3s',
              textShadow: progressPercent > 40 ? '0 1px 3px rgba(0,0,0,0.2)' : 'none'
            }}>
              {Math.round(eatenKcal)} ккал
            </span>
            <span style={{
              color: progressPercent > 80 ? 'rgba(255,255,255,0.7)' : 'var(--t3)',
              transition: 'color 0.3s'
            }}>
              из {targetKcal}
            </span>
          </div>
        </div>
      </SubHeader>



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
            <button className="hsc-connect-btn" onClick={async (e) => { 
              e.stopPropagation(); 
              const granted = await requestPermissions();
              if (granted) syncData();
            }}>
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
          initialMealType={(editingEntry?.mealType && editingEntry.mealType !== 'unknown' ? editingEntry.mealType : (addingCustomForMeal || undefined)) as ('breakfast' | 'lunch' | 'dinner' | 'snack' | undefined)}
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
