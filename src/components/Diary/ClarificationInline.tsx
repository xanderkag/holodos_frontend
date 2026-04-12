import React, { useState } from 'react';

interface ClarificationInlineProps {
  hint: string;
  itemName: string;
  field: 'quantity' | 'unit' | 'name' | 'calories';
  onConfirm: (quantity: number, unit: string) => void;
  onSkip: () => void;
}

const QUANTITY_CHIPS = [50, 100, 150, 200, 300];
const UNIT_CHIPS = ['г', 'мл', 'шт', 'ст.л', 'чашка'];

export const ClarificationInline: React.FC<ClarificationInlineProps> = ({
  hint,
  field,
  onConfirm,
  onSkip,
}) => {
  const [inputVal, setInputVal] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('г');

  const handleChipQuantity = (qty: number) => {
    onConfirm(qty, selectedUnit);
  };

  const handleChipUnit = (unit: string) => {
    onConfirm(1, unit);
  };

  const handleManualConfirm = () => {
    const num = parseFloat(inputVal);
    if (!isNaN(num) && num > 0) {
      onConfirm(num, selectedUnit);
    }
  };

  const wrapStyle: React.CSSProperties = {
    marginTop: '8px',
    padding: '10px 12px',
    borderRadius: '12px',
    background: 'rgba(255, 149, 0, 0.08)',
    border: '1px solid rgba(255, 149, 0, 0.25)',
  };

  const hintStyle: React.CSSProperties = {
    fontSize: '13px',
    color: 'var(--t2)',
    marginBottom: '8px',
  };

  const chipRowStyle: React.CSSProperties = {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
    marginBottom: '8px',
  };

  const chipStyle: React.CSSProperties = {
    padding: '4px 10px',
    borderRadius: '20px',
    border: '1px solid var(--acc)',
    background: 'transparent',
    color: 'var(--acc)',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  };

  const inputRowStyle: React.CSSProperties = {
    display: 'flex',
    gap: '6px',
    alignItems: 'center',
  };

  const inputStyle: React.CSSProperties = {
    flex: 1,
    padding: '5px 10px',
    borderRadius: '10px',
    border: '1px solid var(--border)',
    background: 'var(--sf)',
    color: 'var(--t1)',
    fontSize: '14px',
    outline: 'none',
    minWidth: 0,
  };

  const selectStyle: React.CSSProperties = {
    padding: '5px 8px',
    borderRadius: '10px',
    border: '1px solid var(--border)',
    background: 'var(--sf)',
    color: 'var(--t1)',
    fontSize: '13px',
    outline: 'none',
  };

  const confirmBtnStyle: React.CSSProperties = {
    padding: '5px 12px',
    borderRadius: '10px',
    background: 'var(--acc)',
    color: '#fff',
    border: 'none',
    fontWeight: '700',
    fontSize: '13px',
    cursor: 'pointer',
  };

  const skipBtnStyle: React.CSSProperties = {
    padding: '5px 8px',
    borderRadius: '10px',
    background: 'transparent',
    color: 'var(--t3)',
    border: 'none',
    fontSize: '12px',
    cursor: 'pointer',
  };

  return (
    <div style={wrapStyle}>
      <div style={hintStyle}>{hint}</div>

      {field === 'unit' ? (
        <div style={chipRowStyle}>
          {UNIT_CHIPS.map(u => (
            <button key={u} style={chipStyle} onClick={() => handleChipUnit(u)}>
              {u}
            </button>
          ))}
        </div>
      ) : (
        <>
          <div style={chipRowStyle}>
            {QUANTITY_CHIPS.map(qty => (
              <button key={qty} style={chipStyle} onClick={() => handleChipQuantity(qty)}>
                {qty}г
              </button>
            ))}
          </div>
          <div style={inputRowStyle}>
            <input
              style={inputStyle}
              type="number"
              min="1"
              placeholder="Кол-во..."
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleManualConfirm()}
            />
            <select
              style={selectStyle}
              value={selectedUnit}
              onChange={e => setSelectedUnit(e.target.value)}
            >
              {UNIT_CHIPS.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
            <button style={confirmBtnStyle} onClick={handleManualConfirm}>
              OK
            </button>
          </div>
        </>
      )}

      <button style={skipBtnStyle} onClick={onSkip}>
        Пропустить
      </button>
    </div>
  );
};
