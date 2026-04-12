import React, { useRef, useState } from 'react';
import './TabBar.css';

interface TabBarProps {
  tabs: { id: string; label: string; icon: string; isMain?: boolean; hasBadge?: boolean }[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onChatTabSwipe?: (direction: 'left' | 'right') => void;
  smartInputState?: 'hidden' | 'active' | 'recording' | 'media';
  onChatTabRepeat?: () => void;
  onChatTabGestureEnd?: () => void;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTab,
  setActiveTab,
  onChatTabSwipe,
  smartInputState,
  onChatTabRepeat,
  onChatTabGestureEnd
}) => {
  const touchStartXRef = useRef<number | null>(null);
  const [dragX, setDragX] = useState<number | null>(null);
  const suppressClickRef = useRef(false);
  const isDraggingRef = useRef(false);
  const CONFIRM_THRESHOLD = 80; // Reduced for easier activation

  return (
    <nav
      className="glass-tabbar animated-slide-up"
      style={
        dragX !== null && dragX > CONFIRM_THRESHOLD / 2
          ? { background: `rgba(52, 199, 89, ${Math.min((dragX - CONFIRM_THRESHOLD / 2) / 80, 0.85)})` }
          : dragX !== null && dragX < -CONFIRM_THRESHOLD / 2
          ? { background: `rgba(0, 122, 255, ${Math.min((Math.abs(dragX) - CONFIRM_THRESHOLD / 2) / 80, 0.85)})` }
          : undefined
      }
    >
      {/* Corner hints — только во время свайпа */}
      <span className={`tabbar-corner-hint left ${dragX !== null ? 'hint-visible' : ''} ${dragX !== null && dragX < -CONFIRM_THRESHOLD ? 'hint-triggered' : ''}`}>📷</span>
      <span className={`tabbar-corner-hint right ${dragX !== null ? 'hint-visible' : ''} ${dragX !== null && dragX > CONFIRM_THRESHOLD ? 'hint-triggered' : ''}`}>🎙️</span>

      <div
        className="tab-indicator"
        style={{ transform: `translateX(calc(${tabs.findIndex(t => t.id === activeTab) * 100}%))` }}
      />
      {tabs.map((tab) => {
        const isChat = tab.id === 'chat';
        const isInputActive = smartInputState && smartInputState !== 'hidden';
        
        const displayLabel = isChat 
          ? (isInputActive ? 'Чат' : 'Добавить')
          : tab.label;
        
        const displayIcon = isChat
          ? (isInputActive ? '💬' : 'AI +')
          : tab.icon;

        const isRecording = smartInputState === 'recording';

        return (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'on' : ''} ${tab.isMain || isChat ? 'tab-chat-main' : ''} ${isChat && isInputActive ? 'is-active-capsule' : ''}`}
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
              isDraggingRef.current = false;
              setDragX(0);
            }}
            onTouchMove={(e) => {
              if (!isChat || touchStartXRef.current === null) return;
              const deltaX = e.touches[0].clientX - touchStartXRef.current;
              if (Math.abs(deltaX) > 8) {
                isDraggingRef.current = true;
                suppressClickRef.current = true;
                setDragX(deltaX);
                e.preventDefault(); // prevent scroll while swiping
              }
            }}
            onTouchEnd={(e) => {
              if (!isChat || touchStartXRef.current === null) return;
              const deltaX = (e.changedTouches[0]?.clientX ?? touchStartXRef.current) - touchStartXRef.current;
              touchStartXRef.current = null;
              setDragX(null);
              if (isDraggingRef.current) {
                if (deltaX > CONFIRM_THRESHOLD) {
                  onChatTabSwipe?.('right');
                } else if (deltaX < -CONFIRM_THRESHOLD) {
                  onChatTabSwipe?.('left');
                }
                if (onChatTabGestureEnd) onChatTabGestureEnd();
              }
              isDraggingRef.current = false;
              setTimeout(() => { suppressClickRef.current = false; }, 50);
            }}
            onTouchCancel={() => {
              touchStartXRef.current = null;
              setDragX(null);
              isDraggingRef.current = false;
              if (onChatTabGestureEnd) onChatTabGestureEnd();
            }}
          >
            <div className={`ticon ${isChat ? 'is-main-capsule' : ''} ${isChat && isRecording ? 'is-recording-capsule' : ''}`} key={displayIcon}>
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
