import React from 'react';
import ReactDOM from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import App from './App.tsx';
import ElixHealthApp from './pages/admin/ElixHealthApp.tsx';
import ElixHealthMantineProvider from './pages/admin/ElixHealthMantineProvider.tsx';
import { SupabaseProvider } from './context/SupabaseProvider.tsx';
import './index.css';
import { registerElixServiceWorker } from './lib/registerServiceWorker';

registerElixServiceWorker();

// Capture beforeinstallprompt as early as possible — before React renders.
// The pwa-install element mounts later (on auth page) and would miss this event.
// We store it globally so AuthInstallAppPrompt can pass it via externalPromptEvent.
if (!window.matchMedia('(display-mode: standalone)').matches) {
  window.addEventListener(
    'beforeinstallprompt',
    (e) => {
      e.preventDefault();
      (window as unknown as Record<string, unknown>).__elixInstallPrompt = e;
    },
    { once: true }
  );
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <SupabaseProvider>
        <Routes>
          <Route path='/elixhealth/*' element={<ElixHealthApp />} />
          <Route
            path='/*'
            element={
              <ElixHealthMantineProvider>
                <App />
              </ElixHealthMantineProvider>
            }
          />
        </Routes>
      </SupabaseProvider>
    </BrowserRouter>
    <SpeedInsights />
    <Analytics />
  </React.StrictMode>
);
