import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { GROUP_ORDER, areUnitsCompatible, mapBackendCategory } from '../utils/data';
import type { Category, Item } from '../utils/data';

import './EditItemModal.css';

interface EditItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (name: string, qty: string, cat: Category, notes: string, kcal?: number, protein?: number, fat?: number, carbs?: number) => void;
  onDelete?: () => void;
  onLogDiary?: (diaryData: {
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    consumedAt: number;
    portionQty: number;
    portionUnit: string;
    kcal: number;
    protein: number;
    fat: number;
    carbs: number;
    deductFromStock: boolean;
    itemDraft?: { name: string; cat: Category; notes: string };
  }) => void;
  initialName: string;
  initialQty: string;
  initialCat: Category;
  initialNotes?: string;
  initialKcal?: number;
  initialProtein?: number;
  initialFat?: number;
  initialCarbs?: number;
  initialMode?: 'tovar' | 'dnevnik';
  initialMealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  initialConsumedAt?: number;
  baseline?: Item[];
  stock?: Item[];
}

const UNITS = ['шт', 'г', 'кг', 'л', 'мл', 'уп', 'бут'];

export const EditItemModal: React.FC<EditItemModalProps> = ({ 
  isOpen, onClose, onSave, onDelete, onLogDiary,
  initialName, initialQty, initialCat, initialNotes = '',
  initialKcal, initialProtein, initialFat, initialCarbs,
  initialMode = 'tovar', initialMealType, initialConsumedAt
}) => {
  const [mode, setMode] = useState<'tovar' | 'dnevnik'>(initialMode);
  
  // Focus state for 'Zen Focus' search mode
  const [isNameFocused, setIsNameFocused] = useState(false);

  // Item Edit States
  const [name, setName] = useState(initialName || '');
  const [amount, setAmount] = useState<number>(1);
  const [unit, setUnit] = useState('шт');
  const [category, setCategory] = useState<Category>(initialCat || '');
  const [notes, setNotes] = useState(initialNotes || '');
  
  const [kcal, setKcal] = useState<string>('');
  const [protein, setProtein] = useState<string>('');
  const [fat, setFat] = useState<string>('');
  const [carbs, setCarbs] = useState<string>('');
  
  const [isLinked, setIsLinked] = useState(false);

  // Diary Edit States
  const [mealType, setMealType] = useState<'breakfast'|'lunch'|'dinner'|'snack'>('lunch');
  const [logDate, setLogDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [logTime, setLogTime] = useState<string>(new Date().toTimeString().substring(0,5));
  const [portion, setPortion] = useState<number>(100);
  const [portionUnit, setPortionUnit] = useState<string>('г');
  const [deductFromStock, setDeductFromStock] = useState(true);

  // Search Logic
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [catSuggestions, setCatSuggestions] = useState<string[]>([]);
  
  // Swipe Handling (v2.84.0)
  const touchStart = useRef<number | null>(null);
  const searchTimeoutRef = useRef<number | null>(null);

  const canDeduct = areUnitsCompatible(unit, portionUnit);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setMode(initialMode || 'tovar');
      
      setName(initialName || '');
      setCategory(initialCat || '');
      setNotes(initialNotes || '');
      setKcal(initialKcal !== undefined && initialKcal !== 0 ? String(initialKcal) : '');
      setProtein(initialProtein !== undefined && initialProtein !== 0 ? String(initialProtein) : '');
      setFat(initialFat !== undefined && initialFat !== 0 ? String(initialFat) : '');
      setCarbs(initialCarbs !== undefined && initialCarbs !== 0 ? String(initialCarbs) : '');
      
      setIsLinked(initialKcal !== undefined && initialKcal > 0);

      const trimmedQty = (initialQty || '').trim();
      const match = trimmedQty.match(/^([\d.,]+)\s*(.*)$/);
      
      if (match) {
        const val = parseFloat(String(match[1] || '').replace(',', '.'));
        setAmount(isNaN(val) ? 1 : val);
        const u = match[2].trim();
        setUnit(u || 'шт');
      } else {
        setAmount(1); 
        setUnit(trimmedQty || 'шт'); 
      }

      if (initialConsumedAt) {
        const d = new Date(initialConsumedAt);
        setLogDate(d.toISOString().split('T')[0]);
        setLogTime(d.toTimeString().substring(0,5));
      } else {
        setLogDate(new Date().toISOString().split('T')[0]);
        setLogTime(new Date().toTimeString().substring(0,5));
      }
      
      if (initialMealType) {
        setMealType(initialMealType);
      } else {
        const hour = new Date().getHours();
        if (hour >= 6 && hour < 11) setMealType('breakfast');
        else if (hour >= 11 && hour < 16) setMealType('lunch');
        else if (hour >= 16 && hour < 22) setMealType('dinner');
        else setMealType('snack');
      }

      document.body.classList.add('modal-open');
    } else {
      document.body.style.overflow = '';
      document.body.classList.remove('modal-open');
    }

    return () => {
      document.body.style.overflow = '';
      document.body.classList.remove('modal-open');
    };
  }, [isOpen, initialName, initialQty, initialCat, initialNotes, initialKcal, initialProtein, initialFat, initialCarbs, initialMode, initialConsumedAt, initialMealType]);

  if (!isOpen) return null;

  // Swipe Logic (v2.84.0)
  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = e.targetTouches[0].clientX;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const endX = e.changedTouches[0].clientX;
    const diff = touchStart.current - endX;
    
    // Threshold of 80px to prevent accidental swipes
    if (diff > 80) setMode('dnevnik'); // Swipe left -> Diary
    else if (diff < -80) setMode('tovar'); // Swipe right -> Tovar
    
    touchStart.current = null;
  };

  const handleSaveItem = () => {
    if (!onSave) return;
    const finalQty = (amount === 1 && !/^\d+$/.test(unit)) ? unit : `${amount} ${unit}`;
    onSave(
      name, 
      finalQty.trim(), 
      category, 
      notes,
      kcal ? parseFloat(kcal.replace(',', '.')) : undefined,
      protein ? parseFloat(protein.replace(',', '.')) : undefined,
      fat ? parseFloat(fat.replace(',', '.')) : undefined,
      carbs ? parseFloat(carbs.replace(',', '.')) : undefined
    );
  };

  const handleLogDiary = () => {
    if (onLogDiary) {
      let mult = 1;
      const isMetric = portionUnit === 'г' || portionUnit === 'мл';
      if (isLinked) {
        if (isMetric) mult = portion / 100;
        else mult = portion;
      }
      
      const pKcal = kcal ? parseFloat(kcal.replace(',','.')) * mult : 0;
      const pP = protein ? parseFloat(protein.replace(',','.')) * mult : 0;
      const pF = fat ? parseFloat(fat.replace(',','.')) * mult : 0;
      const pC = carbs ? parseFloat(carbs.replace(',','.')) * mult : 0;

      onLogDiary({
        mealType,
        consumedAt: new Date(`${logDate}T${logTime}`).getTime(),
        portionQty: portion || 0,
        portionUnit,
        kcal: Math.round(pKcal),
        protein: parseFloat(pP.toFixed(1)),
        fat: parseFloat(pF.toFixed(1)),
        carbs: parseFloat(pC.toFixed(1)),
        deductFromStock,
        itemDraft: { name, cat: category, notes }
      });
    }
    onClose();
  };

  const onSelectFromCatalog = (item: any) => {
    setName(item.canonical_name || item.name);
    setCategory(mapBackendCategory(item.category || item.cat));
    
    const k = item.per_100g?.kcal ?? item.kcal ?? 0;
    const p = item.per_100g?.protein ?? item.protein ?? 0;
    const f = item.per_100g?.fat ?? item.fat ?? 0;
    const c = item.per_100g?.carbs ?? item.carbs ?? 0;

    setKcal(String(k));
    setProtein(String(p));
    setFat(String(f));
    setCarbs(String(c));
    
    if (item.default_portion_g) {
      setPortion(item.default_portion_g);
      setPortionUnit('г');
    }

    setIsLinked(true);
    setIsNameFocused(false);
    setSuggestions([]);
  };


  const handleNameChange = (val: string) => {
    setName(val);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (val.length < 2) {
      setSuggestions([]);
      return;
    }

    searchTimeoutRef.current = window.setTimeout(async () => {
      try {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
        const res = await fetch(`${backendUrl}/api/catalog/search?q=${encodeURIComponent(val)}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.results || []);
        }
      } catch (err) {
        console.error("Failed to fetch catalog", err);
      }
    }, 400); // 400ms debounce
  };

  const handleCategoryChange = (val: string) => {
    setCategory(val as Category);
    if (val.length < 1) {
      setCatSuggestions([]);
      return;
    }
    const searchLower = val.toLowerCase();
    const matches = GROUP_ORDER.filter(c => c.toLowerCase().includes(searchLower) && c !== val);
    setCatSuggestions(matches.slice(0, 5));
  };

  const adjustAmount = (delta: number) => {
    setAmount(prev => Math.max(0, parseFloat((prev + delta).toFixed(2))));
  };

  const isMetric = portionUnit === 'г' || portionUnit === 'мл';
  let mult = 1;
  if (isLinked) {
    if (isMetric) mult = portion / 100;
    else mult = portion;
  }
  const calcKcal = kcal ? Math.round(parseFloat(String(kcal).replace(',','.')) * mult) : 0;
  const calcP = protein ? (parseFloat(String(protein).replace(',','.')) * mult).toFixed(1) : '0';
  const calcF = fat ? (parseFloat(String(fat).replace(',','.')) * mult).toFixed(1) : '0';
  const calcC = carbs ? (parseFloat(String(carbs).replace(',','.')) * mult).toFixed(1) : '0';

  const modalContent = (
    <>
      <div className="eim-backdrop" onClick={(e) => { e.stopPropagation(); onClose(); }} />
      
      <div 
        className="eim-sheet"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="eim-handle" />
        <div className="eim-toggle-wrap">
          <div className="eim-toggle">
            <button className={`eim-tbtn ${mode === 'tovar' ? 'active' : ''}`} onClick={() => setMode('tovar')}>
                  <span className="eim-tbtn-emoji">🧊</span> Товар
                </button>
                <button className={`eim-tbtn ${mode === 'dnevnik' ? 'active' : ''}`} onClick={() => setMode('dnevnik')}>
                  <span className="eim-tbtn-emoji">📓</span> Дневник
                </button>
              </div>
            </div>

            <div className="eim-sbody">
              {/* --- Товар Tab --- */}
              <div className={`eim-panel ${mode === 'tovar' ? 'active' : ''}`}>
                <div className="eim-sec">
                  <div className="eim-lbl">Название</div>
                  <div style={{position: 'relative'}}>
                    <input 
                      className="eim-tinp-large" 
                      type="text" 
                      autoComplete="off" 
                      autoCorrect="off" 
                      spellCheck={false} 
                      value={name} 
                      onChange={e => handleNameChange(e.target.value)} 
                      onFocus={() => setIsNameFocused(true)}
                      onBlur={() => setTimeout(() => setIsNameFocused(false), 200)}
                      placeholder="Молоко" 
                    />
                    {isLinked && !isNameFocused && (
                      <div className="eim-linked-badge" onClick={() => setIsLinked(false)}>
                        <div className="elb-ico">✅</div>
                        <div className="elb-text">Из базы: {calcKcal} ккал</div>
                        <div className="elb-un">Отвязать</div>
                      </div>
                    )}
                  </div>
                  
                  {isNameFocused && name.length >= 2 && (
                    <div className="eim-focus-suggestions">
                      {suggestions.length > 0 ? (
                        suggestions.slice(0, 5).map((s, idx) => (
                          <div key={idx} className="eim-fs-item animated-pop" onClick={() => onSelectFromCatalog(s)}>
                            <div className="efsi-icon">{s.canonical_name ? s.canonical_name[0] : s.name[0]}</div>
                            <div className="efsi-info">
                              <div className="efsi-name">{s.canonical_name || s.name}</div>
                              <div className="efsi-sub">{s.per_100g?.kcal ?? s.kcal} ккал • {mapBackendCategory(s.category || s.cat)}</div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="eim-fs-empty">Ничего не найдено в справочнике</div>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ display: isNameFocused ? 'none' : 'block', animation: 'fadeIn 0.2s ease' }}>
                  <div className="eim-row">
                  <div className="eim-sec" style={{flex: 1.2, position: 'relative'}}>
                    <div className="eim-lbl">Категория</div>
                    <input className="eim-inp" type="text" autoComplete="off" autoCorrect="off" spellCheck={false} value={category} onChange={e => handleCategoryChange(e.target.value)} placeholder="Категория" />
                    {catSuggestions.length > 0 && (
                      <div className="eim-cat-chips">
                        {catSuggestions.map(c => (
                          <button key={c} className="eim-cat-chip" onClick={() => { setCategory(c as Category); setCatSuggestions([]); }}>{c}</button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="eim-sec" style={{flex: 1}}>
                    <div className="eim-lbl">Количество</div>
                    <div className="eim-qty-ctrl">
                      <button className="eim-qbtn" onClick={() => adjustAmount(-1)}>−</button>
                      <input className="eim-qval" type="number" step="any" value={amount} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} />
                      <button className="eim-qbtn" onClick={() => adjustAmount(1)}>+</button>
                    </div>
                  </div>
                </div>

                <div className="eim-sec">
                  <div className="eim-unit-wrap narrow" style={{marginTop: 4}}>
                    {UNITS.map(u => (
                      <button key={u} className={`eim-upill ${unit === u ? 'active' : ''}`} onClick={() => setUnit(u)}>{u}</button>
                    ))}
                  </div>
                </div>

                <div className="eim-sec">
                  <div className="eim-lbl">Примечания</div>
                  <textarea className="eim-inp" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Бренд, жирность, упаковка..." />
                </div>

                </div>

                <div className="eim-div" />
                <div className="eim-actions">
                  <button className="eim-btn eim-b-cancel" onClick={onClose}>Отмена</button>
                  {onDelete && <button className="eim-btn eim-b-delete" onClick={onDelete}>Удалить</button>}
                  <button className="eim-btn eim-b-save" onClick={handleSaveItem}>Сохранить</button>
                </div>
              </div>

              {/* --- Дневник Tab --- */}
              <div className={`eim-panel ${mode === 'dnevnik' ? 'active' : ''}`}>
                <div className="eim-sec" style={{marginBottom: 12}}>
                  <div className="eim-lbl">Продукт</div>
                  <div style={{position: 'relative'}}>
                    <input 
                      className="eim-tinp-large" 
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      autoFocus={!initialName}
                      placeholder="Что съели?"
                      value={name} 
                      onChange={e => handleNameChange(e.target.value)} 
                      onFocus={() => setIsNameFocused(true)}
                      onBlur={() => setTimeout(() => setIsNameFocused(false), 200)}
                    />
                    {isLinked && !isNameFocused && (
                      <div className="eim-linked-badge" onClick={() => setIsLinked(false)}>
                        <div className="elb-ico">✅</div>
                        <div className="elb-text">Из базы: {calcKcal} ккал</div>
                        <div className="elb-un">Отвязать</div>
                      </div>
                    )}
                  </div>
                  
                  {isNameFocused && name.length >= 2 && (
                    <div className="eim-focus-suggestions">
                      {suggestions.length > 0 ? (
                        suggestions.slice(0, 5).map((s, idx) => (
                          <div key={idx} className="eim-fs-item animated-pop" onClick={() => onSelectFromCatalog(s)}>
                            <div className="efsi-icon">{s.canonical_name ? s.canonical_name[0] : s.name[0]}</div>
                            <div className="efsi-info">
                              <div className="efsi-name">{s.canonical_name || s.name}</div>
                              <div className="efsi-sub">{s.per_100g?.kcal ?? s.kcal} ккал • {mapBackendCategory(s.category || s.cat)}</div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="eim-fs-empty">Ничего не найдено в справочнике</div>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ display: isNameFocused ? 'none' : 'block', animation: 'fadeIn 0.2s ease' }}>
                  <div className="eim-row" style={{marginBottom: 12}}>
                  <div className="eim-sec" style={{flex: 1.5, paddingBottom: 0}}>
                    <div className="eim-meal-tabs">
                      <button className={`eim-mtab ${mealType==='breakfast'?'active':''}`} onClick={()=>setMealType('breakfast')}>Завтрак</button>
                      <button className={`eim-mtab ${mealType==='lunch'?'active':''}`} onClick={()=>setMealType('lunch')}>Обед</button>
                      <button className={`eim-mtab ${mealType==='dinner'?'active':''}`} onClick={()=>setMealType('dinner')}>Ужин</button>
                      <button className={`eim-mtab ${mealType==='snack'?'active':''}`} onClick={()=>setMealType('snack')}>Перекус</button>
                    </div>
                  </div>
                </div>

                <div className="eim-sec" style={{marginBottom: 4}}>
                  <div className="eim-lbl">Порция</div>
                  <div className="eim-portion-frame" style={{height: 58}}>
                    <input 
                      className="eim-portion-val" 
                      type="number" 
                      value={portion} 
                      onChange={e => setPortion(parseFloat(e.target.value)||0)} 
                    />
                    <div className="eim-portion-toggle">
                      <button className={`eim-pu-btn ${portionUnit==='г'?'active':''}`} onClick={()=>setPortionUnit('г')}>г</button>
                      <button className={`eim-pu-btn ${portionUnit==='мл'?'active':''}`} onClick={()=>setPortionUnit('мл')}>мл</button>
                      {/* Removed 'шт' as requested (v2.84.0) */}
                    </div>
                  </div>
                </div>

                <div className="eim-sec" style={{marginBottom: 16}}>
                  <div className="eim-date-row">
                    <span className="eim-date-lbl">Когда:</span>
                    <input className="eim-date-inp" type="date" value={logDate} onChange={e=>setLogDate(e.target.value)} />
                    <input className="eim-date-inp" style={{textAlign: 'right'}} type="time" value={logTime} onChange={e=>setLogTime(e.target.value)} />
                  </div>
                </div>

                <div className="eim-sec" style={{marginTop: 8}}>
                  <div className="eim-kribbon glass-panel">
                    <div className="eim-krib-main">
                      <div className="eim-krib-kcal">{isLinked ? calcKcal : '—'}</div>
                      <div className="eim-krib-unit">ккал</div>
                    </div>
                    <div className="eim-krib-sep"></div>
                    <div className="eim-krib-macros">
                      <div className="eim-krib-m">Б: <b>{isLinked ? calcP : '0'}</b></div>
                      <div className="eim-krib-m">Ж: <b>{isLinked ? calcF : '0'}</b></div>
                      <div className="eim-krib-m">У: <b>{isLinked ? calcC : '0'}</b></div>
                    </div>
                  </div>
                </div>

                </div>

                <div className="eim-divider-mini" style={{margin: '12px 0'}} />

                <div className="eim-sec">
                  <div className="eim-deduct-smart-toggle-wrap">
                    <div 
                      className={`eim-deduct-smart-toggle glass-panel ${!canDeduct ? 'disabled' : ''} ${deductFromStock ? 'active' : ''}`} 
                      onClick={() => canDeduct && setDeductFromStock(!deductFromStock)}
                    >
                      <div className="edst-icon-wrap">
                        <span className="edst-icon">{deductFromStock ? '🧊' : '❄️'}</span>
                      </div>
                      <div className="edst-info">
                        <div className="edst-title">{deductFromStock ? 'Списать из холодильника' : 'Оставить в наличии'}</div>
                      </div>
                      <div className={`edst-switch ${deductFromStock ? 'on' : ''}`}>
                        <div className="edst-switch-knob" />
                      </div>
                    </div>
                    {!canDeduct && isLinked && (
                      <div className="edst-error animated-pop">
                        ⚠️ Единицы не совпадают ({unit} ≠ {portionUnit})
                      </div>
                    )}
                  </div>
                </div>

                <div className="eim-actions" style={{marginTop: 20}}>
                  <button className="eim-btn eim-b-cancel" style={{flex: .65}} onClick={onClose}>Отмена</button>
                  <button className="eim-btn eim-b-log" onClick={handleLogDiary}>✓ Записать в дневник</button>
                </div>
              </div>

            </div>
      </div>
    </>
  );

  return createPortal(modalContent, document.body);
};
