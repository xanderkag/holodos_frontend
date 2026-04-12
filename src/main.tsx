import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext'
import { DataProvider } from './context/DataContext'
import { AiProvider } from './context/AiContext'
import { logDiagnostic } from './utils/ai'
import { GlobalErrorBoundary } from './components/GlobalErrorBoundary'

// Global Error Interceptor for Native Diagnostics
if (typeof window !== 'undefined') {
  window.onerror = (message, source, lineno, colno, error) => {
    const errorMsg = `[JS CRASH] ${String(message)} at ${String(source)}:${lineno}:${colno}`;
    logDiagnostic(errorMsg, 'error');
    console.error(errorMsg, error);
    return false;
  };

  window.onunhandledrejection = (event) => {
    const errorMsg = `[JS REJECT] ${event.reason}`;
    logDiagnostic(errorMsg, 'error');
    console.error(errorMsg);
  };
}

try {
  logDiagnostic('BOOT: Mounting React root', 'info');
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <GlobalErrorBoundary>
        <AuthProvider>
          <DataProvider>
            <AiProvider>
              <App />
            </AiProvider>
          </DataProvider>
        </AuthProvider>
      </GlobalErrorBoundary>
    </StrictMode>,
  );
  logDiagnostic('BOOT: Root mounted successfully', 'info');
} catch (e) {
  const bootErr = `[BOOT ERROR] ${String(e)}`;
  logDiagnostic(bootErr, 'error');
  console.error(bootErr, e);
  // Fallback to error display
  const root = document.getElementById('root');
  if (root) root.innerHTML = `<div style="padding: 20px; color: red;">Fatal Startup Error: ${String(e)}</div>`;
}
