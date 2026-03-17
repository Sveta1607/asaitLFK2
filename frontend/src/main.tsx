// main.tsx — точка входа React-приложения
// Этот блок создаётся, чтобы:
// - подключить Clerk для аутентификации (вход, регистрация, восстановление пароля);
// - обернуть приложение в ClerkProvider с publishableKey из .env.
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ClerkProvider } from '@clerk/clerk-react';
import './index.css';
import App from './App';
import { ErrorBoundary } from './ErrorBoundary';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '';
if (!publishableKey) {
  console.warn('VITE_CLERK_PUBLISHABLE_KEY не задан. Добавьте ключ в .env для авторизации.');
}

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ClerkProvider publishableKey={publishableKey}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ClerkProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

