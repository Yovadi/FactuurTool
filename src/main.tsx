import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary';
import { supabaseConfigError } from './lib/supabase';

function renderFatal(message: string, stack?: string) {
  const root = document.getElementById('root');
  if (!root) return;
  root.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:32px;background:#0a0a0f;color:#f3f4f6;font-family:system-ui,sans-serif;">
      <div style="max-width:640px;background:#111827;border:1px solid #b91c1c;border-radius:12px;padding:24px;">
        <h1 style="margin:0 0 12px;font-size:20px;color:#fca5a5;">Applicatie kon niet starten</h1>
        <p style="margin:0 0 12px;color:#e5e7eb;font-size:14px;line-height:1.5;">${message}</p>
        ${stack ? `<pre style="background:#0b1220;padding:12px;border-radius:8px;overflow:auto;font-size:12px;color:#94a3b8;max-height:240px;">${stack}</pre>` : ''}
        <p style="margin:12px 0 0;color:#9ca3af;font-size:12px;">Druk op F12 voor DevTools of herstart de applicatie.</p>
      </div>
    </div>
  `;
}

window.addEventListener('error', (e) => {
  console.error('Global error:', e.error || e.message);
  renderFatal(e.message || 'Onbekende fout', e.error?.stack);
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled rejection:', e.reason);
  const msg = e.reason?.message || String(e.reason);
  renderFatal(msg, e.reason?.stack);
});

try {
  if (supabaseConfigError) {
    renderFatal(supabaseConfigError);
  } else {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>
    );
  }
} catch (err) {
  const error = err as Error;
  console.error('Fatal startup error:', error);
  renderFatal(error.message || 'Onbekende startfout', error.stack);
}
