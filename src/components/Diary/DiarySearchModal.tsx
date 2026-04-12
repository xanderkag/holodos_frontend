import React, { useState, useMemo } from 'react';
import type { Item } from '../../types';
import { CAT_COLORS } from '../../utils/data';

interface DiarySearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (item: Item, qty: string) => void;
  baseline: Item[];
  stock: Item[];
}

export const DiarySearchModal: React.FC<DiarySearchModalProps> = ({ 
  isOpen, onClose, onSelect, baseline, stock 
}) => {
  const [query, setQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [qty, setQty] = useState('100г');

  const combinedItems = useMemo(() => {
    const map = new Map<string, Item>();
    baseline.forEach((i: Item) => map.set(i.name.toLowerCase(), i));
    stock.forEach((i: Item) => map.set(i.name.toLowerCase(), i));
    return Array.from(map.values());
  }, [baseline, stock]);

  const filtered = useMemo(() => {
    if (!query) return [];
    return combinedItems
      .filter((i: Item) => i.name.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 10);
  }, [combinedItems, query]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-panel animated-pop" style={{maxWidth: '450px', width: '90%', padding: '24px'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
          <h3 style={{margin: 0, fontSize: '20px'}}>🔍 Поиск еды</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {!selectedItem ? (
          <>
            <div className="smart-input-wrap" style={{marginBottom: '16px'}}>
              <input 
                className="ios-input"
                autoFocus
                placeholder="Что съели?"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
            
            <div className="recent-results" style={{maxHeight: '300px', overflowY: 'auto'}}>
              {filtered.map((item: Item) => (
                <div 
                  key={item.id} 
                  className="list-item clickable animated-pop" 
                  onClick={() => {
                    setSelectedItem(item);
                    setQty(item.qty || '100г');
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', 
                    borderRadius: '16px', background: 'rgba(0,0,0,0.03)', marginBottom: '8px'
                  }}
                >
                  <div style={{width: '6px', height: '24px', borderRadius: '4px', background: CAT_COLORS[item.cat] || '#ccc'}} />
                  <div style={{flex: 1}}>
                    <div style={{fontWeight: '600'}}>{item.name}</div>
                    <div style={{fontSize: '12px', opacity: 0.6}}>
                      {item.kcal} ккал • {item.cat}
                    </div>
                  </div>
                </div>
              ))}
              {query && filtered.length === 0 && (
                <div style={{textAlign: 'center', padding: '20px', opacity: 0.5}}>Ничего не найдено</div>
              )}
            </div>
          </>
        ) : (
          <div className="qty-confirm animated-pop">
            <div style={{textAlign: 'center', marginBottom: '24px'}}>
              <div style={{fontSize: '32px', marginBottom: '8px'}}>🥣</div>
              <div style={{fontSize: '18px', fontWeight: '700'}}>{selectedItem.name}</div>
              <div style={{fontSize: '14px', opacity: 0.6}}>{selectedItem.kcal} ккал на 100г</div>
            </div>

            <div className="smart-input-wrap" style={{marginBottom: '24px'}}>
              <label style={{fontSize: '12px', textTransform: 'uppercase', fontWeight: 700, opacity: 0.5, marginBottom: '4px', display: 'block'}}>Сколько съели?</label>
              <input 
                className="ios-input"
                autoFocus
                placeholder="Например: 150г или 2 шт"
                value={qty}
                onChange={e => setQty(e.target.value)}
              />
            </div>

            <div style={{display: 'flex', gap: '12px'}}>
              <button className="confirm-btn" style={{flex: 1}} onClick={() => onSelect(selectedItem, qty)}>Добавить</button>
              <button className="cancel-btn" onClick={() => setSelectedItem(null)}>Назад</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
