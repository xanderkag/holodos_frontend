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
  const [dockedSide, setDockedSide] = useState<'none' | 'left' | 'right'>('none');
  const suppressClickRef = useRef(false);
  const isDraggingRef = useRef(false);
  const isRecordingRef = useRef(false);
  const CONFIRM_THRESHOLD = 80;

  return (
      style={{
        background: dockedSide === 'right'
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
                
                // Docking logic
                if (deltaX > CONFIRM_THRESHOLD) {
                  if (dockedSide !== 'right') {
                    setDockedSide('right');
                    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(12);
                    // Hold-to-record trigger: start recording immediately on docking right
                    if (!isRecordingRef.current) {
                      onChatTabSwipe?.('right');
                      isRecordingRef.current = true;
                    }
                  }
                } else if (deltaX < -CONFIRM_THRESHOLD) {
                  if (dockedSide !== 'left') {
                    setDockedSide('left');
                    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(12);
                  }
                } else {
                  if (dockedSide !== 'none') setDockedSide('none');
                }
                
                e.preventDefault();
              }
            }}
            onTouchEnd={(e) => {
              if (!isChat || touchStartXRef.current === null) return;
              touchStartXRef.current = null;
              setDragX(null);
              setDockedSide('none');
              
              if (isDraggingRef.current) {
                // If we were recording (hold-to-talk), stop it now
                if (isRecordingRef.current) {
                  onChatTabGestureEnd?.();
                  isRecordingRef.current = false;
                } else if (dockedSide === 'left') {
                  // For camera, trigger on release
                  onChatTabSwipe?.('left');
                }
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
