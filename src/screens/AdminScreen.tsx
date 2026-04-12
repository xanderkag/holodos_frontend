import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../utils/firebase';
import './AdminScreen.css';

interface AdminScreenProps {
  onClose: () => void;
}

export const AdminScreen = ({ onClose }: AdminScreenProps) => {
  const [users, setUsers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [view, setView] = useState<'dash' | 'users' | 'logs'>('dash');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const uSnapshot = await getDocs(collection(db, 'users'));
        const uData = uSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setUsers(uData);

        if (view === 'logs') {
          const q = query(collection(db, 'ai_logs'), orderBy('timestamp', 'desc'), limit(50));
          const snapshot = await getDocs(q);
          setLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        }
      } catch (err) {
        console.error("Error fetching admin data:", err);
      }
      setLoading(false);
    };
    fetchData();
  }, [view]);

  // Расчет метрик Дашборда
  const totalUsers = users.length;
  const voiceActiveUsers = users.filter(u => (u.voice_count || 0) > 0).length;
  const totalVoices = users.reduce((acc, u) => acc + (u.voice_count || 0), 0);
  const avgVoices = voiceActiveUsers > 0 ? (totalVoices / voiceActiveUsers).toFixed(1) : "0";

  return (
    <div className="screen admin-screen">
      <div style={{ flex: '0 0 80px', height: 80 }} />
      <div className="admin-hdr glass-panel" style={{position: 'relative'}}>
        <button 
          onClick={onClose}
          style={{
            position: 'absolute', top: 12, right: 12, width: 32, height: 32, 
            borderRadius: '50%', background: 'rgba(0,0,0,0.05)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: '800', color: 'var(--t1)', zIndex: 2001
          }}
        >
          ✕
        </button>
        <h1>Панель Администратора</h1>
        
        <div className="admin-controls-row">
          <div className="segmented-control">
            <button className={`sc-btn ${view === 'dash' ? 'active' : ''}`} onClick={() => setView('dash')}>Дашборд</button>
            <button className={`sc-btn ${view === 'users' ? 'active' : ''}`} onClick={() => setView('users')}>Юзеры ({totalUsers})</button>
            <button className={`sc-btn ${view === 'logs' ? 'active' : ''}`} onClick={() => setView('logs')}>Логи ИИ</button>
            <div className="sc-indicator" style={{ 
              width: '33.33%',
              transform: `translateX(${view === 'dash' ? '0%' : view === 'users' ? '100%' : '200%'})` 
            }} />
          </div>
        </div>
      </div>
      
      <div className="admin-list">
        {loading ? (
          <div className="admin-loading">Загрузка данных...</div>
        ) : view === 'dash' ? (
          <div className="admin-dashboard-grid">
            <div className="stat-card glass-panel animated-pop">
              <div className="sc-val">{totalUsers}</div>
              <div className="sc-lbl">Всего юзеров</div>
            </div>
            <div className="stat-card glass-panel animated-pop" style={{animationDelay: '0.1s'}}>
              <div className="sc-val">{voiceActiveUsers}</div>
              <div className="sc-lbl">Активных голосов</div>
            </div>
            <div className="stat-card glass-panel animated-pop" style={{animationDelay: '0.2s'}}>
              <div className="sc-val">{totalVoices}</div>
              <div className="sc-lbl">Всего команд</div>
            </div>
            <div className="stat-card glass-panel animated-pop" style={{animationDelay: '0.3s'}}>
              <div className="sc-val">{avgVoices}</div>
              <div className="sc-lbl">Среднее на юзера</div>
            </div>
          </div>
        ) : view === 'users' ? (
          users.map((u, i) => (
            <div key={i} className="admin-card glass-panel animated-pop" style={{animationDelay: `${i*0.05}s`}}>
              <div className="ac-id">{u.id} {u.email && `(${u.email})`}</div>
              <div className="ac-stats">
                <span className="sc-badge voice">🎙️ {u.voice_count || 0}</span>
                <span className="sc-badge blue">🛒 {u.list?.length || 0}</span>
                <span className="sc-badge blue">🧊 {u.stock?.length || 0}</span>
              </div>
            </div>
          ))
        ) : (
          logs.map((l, i) => (
            <div key={i} className={`admin-card log-card glass-panel animated-pop ${l.status === 'success' ? 'success' : 'error'}`} style={{animationDelay: `${i*0.02}s`}}>
              <div className="log-header">
                <span className="log-user">{l.userEmail}</span>
                <span className="log-time">{l.timestamp?.toDate ? l.timestamp.toDate().toLocaleString('ru-RU') : '...'}</span>
              </div>
              <div className="log-info">
                 <span className="log-model">🤖 {l.model || 'unknown'}</span>
                 <span className={`log-status ${l.status}`}>{l.status === 'success' ? '✅ Успех' : '❌ Ошибка'}</span>
              </div>
              <div className="log-details">
                <span className="log-count">Найдено: {l.count} шт.</span>
              </div>
              {l.details && <div className="log-details-text">{l.details}</div>}
              {l.error && <div className="log-err">{l.error}</div>}
            </div>
          ))
        )}
        <div style={{ height: 120 }} />
      </div>

      <div className="admin-close-overlay">
        <button className="admin-close-btn glass-panel" onClick={onClose}>
          Закрыть админку
        </button>
      </div>
    </div>
  );
};
