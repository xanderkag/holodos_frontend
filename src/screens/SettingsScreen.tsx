import { useState } from 'react';
import type { UiSettings, UserData } from '../types';
import { logout } from '../utils/firebase';
import { TelegramLogin } from '../components/TelegramLogin';
import { showToast } from '../components/Toast';
import { APP_VERSION, BUILD_TIME } from '../constants/version';
import { useHealthSync } from '../hooks/useHealthSync';
import { Capacitor } from '@capacitor/core';
import './SettingsScreen.css';
import { ProfileLimitCard } from '../components/ProfileLimitCard';

interface SettingsScreenProps {
  user: any;
  stats: UserData['stats'];
  isAdmin?: boolean;
  onAdminClick?: () => void;
  showDebug?: boolean;
  setShowDebug?: (show: boolean) => void;
  uiSettings: UiSettings;
  onUpdateUiSettings: (settings: Partial<UiSettings>) => void;
  calorieNorm: number;
  onUpdateCalorieNorm: (norm: number) => void;
  macroNorms: { protein: number; fat: number; carbs: number };
  onUpdateMacroNorms: (n: { protein: number; fat: number; carbs: number }) => void;
  onFactoryReset: () => void;
  onLinkTelegram?: (tgData: any) => Promise<void>;
}

export const SettingsScreen = ({ 
  user, stats, 
  isAdmin = false, onAdminClick, showDebug, setShowDebug, 
  uiSettings, onUpdateUiSettings, 
  calorieNorm, onUpdateCalorieNorm,
  macroNorms, onUpdateMacroNorms,
  onFactoryReset,
  onLinkTelegram
}: SettingsScreenProps) => {

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const { healthData, requestPermissions, syncData } = useHealthSync();
  const isAndroid = Capacitor.getPlatform() === 'android';

  const handleLogout = async () => {
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

  const inputStyle = {
    width: '64px',
    background: 'rgba(0,0,0,0.05)',
    border: 'none',
    borderRadius: '8px',
    padding: '5px 8px',
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--t1)',
    textAlign: 'right' as const,
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
            <div className="s-name-col" style={{ flex: 1 }}>
              <div className="s-name">{user?.displayName || user?.email || 'Пользователь'}</div>
              {user?.telegramHandle
                ? <div className="s-email-sub">@{user.telegramHandle}</div>
                : user?.email && !user.email.endsWith('@telegram') && <div className="s-email-sub">{user.email}</div>
              }
            </div>
            {/* Logout btn inline with profile */}
            <button
              className="logout-btn-inline"
              onClick={handleLogout}
              title="Выйти из аккаунта"
            >
              🚪
            </button>
          </div>
          
          {/* Telegram link section */}
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

        {/* Health & Nutrition Section */}
        <div className="s-section glass-panel health-section" style={{marginBottom: 16}}>
          <h3 className="s-sect-title">{Capacitor.isNativePlatform() ? 'Здоровье и Питание' : 'Питание'}</h3>
          
          {/* Calorie norm */}
          <div className="settings-item has-action" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0'}}>
            <div className="si-left" style={{display: 'flex', alignItems: 'center', gap: 10}}>
              <span className="si-icon" style={{fontSize: 18}}>🎯</span>
              <div className="si-text">
                <div className="si-label" style={{fontWeight: 600, fontSize: 14, color: 'var(--t1)'}}>Калории</div>
                <div className="si-sub" style={{fontSize: 11, color: 'var(--t3)'}}>ккал / день</div>
              </div>
            </div>
            <input type="number" value={calorieNorm} onChange={(e) => onUpdateCalorieNorm(Number(e.target.value) || 2000)} style={inputStyle} />
          </div>

          {/* Macro norms */}
          <div style={{borderTop: '1px solid var(--br-glass)', paddingTop: 10, paddingBottom: 2}}>
            <div style={{fontSize: 12, fontWeight: 600, color: 'var(--t3)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6}}>
              <span>⚖️</span> Нормы БЖУ (г / день)
            </div>
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8}}>
              {([
                { key: 'protein', label: 'Белки', emoji: '🥩' },
                { key: 'fat',     label: 'Жиры',  emoji: '🧈' },
                { key: 'carbs',   label: 'Углев.', emoji: '🍞' },
              ] as const).map(({ key, label, emoji }) => (
                <div key={key} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4}}>
                  <div style={{fontSize: 11, color: 'var(--t3)', fontWeight: 600}}>{emoji} {label}</div>
                  <input
                    type="number"
                    value={macroNorms[key]}
                    onChange={(e) => onUpdateMacroNorms({ ...macroNorms, [key]: Number(e.target.value) || 0 })}
                    style={{ ...inputStyle, width: '100%', textAlign: 'center' as const }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Health sync - Mobile Only */}
          {Capacitor.isNativePlatform() && (
            <div
              className="settings-item has-action"
              onClick={async () => {
                const granted = await requestPermissions();
                if (granted) syncData();
              }}
              style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '10px 0', borderTop: '1px solid var(--br-glass)', marginTop: 10}}
            >
              <div className="si-left" style={{display: 'flex', alignItems: 'center', gap: 10}}>
                <span className="si-icon" style={{fontSize: 18}}>🏥</span>
                <div className="si-text">
                  <div className="si-label" style={{fontWeight: 600, fontSize: 14, color: 'var(--t1)'}}>Синхронизация</div>
                  <div className="si-sub" style={{fontSize: 11, color: 'var(--t3)'}}>
                    {healthData
                      ? `Активно • ${new Date(healthData.lastSync).toLocaleDateString()}`
                      : isAndroid ? 'Подключить Google Health' : 'Подключить Apple Health'}
                  </div>
                </div>
              </div>
              <div className={`si-toggle ${healthData ? 'on' : ''}`} style={{width: 40, height: 22, borderRadius: 11, background: healthData ? 'var(--grn)' : 'rgba(0,0,0,0.1)', position: 'relative', transition: 'all 0.2s', flexShrink: 0}}>
                <div style={{width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: healthData ? 21 : 3, transition: 'all 0.2s'}}></div>
              </div>
            </div>
          )}
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
          </div>
        </div>

        {/* Usage Stats Section — compact */}
        <div className="s-section glass-panel">
          <h3 className="s-sect-title">Аналитика использования</h3>
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6}}>
            {[
              { icon: '🎤', label: 'Голос', data: stats?.voice },
              { icon: '💬', label: 'Чат',   data: stats?.chat },
              { icon: '📸', label: 'Фото',  data: stats?.image },
            ].map(({ icon, label, data }) => (
              <div key={label} style={{
                background: 'rgba(0,0,0,0.04)',
                borderRadius: 12,
                padding: '8px 6px',
                textAlign: 'center',
              }}>
                <div style={{fontSize: 16, marginBottom: 2}}>{icon}</div>
                <div style={{fontSize: 11, color: 'var(--t3)', marginBottom: 4, fontWeight: 600}}>{label}</div>
                <div style={{display: 'flex', justifyContent: 'space-around'}}>
                  {[['24ч', data?.d], ['мес', data?.m], ['∞', data?.t]].map(([lbl, val]) => (
                    <div key={lbl as string} style={{textAlign: 'center'}}>
                      <div style={{fontSize: 13, fontWeight: 700, color: 'var(--t1)'}}>{val || 0}</div>
                      <div style={{fontSize: 9, color: 'var(--t3)'}}>{lbl}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Danger Zone — factory reset only */}
        <div className="s-section glass-panel danger-zone">
          <h3 className="s-sect-title">Сброс данных</h3>
          <button 
            className={`reset-btn ${showResetConfirm ? 'confirm' : ''}`} 
            onClick={handleReset}
          >
            {showResetConfirm ? '🚨 УДАЛИТЬ ВСЕ ДАННЫЕ?' : '🧹 Сброс до заводских'}
          </button>
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
