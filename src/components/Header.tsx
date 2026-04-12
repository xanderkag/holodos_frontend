import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './Header.css';

interface HeaderProps {
  title: string;
  stores: { name: string }[];
  currentStore: number;
  onStoreChange: (index: number) => void;
  showStoreSelector: boolean;
  onAddStore?: (name: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ title, stores, currentStore, onStoreChange, showStoreSelector, onAddStore }) => {
  const { logout, isTMA } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAdd = () => {
    const name = window.prompt('Введите название нового магазина:');
    if (name && name.trim()) {
      onAddStore?.(name.trim());
      setIsOpen(false);
    }
  };

  return (
    <header className="glass-header">
      <div className="hdr-row">
        <div className="hdr-left">
          <div className="hdr-title">{title}</div>
        </div>
        
        <div className="hdr-right">
          {showStoreSelector && (
            <div className="store-dropdown" ref={dropdownRef}>
              <div className="dd-selected" onClick={() => setIsOpen(!isOpen)}>
                <span className="dd-sname">
                  {stores[currentStore]?.name || 'Магазин'}
                </span>
                <div className={`dd-arrow ${isOpen ? 'open' : ''}`}>▼</div>
              </div>
              
              <div className={`dd-menu ${isOpen ? 'open' : ''}`}>
                {stores.map((s, i) => (
                  <div 
                    key={i} 
                    className={`dd-item ${i === currentStore ? 'active' : ''}`}
                    onClick={() => {
                      onStoreChange(i);
                      setIsOpen(false);
                    }}
                  >
                    <span>{s.name}</span>
                    {i === currentStore && <span>✓</span>}
                  </div>
                ))}
                <div className="dd-item dd-add" onClick={handleAdd}>
                  <span>+</span> Добавить
                </div>
                {!isTMA && (
                  <div className="dd-item dd-logout" onClick={() => logout()}>
                    <span>🚪</span> Выйти
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
