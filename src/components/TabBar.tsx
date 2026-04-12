import React, { useRef } from 'react';
import './TabBar.css';

interface TabBarProps {
  tabs: { id: string; label: string; icon: string; isMain?: boolean; hasBadge?: boolean }[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isRecording?: boolean;
  onChatTabRepeat?: () => void;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTab,
  setActiveTab,
  isRecording = false,
  onChatTabRepeat
}) => {
  const touchStartXRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);

  return (
          ? 'rgba(52, 199, 89, 0.85)'
          : dockedSide === 'left'
          ? 'rgba(0, 122, 255, 0.85)'
          : undefined,
        transition: 'background 0.3s ease'
      }}
    >
      {/* Corner hints — visible based on swipe distance */}
      <span className={`tabbar-corner-hint left ${dragX !== null && dragX < -10 ? 'hint-visible' : ''} ${dockedSide === 'left' ? 'hint-triggered' : ''}`}>📷</span>
      <span className={`tabbar-corner-hint right ${dragX !== null && dragX > 10 ? 'hint-visible' : ''} ${dockedSide === 'right' ? 'hint-triggered' : ''}`}>🎙️</span>

      <div
        className="tab-indicator"
        style={{ transform: `translateX(calc(${tabs.findIndex(t => t.id === activeTab) * 100}%))` }}
      />
      {tabs.map((tab) => {
        const isChat = tab.id === 'chat';
        const isInputActive = smartInputState && smartInputState !== 'hidden';
        const displayLabel = isChat ? (isInputActive ? 'Чат' : 'Добавить') : tab.label;
        const displayIcon = isChat ? (isInputActive ? '💬' : 'AI +') : tab.icon;
        
        const isSwiping = dragX !== null && Math.abs(dragX) > 10;
        const isRecording = smartInputState === 'recording';

        return (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'on' : ''} ${tab.isMain || isChat ? 'tab-chat-main' : ''} ${isChat && isInputActive ? 'is-active-capsule' : ''} ${!isChat && isSwiping ? 'quick-hidden' : ''}`}
            style={isChat && dragX !== null ? { transform: `translateX(${dragX * 0.9}px)`, transition: 'none' } : undefined}
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
            <div className={`ticon ${isChat ? 'is-main-capsule' : ''} ${isChat && isRecording ? 'is-recording-capsule' : ''} ${isChat && dockedSide === 'left' ? 'docked-left' : ''} ${isChat && dockedSide === 'right' ? 'docked-right' : ''}`} key={displayIcon}>
              {isChat && isRecording ? (
                <span className="capsule-mic">🎙️</span>
              ) : isChat && !isInputActive ? (
                <>
                  <span className="capsule-plus">+</span>
                  <span className="tlabel inside-label">AI</span>
                </>
              ) : isChat && isInputActive ? (
                <>
                  {displayIcon}
                  <span className="tlabel inside-label">{displayLabel}</span>
                </>
              ) : (
                displayIcon
              )}
              {tab.hasBadge && <span className="tab-badge" />}
            </div>
            {!isChat && <span className="tlabel" key={displayLabel}>{displayLabel}</span>}
          </button>
        );
      })}
    </nav>
  );
};
