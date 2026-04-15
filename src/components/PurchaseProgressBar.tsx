import React from 'react';
import './PurchaseProgressBar.css';

interface PurchaseProgressBarProps {
  purchasedCount: number;
  totalCount: number;
}

export const PurchaseProgressBar: React.FC<PurchaseProgressBarProps> = ({
  purchasedCount,
  totalCount,
}) => {
  if (totalCount === 0) return null;

  const progress = (purchasedCount / totalCount) * 100;

  return (
    <div className="prog-container animated-pop">
      <span className="prog-stat">{purchasedCount} из {totalCount}</span>
      <div className="prog-track">
        <div className="prog-fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
};

