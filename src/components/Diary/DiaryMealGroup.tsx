import React, { useState, memo } from 'react';
import type { DiaryEntry } from '../../types';
import ItemRow from '../ItemRow';
import { ClarificationInline } from './ClarificationInline';

interface DiaryMealGroupProps {
  meal: { id: string; label: string; icon: string };
  items: DiaryEntry[];
  onAddClick: (mealId: string) => void;
  onRemoveItem: (id: string) => void;
  onEditItem: (entry: DiaryEntry) => void;
  onClarifyItem?: (itemId: string, quantity: number, unit: string) => void;
}

export const DiaryMealGroupInner: React.FC<DiaryMealGroupProps> = ({ meal, items, onAddClick, onRemoveItem, onEditItem, onClarifyItem }) => {
  const [isExpanded, setIsExpanded] = useState(items.length > 0);
  const [clarifyingItemId, setClarifyingItemId] = useState<string | null>(null);
  const mealKcal = items.reduce((sum, it) => sum + (it.kcal || 0), 0);

  return (
    <div className="meal-group glass-panel animated-pop" style={{marginBottom: '16px', padding: '16px', borderRadius: '24px'}}>
      <div 
        style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer'}}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
          <span style={{fontSize: '24px'}}>{meal.icon}</span>
          <div style={{fontWeight: '700', fontSize: '16px', color: '#1A1916'}}>{meal.label}</div>
          {items.length > 0 && <span style={{fontSize: '12px', opacity: 0.4}}>{items.length} поз.</span>}
        </div>
        
        <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
          <div style={{fontSize: '14px', fontWeight: '700', color: mealKcal > 0 ? '#1A1916' : '#B0AEA8'}}>
            {Math.round(mealKcal)} ккал
          </div>
          <button 
            className="meal-add-btn" 
            onClick={(e) => { e.stopPropagation(); onAddClick(meal.id); }}
            style={{
              width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255,149,0,0.1)', 
              color: '#FF9500', border: 'none', fontWeight: '700', fontSize: '18px', display: 'flex', 
              alignItems: 'center', justifyContent: 'center'
            }}
          >
            ＋
          </button>
          <span style={{fontSize: '12px', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s'}}>▼</span>
        </div>
      </div>

      {isExpanded && items.length > 0 && (
        <div className="meal-items-list animated-pop" style={{display: 'flex', flexDirection: 'column', marginTop: '16px'}}>
          {items.map(m => (
            <div key={m.id}>
              <div style={{ position: 'relative' }}>
                {m.needsClarification && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '-4px',
                      transform: 'translateY(-50%)',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: '#FF9500',
                      zIndex: 1,
                      pointerEvents: 'none',
                    }}
                  />
                )}
                <ItemRow
                  item={{
                    ...m,
                    cat: 'Другое',
                    notes: '' // v2.86.0: Remove redundant weight/notes in diary list
                  } as any}
                  onRowClick={() => {
                    if (m.needsClarification) {
                      setClarifyingItemId(prev => prev === m.id ? null : m.id);
                    } else {
                      onEditItem(m);
                    }
                  }}
                  onEdit={() => onEditItem(m)} // v2.88.0: Restore edit button (3 dots)
                  onSwipeLeft={() => onRemoveItem(m.id)}
                  swipeLeftIcon="✕"
                  hideBullet={true}
                  onSwipeRight={undefined}
                />
              </div>
              {clarifyingItemId === m.id && m.needsClarification && m.clarificationHint && (
                <ClarificationInline
                  hint={m.clarificationHint}
                  itemName={m.name}
                  field={m.clarificationField || 'quantity'}
                  onConfirm={(qty, unit) => {
                    if (onClarifyItem) onClarifyItem(m.id, qty, unit);
                    setClarifyingItemId(null);
                  }}
                  onSkip={() => {
                    if (onClarifyItem) onClarifyItem(m.id, 0, '');
                    setClarifyingItemId(null);
                  }}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const DiaryMealGroup = memo(DiaryMealGroupInner, (prev, next) =>
  prev.meal.id === next.meal.id &&
  prev.items.length === next.items.length &&
  prev.items.reduce((s, i) => s + (i.kcal || 0), 0) === next.items.reduce((s, i) => s + (i.kcal || 0), 0) &&
  prev.items.every((it, idx) => it.id === next.items[idx]?.id)
);
