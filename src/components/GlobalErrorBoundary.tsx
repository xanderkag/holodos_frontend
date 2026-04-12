import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { logDiagnostic } from '../utils/ai';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    logDiagnostic(`[REACT CRASH] ${error.message}`, 'error');
    console.error("Uncaught React Error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          backgroundColor: '#f8f9ff', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', textAlign: 'center',
          padding: '40px', fontFamily: '-apple-system, system-ui, sans-serif'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>🧊</div>
          <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#1c1c1e', marginBottom: '12px' }}>Упс! Что-то пошло не так.</h2>
          <p style={{ fontSize: '15px', color: '#8e8e93', maxWidth: '300px', lineHeight: '1.5', marginBottom: '32px' }}>
            Приложение встретило неожиданную ошибку. Мы уже записали детали для исправления.
          </p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              backgroundColor: '#007aff', color: '#fff', border: 'none',
              padding: '16px 32px', borderRadius: '20px', fontSize: '16px',
              fontWeight: '700', cursor: 'pointer', boxShadow: '0 8px 20px rgba(0,122,255,0.3)'
            }}
          >
            Обновить приложение
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
