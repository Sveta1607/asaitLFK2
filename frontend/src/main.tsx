// main.tsx — точка входа React-приложения
// Этот блок создаётся, чтобы:
// - подключить Clerk для аутентификации (вход, регистрация, восстановление пароля);
// - обернуть приложение в ClerkProvider с publishableKey из .env.
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { ClerkProvider } from '@clerk/clerk-react';
import { ruRU } from '@clerk/localizations';
import './index.css';
import App from './App';
import { ErrorBoundary } from './ErrorBoundary';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '';
if (!publishableKey) {
  console.warn('VITE_CLERK_PUBLISHABLE_KEY не задан. Добавьте ключ в .env для авторизации.');
}

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

// Кастомная локализация нужна, чтобы убрать название приложения из заголовка входа
// и всегда показывать пользовательские русские тексты.
const clerkLocalization = {
  ...ruRU,
  signIn: {
    ...ruRU.signIn,
    start: {
      ...ruRU.signIn?.start,
      title: 'Войти на сайт',
      subtitle: 'Войдите, чтобы продолжить работу',
    },
  },
};

// Обёртка создаётся, чтобы связать Clerk navigation с react-router (routing="path").
// Без этого Clerk может некорректно делать редиректы после входа/регистрации,
// что приводит к "нет сессии" и необходимости чистить cookies.
function ClerkWithRouter({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <ClerkProvider
      publishableKey={publishableKey}
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
      // Глобальная локализация нужна, чтобы ВСЕ встроенные экраны Clerk (вход/регистрация/ошибки) были на русском языке.
      localization={clerkLocalization}
    >
      {children}
    </ClerkProvider>
  );
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ClerkWithRouter>
          <App />
        </ClerkWithRouter>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);

