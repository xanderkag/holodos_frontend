import React from 'react';
import { showToast } from './Toast';
import './DebugOverlay.css';

export interface DebugLog {
  id: string;
  time: string;
  level: 'info' | 'net' | 'warn' | 'error';
  message: string;
}

interface DebugOverlayProps {
  logs: DebugLog[];
  onClear: () => void;
  onClose: () => void;
}

export const DebugOverlay: React.FC<DebugOverlayProps> = ({ logs, onClear, onClose }) => {
  const handleCopy = () => {
    const text = logs.map(l => `[${l.time}] ${l.level.toUpperCase()}: ${l.message}`).reverse().join('\n');
    navigator.clipboard.writeText(text).then(() => {
      showToast('📋 Логи скопированы!');
    }).catch(err => {
      console.error('Failed to copy logic:', err);
      showToast('❌ Ошибка копирования логов');
    });
  };

  return (
    <div className="debug-overlay">
      <div className="debug-header">
        <span className="debug-title">System Logs</span>
        <div className="debug-controls">
          <button className="debug-btn" onClick={handleCopy} title="Copy logs">📋</button>
          <button className="debug-btn" onClick={onClear} title="Clear logs">🗑️</button>
          <button className="debug-btn" onClick={onClose} title="Close console">✕</button>
        </div>
      </div>
      <div className="debug-content">
        {logs.map((log) => (
          <div key={log.id} className={`debug-line ${log.level}`}>
            <span className="debug-time">[{log.time}]</span>
            {log.message}
          </div>
        )).reverse()} {/* Show latest logs at the bottom if scrolling, but here we reverse to show latest at top for easy reading */}
      </div>
    </div>
  );
};
