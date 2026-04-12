import React from 'react';
import './PurchaseProgressBar.css';

interface PurchaseProgressBarProps {
  purchasedCount: number;
  totalCount: number;
  onFinish: () => void;
}

export const PurchaseProgressBar: React.FC<PurchaseProgressBarProps> = ({
  purchasedCount,
  totalCount,
  onFinish
}) => {
  if (totalCount === 0) return null;

  const progress = (purchasedCount / totalCount) * 100;

  return (
    <div className="prog-container animated-pop">
      <div className="prog-row">
        <span className="prog-stat">{purchasedCount} из {totalCount}</span>
        <div className="prog-track">
          <div className="prog-fill" style={{ width: `${progress}%` }} />
        </div>
        {purchasedCount > 0 && (
          <button className="finish-shopping-btn-slim animated-fade-in" onClick={onFinish}>
            В Холодос 🧊
          </button>
        )}
      </div>
    </div>
  );
};
