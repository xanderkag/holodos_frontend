import { useState } from 'react';
import type { UiSettings, UserData } from '../types';
import { logout } from '../utils/firebase';
import { TelegramLogin } from '../components/TelegramLogin';
import { showToast } from '../components/Toast';
import { APP_VERSION, BUILD_TIME } from '../constants/version';
import { useHealthSync } from '../hooks/useHealthSync';
import './SettingsScreen.css';
import { ProfileLimitCard } from '../components/ProfileLimitCard';

interface SettingsScreenProps {
  user: any; // Changed from User to any to support hybrid TG/Firebase user
  stats: UserData['stats'];
  isAdmin?: boolean;
  onAdminClick?: () => void;
  showDebug?: boolean;
  setShowDebug?: (show: boolean) => void;
  uiSettings: UiSettings;
  onUpdateUiSettings: (settings: Partial<UiSettings>) => void;
  onFactoryReset: () => void;
  onLinkTelegram?: (tgData: any) => Promise<void>;
}

export const SettingsScreen = ({ 
  user, stats, 
  isAdmin = false, onAdminClick, showDebug, setShowDebug, 
  uiSettings, onUpdateUiSettings, onFactoryReset,
  onLinkTelegram
}: SettingsScreenProps) => {

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const { healthData, requestPermissions } = useHealthSync();

  const handleLogout = async () => {
    if (!showLogoutConfirm) {
      setShowLogoutConfirm(true);
      setTimeout(() => setShowLogoutConfirm(false), 3000);
      return;
    }

    try {
      await logout();
    } catch (e: any) {
      showToast(`❌ Ошибка при выходе: ${e.message}`);
    }
  };
  
  const handleReset = () => {
    if (!showResetConfirm) {
      setShowResetConfirm(true);
      setTimeout(() => setShowResetConfirm(false), 4000);
      return;
    }
    onFactoryReset();
    setShowResetConfirm(false);
  };

  return (
    <div className="screen settings-screen">
      <div className="settings-container">
        
        {/* Profile Section */}
        <div className="s-profile glass-panel">
          <div className="s-avatar-row">
            <div className="s-avatar">
              {user?.photoURL ? <img src={user.photoURL} alt="p" className="s-avatar-img" /> : (user?.email ? user.email[0].toUpperCase() : 'U')}
            </div>
            <div className="s-name-col">
              <div className="s-name">{user?.displayName || user?.email || 'Пользователь'}</div>
              {user?.telegramHandle
                ? <div className="s-email-sub">@{user.telegramHandle}</div>
                : user?.email && !user.email.endsWith('@telegram') && <div className="s-email-sub">{user.email}</div>
              }
            </div>
          </div>
          
          {/* In TMA: TG handle already shown under name — skip redundant section */}
          {!(window as any).Telegram?.WebApp?.initData && (
            <div className="s-tg-status">
              {user?.telegramHandle ? (
                <div className="tg-linked">
                  <span className="tg-icon">🕊️</span>
                  <div className="tg-info">
                    <span className="tg-label">Связано с Telegram</span>
                    <span className="tg-handle">@{user.telegramHandle}</span>
                  </div>
                </div>
              ) : (
                <div className="tg-link-area">
                  <p className="tg-link-tip">Привяжите Telegram, чтобы пользоваться ботом и Mini App</p>
                  <TelegramLogin
                    botName={import.meta.env.VITE_TELEGRAM_BOT_USERNAME || "xanderkage"}
                    onAuth={(data) => onLinkTelegram?.(data)}
                    buttonSize="large"
                    cornerRadius={14}
                  />
                </div>
              )}
            </div>
          )}

          <div style={{marginTop: 16}}>
            <ProfileLimitCard hideHeader onUpgradeClick={() => {
              const botName = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'HolodosAI_bot';
              const tgUrl = `https://t.me/${botName}`;
              if ((window as any).Telegram?.WebApp?.openTelegramLink) {
                (window as any).Telegram.WebApp.openTelegramLink(tgUrl);
              } else {
                window.open(tgUrl, '_blank');
              }
            }} />
          </div>
        </div>

        {/* Health Integration Section */}
        <div className="s-section glass-panel health-section" style={{marginBottom: 16}}>
          <h3 className="s-sect-title">Данные здоровья</h3>
          <div className="settings-item has-action" onClick={requestPermissions} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '12px 0'}}>
            <div className="si-left" style={{display: 'flex', alignItems: 'center', gap: 12}}>
              <span className="si-icon" style={{fontSize: 20}}>🏥</span>
              <div className="si-text">
                <div className="si-label" style={{fontWeight: 600, fontSize: 15, color: 'var(--t1)'}}>Синхронизация</div>
                <div className="si-sub" style={{fontSize: 12, color: 'var(--t3)'}}>{healthData ? `Активно • ${new Date(healthData.lastSync).toLocaleDateString()}` : 'Подключить Apple / Google Health'}</div>
              </div>
            </div>
            <div className={`si-toggle ${healthData ? 'on' : ''}`} style={{width: 44, height: 24, borderRadius: 12, background: healthData ? 'var(--grn)' : 'rgba(0,0,0,0.1)', position: 'relative', transition: 'all 0.2s'}}>
              <div style={{width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: healthData ? 23 : 3, transition: 'all 0.2s'}}></div>
            </div>
          </div>
        </div>

        {/* Appearance Section */}
        <div className="s-section glass-panel">
          <h3 className="s-sect-title">Внешний вид</h3>
          <div className="appearance-controls">
            <div className="a-control-item" style={{alignItems: 'center'}}>
              <span className="a-label">Тема интерфейса</span>
              <div className="theme-selector-grid">
                <div 
                  className={`theme-card ${uiSettings.theme !== 'dark' ? 'active' : ''}`}
                  onClick={() => onUpdateUiSettings({ theme: 'system' })}
                >
                  <div className="theme-preview light-bg">
                    <div className="mock-bubble assistant"></div>
                    <div className="mock-bubble user"></div>
                  </div>
                  <div className="theme-name">Светлая</div>
                </div>

                <div 
                  className={`theme-card ${uiSettings.theme === 'dark' ? 'active' : ''}`}
                  onClick={() => onUpdateUiSettings({ theme: 'dark' })}
                >
                  <div className="theme-preview dark-bg">
                    <div className="mock-bubble assistant"></div>
                    <div className="mock-bubble user"></div>
                  </div>
                  <div className="theme-name">Тёмная</div>
                </div>
              </div>
            </div>

            <div className="a-control-item">
              <span className="a-label">Плотность интерфейса</span>
              <div className="ui-capsule">
                <button 
                  className={`ui-pill ${uiSettings.density === 'comfortable' ? 'active' : ''}`}
                  onClick={() => onUpdateUiSettings({ density: 'comfortable' })}
                >
                  ☁️ Комфорт
                </button>
                <button 
                  className={`ui-pill ${uiSettings.density === 'compact' ? 'active' : ''}`}
                  onClick={() => onUpdateUiSettings({ density: 'compact' })}
                >
                  ✨ Компакт
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Usage Stats Section */}
        <div className="s-section glass-panel">
          <h3 className="s-sect-title">Аналитика использования</h3>
          <div className="usage-stats-grid">
            <div className="u-stats-header">
              <span>Тип</span>
              <span>24ч</span>
              <span>Месяц</span>
              <span>Итого</span>
            </div>
            
            <div className="u-stats-row">
              <span className="u-stats-label">🎤 Голос</span>
              <span className="u-stats-val">{stats?.voice.d || 0}</span>
              <span className="u-stats-val">{stats?.voice.m || 0}</span>
              <span className="u-stats-val">{stats?.voice.t || 0}</span>
            </div>
            
            <div className="u-stats-row">
              <span className="u-stats-label">💬 Чат</span>
              <span className="u-stats-val">{stats?.chat.d || 0}</span>
              <span className="u-stats-val">{stats?.chat.m || 0}</span>
              <span className="u-stats-val">{stats?.chat.t || 0}</span>
            </div>
            
            <div className="u-stats-row">
              <span className="u-stats-label">📸 Фото</span>
              <span className="u-stats-val">{stats?.image.d || 0}</span>
              <span className="u-stats-val">{stats?.image.m || 0}</span>
              <span className="u-stats-val">{stats?.image.t || 0}</span>
            </div>
          </div>
        </div>

        {/* Account Section */}
        <div className="s-section glass-panel danger-zone">
           <h3 className="s-sect-title">Аккаунт и Безопасность</h3>
           <div className="account-actions">
              <button 
                className={`logout-btn ${showLogoutConfirm ? 'confirm' : ''}`} 
                onClick={handleLogout}
              >
                {showLogoutConfirm ? '⚠️ Подтвердить выход' : '🚪 Выйти из аккаунта'}
              </button>
              
              <button 
                className={`reset-btn ${showResetConfirm ? 'confirm' : ''}`} 
                onClick={handleReset}
                style={{ marginTop: '12px' }}
              >
                {showResetConfirm ? '🚨 УДАЛИТЬ ВСЕ ДАННЫЕ?' : '🧹 Сброс до заводских'}
              </button>
           </div>
        </div>

        {/* Admin Tools */}
        {isAdmin && (
          <>
            <div className="s-section glass-panel">
              <h3 className="s-sect-title">Инструменты (Админ)</h3>
              
              <button 
                className="s-diag-btn" 
                onClick={() => showToast('Диагностика запущена...')}
              >
                Запустить диагностику систем
              </button>

              <button 
                className="s-diag-btn admin-dash-btn" 
                onClick={onAdminClick}
                style={{ marginTop: '12px' }}
              >
                📊 Открыть дашборд аналитики
              </button>
              
              <button 
                className="s-diag-btn" 
                onClick={() => setShowDebug?.(!showDebug)}
                style={{ marginTop: '12px' }}
              >
                {showDebug ? '🔍 Скрыть консоль отладки' : '🔍 Показать консоль отладки'}
              </button>
            </div>

            <div className="s-section glass-panel">
              <h3 className="s-sect-title">Админ-лог (голос)</h3>
              <div className="v-log-container">
                <div className="v-log-empty">Логов пока нет...</div>
              </div>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="s-footer">
          <p>Версия {APP_VERSION} ({BUILD_TIME})</p>
          <p>© 2026 HOLODOS AI</p>
        </div>
      </div>
    </div>
  );
};
