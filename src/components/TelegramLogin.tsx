import React, { useEffect, useRef } from 'react';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

interface TelegramLoginProps {
  botName: string;
  onAuth: (user: TelegramUser) => void;
  buttonSize?: 'large' | 'medium' | 'small';
  cornerRadius?: number;
  requestAccess?: boolean;
  usePic?: boolean;
}

export const TelegramLogin: React.FC<TelegramLoginProps> = ({
  botName,
  onAuth,
  buttonSize = 'large',
  cornerRadius,
  requestAccess = true,
  usePic = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 1. Define global callback
    (window as any).onTelegramAuth = (user: TelegramUser) => {
      onAuth(user);
    };

    // 2. Create and inject script
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', botName);
    script.setAttribute('data-size', buttonSize);
    if (cornerRadius) script.setAttribute('data-radius', cornerRadius.toString());
    script.setAttribute('data-request-access', requestAccess ? 'write' : 'read');
    script.setAttribute('data-userpic', usePic ? 'true' : 'false');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.async = true;

    if (containerRef.current) {
      containerRef.current.appendChild(script);
    }

    // Cleanup
    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      delete (window as any).onTelegramAuth;
    };
  }, [botName, buttonSize, cornerRadius, requestAccess, usePic, onAuth]);

  const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  if (isLocal) {
    return (
      <div className="tg-login-placeholder" style={{ 
        opacity: 0.5, 
        fontSize: '12px', 
        textAlign: 'center',
        padding: '10px',
        border: '1px dashed rgba(255,255,255,0.2)',
        borderRadius: '12px'
      }}>
        Telegram Login (Disabled on Localhost)
      </div>
    );
  }

  return <div ref={containerRef} className="tg-login-widget-container" />;
};
