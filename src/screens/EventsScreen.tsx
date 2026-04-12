import { useData } from '../context/DataContext';
import './EventsScreen.css';

export default function EventsScreen() {
  const { events } = useData();

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    const today = new Date().setHours(0, 0, 0, 0);
    const yesterday = today - 86400000;
    
    if (ts >= today) return 'Сегодня';
    if (ts >= yesterday) return 'Вчера';
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  };

  const groupedEvents = events.reduce((acc: any, event) => {
    const date = formatDate(event.timestamp);
    if (!acc[date]) acc[date] = [];
    acc[date].push(event);
    return acc;
  }, {});

  const getIcon = (type: string) => {
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

  if (events.length === 0) {
    return (
      <div className="screen empty-events">
        <div className="empty-icon">🔔</div>
        <h3>Событий пока нет</h3>
        <p>Здесь будет история ваших действий и подсказок ИИ</p>
      </div>
    );
  }

  return (
    <div className="screen scrollable events-screen">
      <div style={{ flex: '0 0 80px', height: 80 }} />
      
      <div className="events-list">
        {Object.entries(groupedEvents).map(([date, items]: [string, any]) => (
          <div key={date} className="event-group">
            <div className="event-date-header">{date}</div>
            <div className="event-items">
              {items.map((event: any) => (
                <div key={event.id} className="event-row-centered">
                  <div className="event-pill glass-panel animated-pop">
                    <span className="event-icon">{getIcon(event.type)}</span>
                    <span className="event-text">{event.text}</span>
                    <span className="event-time">{formatTime(event.timestamp)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
