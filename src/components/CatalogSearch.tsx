import React, { useState, useEffect, useRef } from 'react';
import { mapBackendCategory } from '../utils/data';
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
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const searchTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const query = search.trim();
    if (query.length < 2) {
      setResults([]);
      return;
    }

    if (searchTimeoutRef.current) {
      window.clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
        const res = await fetch(`${backendUrl}/api/catalog/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          // Pre-map the backend categories immediately for filtering
          const items = (data.results || []).map((i: any) => ({
            ...i,
            mappedCat: mapBackendCategory(i.category || i.cat)
          }));
          setResults(items);
        }
      } catch (err) {
        console.error("Failed to fetch catalog search", err);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => {
      if (searchTimeoutRef.current) {
        window.clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [search]);

  const filteredItems = results.filter(item => {
    const matchesCat = selectedCat === 'all' || item.mappedCat === selectedCat;
    return matchesCat;
  });

  return (
    <div className="catalog-container">
      <div className="catalog-header">
        <div className="catalog-top">
          <button className="back-btn" onClick={onBack}>←</button>
          <div className="catalog-title">Выбрать из базы {isSearching && '...'}</div>
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
          <div key={`${item.id || item.name}-${idx}`} className="catalog-item" onClick={() => onSelect(item)}>
            <div className="ci-icon">
              {item.mappedCat === 'Фрукты и ягоды' ? '🍎' : 
               item.mappedCat === 'Овощи' ? '🥦' : 
               item.mappedCat === 'Молочные продукты' ? '🥛' : 
               item.mappedCat === 'Мясо и птица' ? '🥩' : 
               item.mappedCat === 'Рыба и морепродукты' ? '🐟' : 
               item.mappedCat === 'Орехи и семена' ? '🥜' : '📦'}
            </div>
            <div className="ci-info">
              <div className="ci-name">{item.canonical_name || item.name}</div>
              <div className="ci-sub">{item.mappedCat}</div>
            </div>
            <div className="ci-kcal">
              {item.per_100g?.kcal ?? item.kcal} <span>ккал</span>
            </div>
          </div>
        ))}
        {filteredItems.length === 0 && search.length >= 2 && !isSearching && (
          <div className="catalog-empty">
            Продукт не найден в базе :(
          </div>
        )}
      </div>
    </div>
  );
};
