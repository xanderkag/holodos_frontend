import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './Toast.css';

let toastFn: (msg: string) => void;

export const showToast = (msg: string) => {
  if (toastFn) toastFn(msg);
};

export const ToastContainer = () => {
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    toastFn = (m: string) => {
      setMsg(m);
      setTimeout(() => setMsg(null), 2000); // 2s as requested for better readability
    };
  }, []);

  if (!msg) return null;

  const portalRoot = document.getElementById('toast-portal');
  if (!portalRoot) return null;

  return createPortal(
    <div className="toast-portal-inner">
      <div className={`toast-bubble glass-panel-dark pop-down ${getTypeClass(msg)}`}>
        {msg}
      </div>
    </div>,
    portalRoot
  );
};

const getTypeClass = (msg: string) => {
  if (msg.startsWith('❌') || msg.startsWith('🔴')) return 'toast-error';
  if (msg.startsWith('✅') || msg.startsWith('🟢')) return 'toast-success';
  if (msg.startsWith('⚠️') || msg.startsWith('🟡') || msg.startsWith('🔐')) return 'toast-warning';
  return 'toast-info';
};

