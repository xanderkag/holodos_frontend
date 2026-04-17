import React, { useEffect, useState } from 'react';
import './LimitPaywallModal.css';

export type PaywallType = 'voice' | 'image' | 'chat' | null;

interface LimitPaywallModalProps {
  type: PaywallType;
  onClose: () => void;
  onUpgrade: () => void;
}

export const LimitPaywallModal: React.FC<LimitPaywallModalProps> = ({ type, onClose, onUpgrade }) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (type) {
      // Small delay for entrance animation
      const t = setTimeout(() => setShow(true), 10);
      return () => clearTimeout(t);
    } else {
      setShow(false);
    }
  }, [type]);

  if (!type && !show) return null;

  const content = {
    voice: {
      icon: '🎙️',
      title: 'Лимит голосовых',
      desc: 'Вы исчерпали дневной лимит бесплатных голосовых задач. Перейдите на PRO, чтобы продолжить общаться голосом без ограничений.'
    },
    image: {
      icon: '📸',
      title: 'Лимит фотографий',
      desc: 'Вы исчерпали дневной лимит распознавания фото. Перейдите на PRO, чтобы продолжить загружать фотографии холодильника и чеков.'
    },
    chat: {
      icon: '💬',
      title: 'Лимит запросов',
      desc: 'Вы исчерпали дневной лимит ИИ-запросов. Перейдите на PRO для безлимитного доступа к ассистенту.'
    }
  }[type || 'chat'];

  const handleClose = () => {
    setShow(false);
    setTimeout(onClose, 400); // Wait for transition
  };

  return (
    <div className={`paywall-overlay ${show ? 'show' : ''}`} onClick={(e) => {
      // Close if clicked on overlay
      if (e.target === e.currentTarget) handleClose();
    }}>
      <div className="paywall-modal">
        <div className="paywall-icon">{content.icon}</div>
        <div className="paywall-title">{content.title}</div>
        <div className="paywall-desc">{content.desc}</div>
        
        <button className="paywall-btn-pro" onClick={() => {
          handleClose();
          onUpgrade();
        }}>
          ✨ Подключить PRO
        </button>
        <button className="paywall-btn-close" onClick={handleClose}>
          Позже
        </button>
      </div>
    </div>
  );
};
