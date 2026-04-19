import React, { useState } from 'react';
import type { DiaryEntry } from '../../types';
import { ClarificationInline } from './ClarificationInline';

interface ChatDiaryMessageProps {
  entryId: string;
  source: 'voice' | 'photo' | 'text';
  transcript?: string;
  items: DiaryEntry[];
  onClarify: (itemId: string, quantity: number, unit: string) => void;
  onSkip: (itemId: string) => void;
}

export const ChatDiaryMessage: React.FC<ChatDiaryMessageProps> = ({
  source,
  transcript,
  items,
  onClarify,
  onSkip,
}) => {
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  const pendingItems = items.filter(it => it.needsClarification);
  const timestamp = items[0]?.consumedAt ?? Date.now();

  const totalKcal = items.reduce((sum, it) => {
    if (it.needsClarification) return sum;
    return sum + (it.kcal || 0);
  }, 0);

  const cardStyle: React.CSSProperties = {
    padding: '12px 14px',
    borderRadius: '16px',
    background: 'var(--sf)',
    border: '1px solid var(--border)',
    fontSize: '14px',
    color: 'var(--t1)',
    maxWidth: '100%',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
    color: 'var(--t2)',
    fontSize: '12px',
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '5px 0',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    cursor: 'pointer',
  };

  const nameStyle: React.CSSProperties = {
    flex: 1,
    fontWeight: '600',
  };

  const qtyStyle: React.CSSProperties = {
    color: 'var(--t2)',
    fontSize: '12px',
    minWidth: '50px',
    textAlign: 'right',
  };

  const kcalStyle: React.CSSProperties = {
    color: 'var(--t2)',
    fontSize: '12px',
    minWidth: '60px',
    textAlign: 'right',
  };

  const footerStyle: React.CSSProperties = {
    marginTop: '10px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  };

  const clarifyBtnStyle: React.CSSProperties = {
    padding: '5px 12px',
    borderRadius: '20px',
    background: 'rgba(255, 149, 0, 0.12)',
    color: 'var(--acc)',
    border: '1px solid rgba(255, 149, 0, 0.3)',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  };

  const sourceLabel = source === 'voice' ? '🎙️ Голос' : source === 'photo' ? '📸 Фото' : '💬 Текст';
  const timeStr = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const handleRowClick = (item: DiaryEntry) => {
    if (!item.needsClarification) return;
    setActiveItemId(prev => prev === item.id ? null : item.id);
  };

  const handleClarify = (itemId: string, quantity: number, unit: string) => {
    onClarify(itemId, quantity, unit);
    setActiveItemId(null);
  };

  const handleSkip = (itemId: string) => {
    onSkip(itemId);
    setActiveItemId(null);
  };

  const openFirstPending = () => {
    const first = pendingItems[0];
    if (first) setActiveItemId(first.id);
  };

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <span>🤖 Записал в дневник · {sourceLabel}</span>
        <span>{timeStr}</span>
      </div>

      {transcript && (
        <div style={{ fontSize: '12px', color: 'var(--t2)', marginBottom: '8px', fontStyle: 'italic' }}>
          "{transcript}"
        </div>
      )}

      <div>
        {items.length === 0 ? (
          <div style={{ 
            padding: '12px 14px', 
            margin: '8px 0',
            fontSize: '13px', 
            color: 'var(--t2)', 
            background: 'rgba(255,149,0,0.08)',
            borderLeft: '3px solid var(--acc)',
            borderRadius: '6px'
          }}>
            <div style={{ fontWeight: '600', color: 'var(--acc)', marginBottom: '4px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              ⚠️ Уточнение
            </div>
            Не удалось точно распознать продукты. Попробуйте описать их чуть подробнее (например: «Я съел бургер 250г»).
          </div>
        ) : (
          items.map(item => (
            <div key={item.id}>
              <div
                style={rowStyle}
                onClick={() => handleRowClick(item)}
              >
                <span style={{ fontSize: '14px' }}>
                  {item.needsClarification ? '⚠️' : '✅'}
                </span>
                <span style={nameStyle}>{item.name}</span>
                <span style={qtyStyle}>
                  {item.needsClarification ? '? г' : (item.qty || '—')}
                </span>
                <span style={kcalStyle}>
                  {item.needsClarification ? '— ккал' : `${Math.round(item.kcal || 0)} ккал`}
                </span>
              </div>
              {activeItemId === item.id && item.needsClarification && item.clarificationHint && (
                <ClarificationInline
                  hint={item.clarificationHint}
                  itemName={item.name}
                  field={item.clarificationField || 'quantity'}
                  onConfirm={(qty, unit) => handleClarify(item.id, qty, unit)}
                  onSkip={() => handleSkip(item.id)}
                />
              )}
            </div>
          ))
        )}
      </div>

      <div style={footerStyle}>
        <span style={{ fontSize: '13px', color: 'var(--t2)' }}>
          Итого (известно): <strong>{Math.round(totalKcal)} ккал</strong>
        </span>
        {pendingItems.length > 0 && (
          <button style={clarifyBtnStyle} onClick={openFirstPending}>
            Уточнить {pendingItems.length} позиц.
          </button>
        )}
      </div>
    </div>
  );
};
