import React, { useRef, useState, useEffect } from 'react';
import './TabBar.css';

interface TabBarProps {
  tabs: { id: string; label: string; icon: string; isMain?: boolean; hasBadge?: boolean }[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  smartInputState?: 'hidden' | 'active' | 'recording' | 'media';
  onChatTabSwipe?: (direction: 'left' | 'right') => void;
  onChatTabRepeat?: () => void;
  onChatTabGestureEnd?: () => void;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTab,
  setActiveTab,
  smartInputState,
  onChatTabSwipe,
  onChatTabRepeat,
  onChatTabGestureEnd
}) => {
  const touchStartXRef = useRef<number | null>(null);
  const [dragX, setDragX] = useState<number | null>(null);
  const [dockedSide, setDockedSide] = useState<'none' | 'left' | 'right'>('none');
  const suppressClickRef = useRef(false);
  const CONFIRM_THRESHOLD = 80;

  // Reset drag when input state changes (e.g. recording started)
  useEffect(() => {
    if (smartInputState === 'hidden') {
      setDragX(null);
      setDockedSide('none');
    }
  }, [smartInputState]);

  const isRecording = smartInputState === 'recording';
  const isSwiping = dragX !== null && Math.abs(dragX) > 10 && !isRecording;

  // Visual "Fill" percentage based on drag distance
  const fillPercent = dragX !== null ? Math.min(Math.abs(dragX) / CONFIRM_THRESHOLD * 100, 100) : 0;
  const fillColor = dragX !== null && dragX < 0 ? 'rgba(0, 122, 255, 0.85)' : 'rgba(52, 199, 89, 0.85)';

  return (
    <nav
      className={`glass-tabbar animated-slide-up ${isRecording ? 'is-recording-mode' : ''}`}
      style={{
        background: isRecording 
          ? 'rgba(52, 199, 89, 0.95)' // Permanent Green during recording
          : isSwiping
            ? `linear-gradient(90deg, transparent ${50 - fillPercent/2}%, ${fillColor} 50%, transparent ${50 + fillPercent/2}%)`
            : undefined,
        transition: isSwiping ? 'none' : 'background 0.3s ease'
      }}
    >
      {/* Corner hints — visible immediately on swipe */}
      <span className={`tabbar-corner-hint left ${(dragX !== null && dragX < -5) ? 'hint-visible' : ''} ${dockedSide === 'left' ? 'hint-triggered' : ''}`}>📷</span>
      <span className={`tabbar-corner-hint right ${(dragX !== null && dragX > 5) ? 'hint-visible' : ''} ${dockedSide === 'right' ? 'hint-triggered' : ''}`}>🎙️</span>

      <div
        className={`tab-indicator ${isRecording || isSwiping ? 'indicator-hidden' : ''}`}
        style={{ transform: `translateX(calc(${tabs.findIndex(t => t.id === activeTab) * 100}%))` }}
      />

      {tabs.map((tab) => {
        const isChat = tab.id === 'chat';
        
        // In recording mode, we show a special wide capsule for the chat tab
        if (isRecording) {
          if (!isChat) return null; // Hide other tabs
          return (
            <div key="recording-capsule" className="recording-mode-capsule">
              <div className="recording-wave-mini">
                <span></span><span></span><span></span>
              </div>
              <button 
                className="recording-stop-btn-large" 
                onClick={(e) => {
                  e.stopPropagation();
                  if (onChatTabRepeat) onChatTabRepeat(); // Reuse repeat for stop trigger if needed, or dedicated prop
                }}
              >
                ✕
              </button>
              <span className="recording-timer-mini">0:00</span>
            </div>
          );
        }

        return (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'on' : ''} ${tab.isMain || isChat ? 'tab-chat-main' : ''} ${!isChat && isSwiping ? 'quick-hidden' : ''}`}
            style={isChat && dragX !== null ? { transform: `translateX(${dragX * 0.8}px)`, transition: 'none' } : undefined}
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
              if (!isChat || isRecording) return;
              touchStartXRef.current = e.touches[0].clientX;
              suppressClickRef.current = false;
            }}
            onTouchMove={(e) => {
              if (!isChat || touchStartXRef.current === null || isRecording) return;
              const deltaX = e.touches[0].clientX - touchStartXRef.current;
              
              if (Math.abs(deltaX) > 5) {
                setDragX(deltaX);
                suppressClickRef.current = true;
                
                if (deltaX > CONFIRM_THRESHOLD) setDockedSide('right');
                else if (deltaX < -CONFIRM_THRESHOLD) setDockedSide('left');
                else setDockedSide('none');
              }
            }}
            onTouchEnd={() => {
              if (touchStartXRef.current === null) return;
              
              if (dockedSide !== 'none') {
                if (onChatTabSwipe) onChatTabSwipe(dockedSide);
              }
              
              setDragX(null);
              setDockedSide('none');
              touchStartXRef.current = null;
              if (onChatTabGestureEnd) onChatTabGestureEnd();
              
              // Small delay to prevent accidental click after swipe
              setTimeout(() => { suppressClickRef.current = false; }, 100);
            }}
            onTouchCancel={() => {
              setDragX(null);
              setDockedSide('none');
              touchStartXRef.current = null;
            }}
          >
            <div className={`ticon ${isChat ? 'is-main-capsule' : ''} ${isChat && dockedSide !== 'none' ? `docked-${dockedSide}` : ''}`} key={tab.icon}>
              {tab.icon}
              {tab.hasBadge && <span className="tab-badge" />}
            </div>
            {!isChat && <span className="tlabel" key={tab.label}>{tab.label}</span>}
          </button>
        );
      })}
    </nav>
  );
};
