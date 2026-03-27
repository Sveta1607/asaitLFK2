// ClerkAuth.tsx — обёртка над Clerk: SignIn, SignUp и выбор роли при первом входе
// Этот файл создаётся, чтобы:
// - отображать страницы входа и регистрации Clerk с восстановлением пароля;
// - после успешной авторизации показывать форму выбора роли и логина (если профиль ещё не синхронизирован);
// - вызывать apiSyncFromClerk и apiGetMe для получения профиля из бэкенда.
import React, { useEffect, useState } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { apiGetMe, apiSyncFromClerk } from './api';
import type { User } from './mockData';
import { canRegisterAsSpecialist } from './specialistGate';

// Компонент выбора роли и логина после первого входа через Clerk
// Этот блок создаётся, чтобы:
// - собрать роль (user/specialist) и username с валидацией;
// - вызвать sync-from-clerk и передать результат в onAuthComplete.
function RoleSelectForm({
  email,
  onComplete,
}: {
  email: string;
  onComplete: (role: 'user' | 'specialist', username: string) => Promise<void>;
}) {
  const [role, setRole] = useState<'user' | 'specialist'>('user');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const specialistAllowed = canRegisterAsSpecialist(email);

  // Этот блок создаётся, чтобы:
  // - проверять, что логин состоит ТОЛЬКО из латинских букв (A–Z, a–z);
  // - соблюдать ограничение по длине 3–32 символа, совпадая с бэкендом.
  const usernameValid =
    username.length >= 3 &&
    username.length <= 32 &&
    /^[A-Za-z]+$/.test(username);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameValid) {
      setError('Логин: 3–32 символа, ТОЛЬКО латинские буквы без цифр и спецсимволов');
      return;
    }
    if (role === 'specialist' && !specialistAllowed) {
      setError('Роль «специалист» доступна только для адреса, указанного администратором.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await onComplete(role, username);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка синхронизации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-xl border bg-white p-6 shadow-sm">
      <h1 className="mb-4 text-xl font-semibold text-slate-900">
        Выберите роль и логин
      </h1>
      <p className="mb-4 text-sm text-slate-600">
        Укажите, как вы будете использовать сервис, и логин для входа.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3 text-sm">
        <div>
          <label className="mb-1 block text-xs text-slate-600">Роль</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setRole('user')}
              className={
                role === 'user'
                  ? 'flex-1 rounded-md bg-sky-600 px-3 py-2 font-medium text-white'
                  : 'flex-1 rounded-md border border-slate-200 px-3 py-2 text-slate-700'
              }
            >
              Пациент
            </button>
            <button
              type="button"
              disabled={!specialistAllowed}
              title={
                specialistAllowed
                  ? undefined
                  : 'Специалист — только для адреса, заданного администратором'
              }
              onClick={() => specialistAllowed && setRole('specialist')}
              className={
                !specialistAllowed
                  ? 'flex-1 cursor-not-allowed rounded-md border border-slate-100 bg-slate-100 px-3 py-2 text-xs text-slate-400'
                  : role === 'specialist'
                    ? 'flex-1 rounded-md bg-sky-600 px-3 py-2 font-medium text-white'
                    : 'flex-1 rounded-md border border-slate-200 px-3 py-2 text-slate-700'
              }
            >
              Специалист
            </button>
          </div>
          {!specialistAllowed && (
            <p className="mt-1 text-[11px] text-slate-500">
              Роль специалиста — только с почты, выданной администратором.
            </p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-600">
            Логин <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-sky-500"
            placeholder="Только латинские буквы (без цифр и спецсимволов)"
            value={username}
            // Этот обработчик создаётся, чтобы сразу отфильтровать все символы,
            // кроме латинских букв, ещё на этапе ввода.
            onChange={(e) => setUsername(e.target.value.replace(/[^A-Za-z]/g, ''))}
            maxLength={32}
          />
          {username.length > 0 && !usernameValid && (
            <p className="mt-0.5 text-[11px] text-red-600">
              3–32 символа, ТОЛЬКО латинские буквы без цифр и спецсимволов
            </p>
          )}
        </div>
        <div className="text-xs text-slate-500">E-mail: {email}</div>
        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={!usernameValid || loading}
          className="mt-2 w-full rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
        >
          {loading ? 'Сохранение...' : 'Продолжить'}
        </button>
      </form>
    </div>
  );
}

// Хук для получения текущего пользователя с учётом Clerk и sync-from-clerk
// Этот блок создаётся, чтобы:
// - при наличии сессии Clerk получить токен и загрузить профиль из бэкенда;
// - при 403 (профиль не найден) вернуть флаг needsRoleSelect и email для формы выбора роли.
export function useClerkAuth() {
  const { isSignedIn, getToken, userId } = useAuth();
  const { user: clerkUser } = useUser();
  const [user, setUser] = useState<User | null>(null);
  const [needsRoleSelect, setNeedsRoleSelect] = useState(false);
  const [roleSelectEmail, setRoleSelectEmail] = useState('');
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    if (!isSignedIn) {
      setUser(null);
      setNeedsRoleSelect(false);
      setLoading(false);
      return;
    }
    const token = await getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const profile = await apiGetMe(token);
      setUser(profile);
      setNeedsRoleSelect(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Надёжно определяем необходимость выбора роли по коду 403
      if (msg === '403') {
        setNeedsRoleSelect(true);
        const email = (clerkUser?.primaryEmailAddress?.emailAddress || '').trim();
        setRoleSelectEmail(email);
      } else {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, [isSignedIn, userId]);

  const completeRoleSelect = async (role: 'user' | 'specialist', username: string) => {
    const token = await getToken();
    if (!token) return;
    await apiSyncFromClerk(token, { email: roleSelectEmail, username, role });
    await refreshUser();
  };

  return {
    user,
    loading,
    needsRoleSelect,
    roleSelectEmail,
    completeRoleSelect,
    refreshUser,
    getToken,
    isSignedIn: !!isSignedIn,
  };
}

export { RoleSelectForm };
