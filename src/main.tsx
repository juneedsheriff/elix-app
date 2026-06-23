import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import App from './App.tsx';
import ElixHealthApp from './pages/admin/ElixHealthApp.tsx';
import ElixHealthMantineProvider from './pages/admin/ElixHealthMantineProvider.tsx';
import { SupabaseProvider } from './context/SupabaseProvider.tsx';
import './index.css';
import { registerElixServiceWorker } from './lib/registerServiceWorker';

registerElixServiceWorker();

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
  </React.StrictMode>
);
