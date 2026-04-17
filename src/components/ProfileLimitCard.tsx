import React from 'react';
import './ProfileLimitCard.css';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { getUserSubscriptionInfo } from '../utils/subscription';

interface ProfileLimitCardProps {
  onUpgradeClick?: () => void;
  hideHeader?: boolean;
}

export const ProfileLimitCard: React.FC<ProfileLimitCardProps> = ({ onUpgradeClick, hideHeader }) => {
  const { user } = useAuth();
  const { stats, isSubscribed, subscriptionType } = useData();

  const info = getUserSubscriptionInfo({ stats, isSubscribed, subscriptionType } as any);
  const isPro = info.tariffId === 'pro';

  // Calculate percentages
  const photoPct = Math.min(100, Math.max(0, (info.limits.photos.used / info.limits.photos.limit) * 100));
  const voicePct = Math.min(100, Math.max(0, (info.limits.voice.used / info.limits.voice.limit) * 100));

  const getFillClass = (pct: number, type: 'photo' | 'voice') => {
    if (pct >= 100) return 'fill-depleted';
    if (pct > 80) return 'fill-warning';
    return type === 'photo' ? 'fill-photo' : 'fill-voice';
  };

  const displayName = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'Профиль';

  return (
    <div className={`profile-limit-card ${hideHeader ? 'no-header' : ''}`}>
      {!hideHeader && (
        <div className="limit-card-header">
          <div className="limit-card-title">
            <div style={{ fontSize: '18px' }}>👤</div>
            {displayName}
          </div>
          <div className={`limit-card-badge ${isPro ? 'pro' : 'free'}`}>
            {isPro ? 'PRO' : 'FREE'}
          </div>
        </div>
      )}

      <div className="limit-bars-container">
        {/* Photo Limit */}
        <div className="limit-bar-row">
          <div className="limit-bar-labels">
            <span>📷 Распознавание фото</span>
            <span>{info.limits.photos.remaining} / {info.limits.photos.limit}</span>
          </div>
          <div className="limit-bar-track">
            <div 
              className={`limit-bar-fill ${getFillClass(photoPct, 'photo')}`} 
              style={{ width: `${photoPct}%` }}
            />
          </div>
        </div>

        {/* Voice Limit */}
        <div className="limit-bar-row">
          <div className="limit-bar-labels">
            <span>🎙️ Голосовые задачи</span>
            <span>{info.limits.voice.remaining} / {info.limits.voice.limit}</span>
          </div>
          <div className="limit-bar-track">
            <div 
              className={`limit-bar-fill ${getFillClass(voicePct, 'voice')}`} 
              style={{ width: `${voicePct}%` }}
            />
          </div>
        </div>
      </div>

      {!isPro && (
        <div className="limit-card-action">
          <button className="limit-action-btn" onClick={onUpgradeClick}>
            ✨ Подключить PRO
          </button>
        </div>
      )}
    </div>
  );
};
