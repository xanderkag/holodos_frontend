import React from 'react';
import './ActionSheet.css';

interface ActionSheetOption {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

interface ActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  options: ActionSheetOption[];
}

export const ActionSheet: React.FC<ActionSheetProps> = ({ isOpen, onClose, options }) => {
  return (
    <div className={`as-overlay ${isOpen ? 'show' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="as-sheet">
        <div className="as-menu">
          {options.map((opt, i) => (
            <div 
              key={i} 
              className={`as-opt ${opt.danger ? 'danger' : ''}`}
              onClick={() => { opt.onClick(); onClose(); }}
            >
              {opt.label}
            </div>
          ))}
        </div>
        <div className="as-cancel" onClick={onClose}>
          Отмена
        </div>
      </div>
    </div>
  );
};
