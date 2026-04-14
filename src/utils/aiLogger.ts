export interface AiLogOptions {
  message: string;
  code?: string;
  status?: string;
  action?: string;
  meta?: any;
}

/**
 * Логгер AI для фиксации сетевых ошибок и таймаутов на бэкенде.
 */
export const logAiAudit = async (options: AiLogOptions) => {
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
  
  const payload = {
    level: options.status === 'timeout' || options.code === 'network_error' ? 'error' : 'info',
    module: 'ai',
    context: 'client_audit',
    message: options.message,
    code: options.code || null,
    status: options.status || null,
    action: options.action || null,
    appUrl: window.location.href,
    meta: {
      ...options.meta,
      origin: window.location.origin,
    },
    timestamp: Date.now(),
    ua: navigator.userAgent
  };

  try {
    fetch(`${backendUrl}/api/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(e => console.warn('AiLogger: fetch failed', e));
  } catch (e) {
    console.warn('AiLogger: catch block', e);
  }
};
