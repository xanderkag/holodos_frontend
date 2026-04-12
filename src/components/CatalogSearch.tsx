import React, { useState, useMemo } from 'react';
import { GLOBAL_CATALOG } from '../utils/catalogData';
import './CatalogSearch.css';

interface CatalogSearchProps {
  onBack: () => void;
  onSelect: (item: any) => void;
  initialQuery?: string;
}

const CATEGORIES = [
  { id: 'all', label: 'Все', icon: '🔍' },
  { id: 'Молочные продукты', label: 'Молочное', icon: '🥛' },
  { id: 'Мясо и птица', label: 'Мясо', icon: '🥩' },
  { id: 'Рыба и морепродукты', label: 'Рыба', icon: '🐟' },
  { id: 'Овощи', label: 'Овощи', icon: '🥦' },
  { id: 'Фрукты и ягоды', label: 'Фрукты', icon: '🍎' },
  { id: 'Макароны и крупы', label: 'Крупы', icon: '🌾' },
  { id: 'Орехи и семена', label: 'Орехи', icon: '🥜' },
  { id: 'Сладости и десерты', label: 'Сладости', icon: '🍫' }
];

export const CatalogSearch: React.FC<CatalogSearchProps> = ({ onBack, onSelect, initialQuery = '' }) => {
  const [search, setSearch] = useState(initialQuery);
  const [selectedCat, setSelectedCat] = useState('all');

  const normalize = (s: string) => s.toLowerCase().trim()
    .replace(/[ыиаеоя]$/, '') // Remove common plural/case endings
    .replace(/ /g, '');

  const filteredItems = useMemo(() => {
    const q = normalize(search);
    return GLOBAL_CATALOG.filter(item => {
      const nameNorm = normalize(item.name);
      const matchesSearch = nameNorm.includes(q) || 
                           item.aliases?.some(a => normalize(a).includes(q));
      const matchesCat = selectedCat === 'all' || item.cat === selectedCat;
      return matchesSearch && matchesCat;
    });
  }, [search, selectedCat]);

  return (
    <div className="catalog-container">
      <div className="catalog-header">
        <div className="catalog-top">
          <button className="back-btn" onClick={onBack}>←</button>
          <div className="catalog-title">Выбрать из базы</div>
        </div>
        <div className="search-wrap">
          <span className="search-icon">🔍</span>
          <input 
            className="search-input" 
            type="text" 
            placeholder="Поиск продукта..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>
        <div className="cat-chips">
          {CATEGORIES.map(cat => (
            <button 
              key={cat.id}
              className={`cat-chip ${selectedCat === cat.id ? 'active' : ''}`}
              onClick={() => setSelectedCat(cat.id)}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>
      </div>

      <div className="catalog-list">
        {filteredItems.map((item, idx) => (
          <div key={`${item.name}-${idx}`} className="catalog-item" onClick={() => onSelect(item)}>
            <div className="ci-icon">
              {item.cat === 'Фрукты и ягоды' ? '🍎' : 
               item.cat === 'Овощи' ? '🥦' : 
               item.cat === 'Молочные продукты' ? '🥛' : 
               item.cat === 'Мясо и птица' ? '🥩' : 
               item.cat === 'Рыба и морепродукты' ? '🐟' : 
               item.cat === 'Орехи и семена' ? '🥜' : '📦'}
            </div>
            <div className="ci-info">
              <div className="ci-name">{item.name}</div>
              <div className="ci-sub">{item.cat}</div>
            </div>
            <div className="ci-kcal">
              {item.kcal} <span>ккал</span>
            </div>
          </div>
        ))}
        {filteredItems.length === 0 && (
          <div className="catalog-empty">
            Продукт не найден в базе :(
          </div>
        )}
      </div>
    </div>
  );
};
