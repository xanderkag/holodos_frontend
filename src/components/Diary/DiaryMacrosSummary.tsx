import React from 'react';

interface DiaryMacrosSummaryProps {
  remainingKcal: number;
  eatenKcal: number;
  activeKcal: number;
  eatenP: number;
  targetP: number;
  eatenF: number;
  targetF: number;
  eatenC: number;
  targetC: number;
}

export const DiaryMacrosSummary: React.FC<DiaryMacrosSummaryProps> = ({
  remainingKcal, eatenKcal, activeKcal, eatenP, targetP, eatenF, targetF, eatenC, targetC
}) => {
  return (
    <div className="diary-summary glass-panel animated-pop">
      <div className="summary-main">
        <div className="kcal-ring">
          <div className="kcal-val">{Math.round(remainingKcal).toLocaleString()}</div>
          <div className="kcal-lbl">ккал осталось</div>
        </div>
        <div className="summary-stats">
          <div className="stat-item">
            <span className="stat-val">{Math.round(eatenKcal).toLocaleString()}</span>
            <span className="stat-lbl">Съедено</span>
          </div>
          <div className="stat-item">
            <span className="stat-val">{Math.round(activeKcal).toLocaleString()}</span>
            <span className="stat-lbl">Треня</span>
          </div>
        </div>
      </div>
      <div className="macro-shelf">
        <div className="macro-item">
          <div className="macro-bar"><div className="macro-fill p" style={{width: `${Math.min(100, (eatenP / targetP) * 100)}%`}}></div></div>
          <div className="macro-info"><span>Белки</span><b>{Math.round(eatenP)}/{targetP}г</b></div>
        </div>
        <div className="macro-item">
          <div className="macro-bar"><div className="macro-fill f" style={{width: `${Math.min(100, (eatenF / targetF) * 100)}%`}}></div></div>
          <div className="macro-info"><span>Жиры</span><b>{Math.round(eatenF)}/{targetF}г</b></div>
        </div>
        <div className="macro-item">
          <div className="macro-bar"><div className="macro-fill c" style={{width: `${Math.min(100, (eatenC / targetC) * 100)}%`}}></div></div>
          <div className="macro-info"><span>Углеводики</span><b>{Math.round(eatenC)}/{targetC}г</b></div>
        </div>
      </div>
    </div>
  );
};
