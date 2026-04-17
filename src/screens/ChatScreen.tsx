import React, { useState, useEffect, useRef, useMemo } from 'react';
import { SubHeader } from '../components/SubHeader';
import { useData } from '../context/DataContext';
import { useAi } from '../context/AiContext';
import { ChatDiaryMessage } from '../components/Diary/ChatDiaryMessage';
import { useDiaryActions } from '../hooks/useDiaryActions';
import './ChatScreen.css';

// Группировка сообщений по датам
function getDateGroup(timestamp: number | undefined): string {
  if (!timestamp) return 'Ранее';
  const now = new Date();
  const date = new Date(timestamp);
  
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  
  const diffDays = Math.floor((startOfToday - startOfDay) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Сегодня';
  if (diffDays === 1) return 'Вчера';
  if (diffDays === 2) return 'Позавчера';
  
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

function groupItemsByDate<T>(items: T[], getTimestamp: (item: T) => number | undefined): { date: string, items: T[] }[] {
  const grouped: { date: string, items: T[] }[] = [];
  items.forEach(item => {
    const dateLabel = getDateGroup(getTimestamp(item));
    let existing = grouped.find(g => g.date === dateLabel);
    if (!existing) {
      existing = { date: dateLabel, items: [] };
      grouped.push(existing);
    }
    existing.items.push(item);
  });
  return grouped;
}

export interface ChatScreenProps {
  filter?: 'chat' | 'diary' | 'all' | 'adding';
  onChatTap?: () => void;
  onShowInstructions?: (show: boolean) => void;
  isLoading?: boolean;
  messages?: any[]; // Добавлено для синхронизации с App.tsx
  onUndo?: () => void; // Добавлено для синхронизации с App.tsx
}

const ChatScreen: React.FC<ChatScreenProps> = ({
  filter: externalFilter,
  onChatTap,
  onShowInstructions,
  isLoading: propIsLoading,
  messages: propMessages
}) => {
  const {
    messages: contextMessages,
    diary,
    baseline,
    events,
    setDiary,
  } = useData();

  const { isAiLoading, executeOption, activeUndos, undoAction } = useAi();
  const { clarifyDiaryItem } = useDiaryActions(setDiary);
  
  const [filter, setFilter] = useState<'chat' | 'diary' | 'all' | 'adding'>(externalFilter || 'chat');
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Prefer messages from props if provided, otherwise from context
  const activeMessages = propMessages || contextMessages || [];

  // Sync external filter if provided
  useEffect(() => {
    if (externalFilter) setFilter(externalFilter);
  }, [externalFilter]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (filter === 'chat' && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeMessages, filter, isAiLoading, propIsLoading]);

  // Группировка сообщений по датам (унифицированная)
  const groups = useMemo(() => groupItemsByDate(activeMessages, m => m.timestamp || Date.now()), [activeMessages]);
  
  // Группировка для всех табов
  const diaryGroups = useMemo(() => groupItemsByDate(diary.slice().reverse(), d => d.consumedAt), [diary]);
  const eventsGroups = useMemo(() => groupItemsByDate(events.slice().reverse(), e => e.timestamp), [events]);
  const addingGroups = useMemo(() => groupItemsByDate(baseline.slice().sort((a,b) => (b.updatedAt || 0) - (a.updatedAt || 0)), b => b.updatedAt), [baseline]);

  const renderSuggestions = (msgId: string, suggestions: any[]) => {
    if (!suggestions || !Array.isArray(suggestions)) return null;
    return (
      <div className="msg-suggestions animated-fade-in">
        {suggestions.map((s, sIdx) => (
          <div key={s.id || sIdx} className="suggestion-group">
            {s.text && <div className="suggestion-text">{s.text}</div>}
            <div className="suggestion-options">
              {s.options.map((opt: any, oIdx: number) => (
                <button 
                  key={oIdx} 
                  className={`suggestion-chip ${opt.style || 'secondary'}`}
                  onClick={() => executeOption(msgId, opt)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'add': return '🟢';
      case 'remove': return '🔴';
      case 'move': return '🛒';
      case 'log': return '📓';
      case 'check': return '✅';
      case 'uncheck': return '➖';
      case 'ai': return '🤖';
      default: return '🔔';
    }
  };

  return (
    <div className="screen chat-screen">
      <SubHeader>
        <div className="ui-capsule">
          <button 
            className={`ui-pill ${filter === 'chat' ? 'active' : ''}`} 
            onClick={() => setFilter('chat')}
          >
            Чат
          </button>
          <button 
            className={`ui-pill ${filter === 'adding' ? 'active' : ''}`} 
            onClick={() => setFilter('adding')}
          >
            Добавление
          </button>
          <button 
            className={`ui-pill ${filter === 'diary' ? 'active' : ''}`} 
            onClick={() => setFilter('diary')}
          >
            Дневник
          </button>
          <button 
            className={`ui-pill ${filter === 'all' ? 'active' : ''}`} 
            onClick={() => setFilter('all')}
          >
            Все
          </button>
        </div>
      </SubHeader>

      <div
        className="chat-messages"
        ref={scrollRef}
        onClick={(e) => {
          if (!onChatTap) return;
          const target = e.target as HTMLElement;
          if (target.closest('button, a, .msg-actions-report, .msg-suggestions')) return;
          onChatTap();
        }}
      >
        {filter === 'chat' && (
          <div className="chat-content-wrap">
            {onShowInstructions && (
              <div 
                className="chat-instructions-trigger animated-fade-in" 
                onClick={() => onShowInstructions(true)}
              >
                ✨ Что я умею?
              </div>
            )}
            
            {groups.map((group, gIdx) => (
              <div key={group.date || gIdx} className="msg-date-group">
                <div className="msg-date-separator">
                  <span>{group.date}</span>
                </div>
                {group.items.map(m => {
                  if (m.role === 'system') {
                    return (
                      <div key={m.id} className={`msg-row system ${m.type || ''}`}>
                        <div className="msg-system" dangerouslySetInnerHTML={{ __html: m.content }} />
                        {m.timestamp && (
                          <div className="msg-system-time">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        )}
                      </div>
                    );
                  }

                  // Diary AI message
                  if (m.type === 'diary' && m.diaryEntryId) {
                    const diaryItems = (diary || []).filter(d => d.chatMessageId === m.diaryEntryId);
                    return (
                      <div key={m.id} className="msg-row assistant">
                        <ChatDiaryMessage
                          entryId={m.diaryEntryId}
                          source={m.diarySource || 'voice'}
                          transcript={m.diaryTranscript}
                          items={diaryItems}
                          onClarify={(itemId, quantity, unit) => {
                            clarifyDiaryItem(itemId, {
                              qty: `${quantity} ${unit}`,
                              needsClarification: false,
                            });
                          }}
                          onSkip={(itemId) => {
                            clarifyDiaryItem(itemId, { needsClarification: false });
                          }}
                        />
                        {activeUndos?.includes(m.id) && (
                          <div className="msg-undo-wrap">
                            <button className="btn-undo animated-pop" onClick={() => undoAction(m.id)}>
                              ↩ Отменить
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div key={m.id} className={`msg-row ${m.role} ${m.type_info === 'undo' ? 'msg-undo-state' : ''}`}>
                      <div className={`msg-bubble ${m.role}`}>
                        <div className="msg-content">{m.content}</div>
                        {m.timestamp && (
                          <div className="msg-time">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        )}
                        {m.role === 'assistant' && m.suggestions && renderSuggestions(m.id, m.suggestions)}
                        {m.role === 'assistant' && activeUndos?.includes(m.id) && (
                          <div className="msg-undo-wrap">
                            <button className="btn-undo animated-pop" onClick={(e) => {
                              e.stopPropagation();
                              undoAction(m.id);
                            }}>
                              ↩ Отменить
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            
            {(isAiLoading || propIsLoading) && (
              <div className="msg-row assistant">
                <div className="msg-bubble assistant typing">
                  <div className="dot"></div>
                  <div className="dot"></div>
                  <div className="dot"></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {filter === 'diary' && (
          <div className="tab-list-detailed chat-content-wrap">
            {diaryGroups.map((group, idx) => (
              <div key={group.date || idx} className="msg-date-group">
                <div className="msg-date-separator">
                  <span>{group.date}</span>
                </div>
                {group.items.map(entry => (
                  <div key={entry.id} className="item-detailed-row glass-panel animated-pop">
                    <div className="idr-icon">🍲</div>
                    <div className="idr-main">
                      <div className="idr-name">{entry.name}</div>
                      <div className="idr-meta">
                        {entry.mealType === 'breakfast' && '🍳 Завтрак'}
                        {entry.mealType === 'lunch' && '🍲 Обед'}
                        {entry.mealType === 'dinner' && '🍽️ Ужин'}
                        {entry.mealType === 'snack' && '🍎 Перекус'}
                      </div>
                    </div>
                    <div className="idr-side">
                      <div className="idr-qty">{entry.qty}</div>
                      <div className="idr-time">
                        {new Date(entry.consumedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {diary.length === 0 && <div className="empty-state">Дневник пуст</div>}
          </div>
        )}

        {filter === 'all' && (
          <div className="tab-list-detailed chat-content-wrap">
            {eventsGroups.map((group, idx) => (
              <div key={group.date || idx} className="msg-date-group">
                <div className="msg-date-separator">
                  <span>{group.date}</span>
                </div>
                {group.items.map(event => (
                  <div key={event.id} className="item-detailed-row glass-panel animated-pop">
                    <div className="idr-icon">{getEventIcon(event.type)}</div>
                    <div className="idr-main">
                      <div className="idr-name">{event.text}</div>
                      <div className="idr-meta">{event.type === 'ai' ? 'ИИ Сигналы' : 'Активность'}</div>
                    </div>
                    <div className="idr-side">
                      <div className="idr-time">
                        {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {events.length === 0 && <div className="empty-state">Событий нет</div>}
          </div>
        )}

        {filter === 'adding' && (
          <div className="tab-list-detailed chat-content-wrap">
            {addingGroups.map((group, idx) => (
              <div key={group.date || idx} className="msg-date-group">
                <div className="msg-date-separator">
                  <span>{group.date}</span>
                </div>
                {group.items.map(item => (
                  <div key={item.id} className="item-detailed-row glass-panel animated-pop">
                    <div className="idr-icon">📦</div>
                    <div className="idr-main">
                      <div className="idr-name">{item.name}</div>
                      <div className="idr-meta">{item.cat || 'Прочее'}</div>
                    </div>
                    <div className="idr-side">
                      <div className="idr-qty">{item.qty}</div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {baseline.length === 0 && <div className="empty-state">Каталог пуст</div>}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatScreen;


