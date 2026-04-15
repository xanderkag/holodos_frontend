import React from 'react';
import './SmartHints.css';

export interface SmartHint {
  id: string;
  label: string;
  icon?: string;
  onClick: () => void;
  type?: 'primary' | 'secondary' | 'accent';
}

interface SmartHintsProps {
  hints: SmartHint[];
}

export const SmartHints: React.FC<SmartHintsProps> = ({ hints }) => {
  if (!hints || hints.length === 0) return null;

  return (
    <div className="smart-hints-container">
      <div className="smart-hints-scroll">
        {hints.map((hint) => (
          <button 
            key={hint.id} 
            className={`smart-hint-chip type-${hint.type || 'primary'}`}
            onClick={(e) => {
              e.preventDefault();
              // Add a small delay to trigger haptic feedback or animation before executing
              if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
                navigator.vibrate(15);
              }
              hint.onClick();
            }}
          >
            {hint.icon && <span className="sh-icon">{hint.icon}</span>}
            <span className="sh-label">{hint.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
