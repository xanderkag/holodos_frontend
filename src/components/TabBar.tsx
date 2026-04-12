import React, { useRef } from 'react';
import './TabBar.css';

interface TabBarProps {
  tabs: { id: string; label: string; icon: string; isMain?: boolean; hasBadge?: boolean }[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onChatTabRepeat?: () => void;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTab,
  setActiveTab,
  onChatTabRepeat
}) => {
  const touchStartXRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);

  return (
    <nav className="glass-tabbar animated-slide-up">
      <div
        className="tab-indicator"
        style={{ transform: `translateX(calc(${tabs.findIndex(t => t.id === activeTab) * 100}%))` }}
      />
      {tabs.map((tab) => {
        const isChat = tab.id === 'chat';
        const displayLabel = tab.label;
        const displayIcon = tab.icon;
        
        return (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'on' : ''} ${tab.isMain || isChat ? 'tab-chat-main' : ''}`}
            onClick={() => {
              if (suppressClickRef.current) {
                suppressClickRef.current = false;
                return;
              }
              if (isChat && activeTab === 'chat') {
                if (onChatTabRepeat) onChatTabRepeat();
                else setActiveTab('chat');
                return;
              }
              setActiveTab(tab.id);
            }}
            onTouchStart={(e) => {
              if (!isChat) return;
              touchStartXRef.current = e.touches[0].clientX;
            }}
            onTouchMove={(e) => {
              if (!isChat || touchStartXRef.current === null) return;
              const deltaX = e.touches[0].clientX - touchStartXRef.current;
              if (Math.abs(deltaX) > 10) {
                suppressClickRef.current = true;
              }
            }}
            onTouchEnd={() => {
              touchStartXRef.current = null;
              setTimeout(() => { suppressClickRef.current = false; }, 50);
            }}
            onTouchCancel={() => {
              touchStartXRef.current = null;
            }}
          >
            <div className={`ticon ${isChat ? 'is-main-capsule' : ''}`} key={displayIcon}>
              {displayIcon}
              {tab.hasBadge && <span className="tab-badge" />}
            </div>
            {!isChat && <span className="tlabel" key={displayLabel}>{displayLabel}</span>}
          </button>
        );
      })}
    </nav>
  );
};
