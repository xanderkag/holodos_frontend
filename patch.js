const fs = require('fs');
const file = '/Users/alexanderliapustin/Desktop/Antigravity2/frontend/src/screens/ChatScreen.tsx';
let data = fs.readFileSync(file, 'utf8');

const helpers = `
function getDateGroup(timestamp: number | undefined): string {
  if (!timestamp) return 'Ранее';
  const now = new Date();
  const date = new Date(timestamp);
  
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  
  const diffDays = Math.floor((startOfToday - startOfDay) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Сегодня';
  if (diffDays === 1) return 'Вчера';
  
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
`;

data = data.replace(
  "import { useDiaryActions } from '../hooks/useDiaryActions';\nimport './ChatScreen.css';",
  "import { useDiaryActions } from '../hooks/useDiaryActions';\nimport './ChatScreen.css';\n" + helpers
);

data = data.replace(
  `  // Группировка сообщений по датам (локальная реализация)
  const groups = useMemo(() => {
    const grouped: { date: string, items: any[] }[] = [];
    activeMessages.forEach(m => {
      const date = new Date(m.timestamp || Date.now()).toLocaleDateString('ru-RU', { 
        day: 'numeric', month: 'long' 
      });
      const existing = grouped.find(g => g.date === date);
      if (existing) {
        existing.items.push(m);
      } else {
        grouped.push({ date, items: [m] });
      }
    });
    return grouped;
  }, [activeMessages]);`,
  `  // Группировка сообщений по датам (унифицированная)
  const groups = useMemo(() => groupItemsByDate(activeMessages, m => m.timestamp || Date.now()), [activeMessages]);
  
  // Группировка для всех табов
  const diaryGroups = useMemo(() => groupItemsByDate(diary.slice().reverse(), d => d.consumedAt), [diary]);
  const eventsGroups = useMemo(() => groupItemsByDate(events.slice().reverse(), e => e.timestamp), [events]);
  const addingGroups = useMemo(() => groupItemsByDate(baseline.slice().sort((a,b) => (b.updatedAt || 0) - (a.updatedAt || 0)), b => b.updatedAt), [baseline]);`
);

data = data.replace(
  `                        <div className="msg-system" dangerouslySetInnerHTML={{ __html: m.content }} />
                      </div>`,
  `                        <div className="msg-system" dangerouslySetInnerHTML={{ __html: m.content }} />
                        {m.timestamp && (
                          <div className="msg-time msg-time-sys">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        )}
                      </div>`
);

// Tab Diary
data = data.replace(
  `        {filter === 'diary' && (
          <div className="tab-list-detailed">
            {diary.slice().reverse().map(entry => (
              <div key={entry.id} className="item-detailed-row glass-panel animated-pop">`,
  `        {filter === 'diary' && (
          <div className="chat-content-wrap tab-list-detailed">
            {diaryGroups.map((group, idx) => (
              <div key={group.date || idx} className="msg-date-group">
                <div className="msg-date-separator">
                  <span>{group.date}</span>
                </div>
                {group.items.map(entry => (
                  <div key={entry.id} className="item-detailed-row glass-panel animated-pop">`
);
data = data.replace(
  `                  </div>
                </div>
              </div>
            ))}
            {diary.length === 0 && <div className="empty-state">Дневник пуст</div>}`,
  `                  </div>
                </div>
              </div>
                ))}
              </div>
            ))}
            {diary.length === 0 && <div className="empty-state">Дневник пуст</div>}`
);

// Tab Events
data = data.replace(
  `        {filter === 'all' && (
          <div className="tab-list-detailed">
            {events.slice().reverse().map(event => (
              <div key={event.id} className="item-detailed-row glass-panel animated-pop">`,
  `        {filter === 'all' && (
          <div className="chat-content-wrap tab-list-detailed">
            {eventsGroups.map((group, idx) => (
              <div key={group.date || idx} className="msg-date-group">
                <div className="msg-date-separator">
                  <span>{group.date}</span>
                </div>
                {group.items.map(event => (
                  <div key={event.id} className="item-detailed-row glass-panel animated-pop">`
);
data = data.replace(
  `                  </div>
                </div>
              </div>
            ))}
            {events.length === 0 && <div className="empty-state">Событий нет</div>}`,
  `                  </div>
                </div>
              </div>
                ))}
              </div>
            ))}
            {events.length === 0 && <div className="empty-state">Событий нет</div>}`
);

// Tab Adding
data = data.replace(
  `        {filter === 'adding' && (
          <div className="tab-list-detailed">
            {baseline.map(item => (
              <div key={item.id} className="item-detailed-row glass-panel animated-pop">`,
  `        {filter === 'adding' && (
          <div className="chat-content-wrap tab-list-detailed">
            {addingGroups.map((group, idx) => (
              <div key={group.date || idx} className="msg-date-group">
                <div className="msg-date-separator">
                  <span>{group.date}</span>
                </div>
                {group.items.map(item => (
                  <div key={item.id} className="item-detailed-row glass-panel animated-pop">`
);
data = data.replace(
  `                  <div className="idr-qty">{item.qty}</div>
                </div>
              </div>
            ))}
            {baseline.length === 0 && <div className="empty-state">Каталог пуст</div>}`,
  `                  <div className="idr-qty">{item.qty}</div>
                </div>
              </div>
                ))}
              </div>
            ))}
            {baseline.length === 0 && <div className="empty-state">Каталог пуст</div>}`
);

fs.writeFileSync(file, data);
