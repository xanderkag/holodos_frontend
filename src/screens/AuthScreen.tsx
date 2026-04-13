import { useState } from 'react';
import { loginWithEmail, registerWithEmail } from '../utils/firebase';
import { APP_VERSION } from '../constants/version';
import { useAuth } from '../context/AuthContext';
import { mapAuthErrorToMessage } from '../utils/auth';
import { TelegramLogin } from '../components/TelegramLogin';
import { logAuthAudit } from '../utils/authLogger';
import { isNativePlatform } from '../utils/firebase';
import './AuthScreen.css';

export const AuthScreen = () => {
  const { user, loading: authLoading, login, loginWithTelegramWidget, authError, isTMA } = useAuth();
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [error, setError] = useState<string | null>(null);

  const handleTelegramWidget = async (tgUser: any) => {
    logAuthAudit({ 
      provider: 'telegram', channel: 'telegram_widget', stage: 'attempt', 
      message: 'Telegram widget button clicked/auth started' 
    });
    setLoading(true);
    try {
      await loginWithTelegramWidget(tgUser);
    } catch (e: any) {
      setError(mapAuthErrorToMessage(e));
      setLoading(false);
    }
  };

  const handleGo = async () => {
    if (!email.trim() || !pass.trim()) {
      setError('Заполните все поля');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const authPromise = activeTab === 'register'
        ? registerWithEmail(email.trim(), pass)
        : loginWithEmail(email.trim(), pass);

      await authPromise;
    } catch (e: any) {
      console.error(e);
      setError(mapAuthErrorToMessage(e));
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    logAuthAudit({ 
      provider: 'google', channel: isNativePlatform ? 'android' : 'web', stage: 'attempt', 
      message: 'Google login button clicked' 
    });
    setError(null);
    setLoading(true);
    try {
      // Use context login() — it calls setUser(result.user) explicitly
      await login();
    } catch (e: any) {
      console.error('Google auth error:', e);
      setError(mapAuthErrorToMessage(e));
      setLoading(false);
    }
  };

  const handleYandex = () => {
    logAuthAudit({ 
      provider: 'yandex', channel: isNativePlatform ? 'android' : 'web', stage: 'redirect_start', 
      message: 'Redirecting to backend for Yandex OAuth' 
    });
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
    window.location.href = `${backendUrl}/auth/yandex`;
  };

  if (authLoading && !user) {
    return (
      <div className="auth-screen loading-flex">
        <div className="auth-logo pulse">
          <img src="/logo.png" alt="Holodos AI" className="auth-logo-img" />
        </div>
        <div className="cat-name">HOLODOS AI</div>
        <div className="auth-subtitle">Загрузка вселенной...</div>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <div className="auth-card glass-panel animated-pop">
        <div className="auth-header">
           <div className="auth-logo">
             <img src="/logo.png" alt="Holodos AI" className="auth-logo-img" />
           </div>
           <h1 className="auth-title">HOLODOS AI</h1>
           <p className="auth-subtitle">Умный ассистент для ваших продуктов</p>
        </div>

        <div className="auth-card-body-inner">
          <div className="auth-tabs-wrap">
            <div className="auth-tabs"> 
              <button 
                className={`auth-tab ${activeTab === 'login' ? 'active' : ''}`}
                onClick={() => { setActiveTab('login'); setError(null); }}
              >
                Вход
              </button>
              <button 
                className={`auth-tab ${activeTab === 'register' ? 'active' : ''}`}
                onClick={() => { setActiveTab('register'); setError(null); }}
              >
                Регистрация
              </button>
            </div>
          </div>

          {(error || authError) && (
            <div className="auth-error-pill animated-pop">
              {error || authError}
            </div>
          )}

          <div className="auth-form">
            <div className="input-group">
              <input
                type="email"
                placeholder="Email"
                className="auth-input"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
              <input
                type="password"
                placeholder="Пароль"
                className="auth-input"
                value={pass}
                onChange={e => setPass(e.target.value)}
              />
            </div>

            <button className="auth-main-btn" onClick={handleGo} disabled={loading}>
              {loading ? 'ЗАГРУЗКА...' : activeTab === 'login' ? 'ВОЙТИ' : 'СОЗДАТЬ АККАУНТ'}
            </button>
          </div>

          <div className="auth-divider">
            <span>или войти через</span>
          </div>

          <div className="soc-row-unified">
            <div className="soc-item">
              <TelegramLogin 
                botName={import.meta.env.VITE_TELEGRAM_BOT_USERNAME || "HolodosAI_bot"} 
                onAuth={handleTelegramWidget}
                buttonSize="medium"
                cornerRadius={100}
              />
            </div>

            <button className="soc-item google" onClick={handleGoogle} title="Google">
              <img src="https://www.svgrepo.com/show/355037/google.svg" alt="Google" />
            </button>

            <button className="soc-item yandex" onClick={handleYandex} title="Яндекс">
              <svg width="24" height="24" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="20" cy="20" r="20" fill="#E62F31"/>
                <path d="M22.5 28H20.1V14.1H18.6C16.9 14.1 15.6 15.1 15.6 16.7C15.6 17.9 16.4 18.9 17.6 19.3L19 19.8V22L16.6 21.3C14.1 20.5 12.6 18.8 12.6 16.3C12.6 13.3 14.9 11.2 18.1 11.2H22.5V28Z" fill="white"/>
              </svg>
            </button>
          </div>

          <div className="auth-demo-row">
            <button
              className="auth-demo-btn"
              onClick={() => {
                localStorage.setItem('demo_mode', 'true');
                window.location.reload();
              }}
            >
              👀 Попробовать без регистрации
            </button>
          </div>
        </div>
      </div>

      <div className="auth-footer">
        <p>© 2026 HOLODOS AI • v{APP_VERSION}</p>
        
        {/* Diagnostic Labels (Visible in dev/staging) */}
        {window.location.hostname.includes('localhost') || window.location.hostname.includes('staging') ? (
          <div style={{ marginTop: '12px', opacity: 0.4, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Context: {isTMA ? 'Telegram Mini App' : 'Web Browser'} | 
            {window.location.search.includes('yandex') ? ' Yandex Callback' : ''}
            {localStorage.getItem('auth_uid') ? ' Persistent Session' : ''}
          </div>
        ) : null}
      </div>
    </div>
  );
};
// Triggering new Vercel build at Thu Apr  9 18:40:09 MSK 2026
