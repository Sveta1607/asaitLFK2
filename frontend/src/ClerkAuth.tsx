// ClerkAuth.tsx — обёртка над Clerk: авторизация и выбор роли при первом входе
import React, { useEffect, useState } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { apiGetMe, apiSyncFromClerk } from './api';
import type { User } from './mockData';

// Данные регистрационной формы — передаются в onComplete для синхронизации с бэкендом
interface RoleSelectData {
  role: 'user' | 'specialist';
  username: string;
  firstName: string;
  lastName: string;
  phone: string;
}

// Компонент выбора роли, логина и заполнения профиля после первого входа через Clerk
function RoleSelectForm({
  email,
  onComplete,
}: {
  email: string;
  onComplete: (data: RoleSelectData) => Promise<void>;
}) {
  const [role, setRole] = useState<'user' | 'specialist'>('user');
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  // Телефон начинается с +7 по умолчанию, чтобы пользователь вводил только оставшиеся 10 цифр
  const [phone, setPhone] = useState('+7');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Валидация: только латинские буквы, 3–32 символа (совпадает с бэкендом)
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
    setError(null);
    setLoading(true);
    try {
      await onComplete({ role, username, firstName, lastName, phone });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка синхронизации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card w-full max-w-md">
      {/* Заголовок с приветственной иконкой */}
      <div className="mb-5 text-center">
        <span className="mb-2 inline-block text-4xl">👋</span>
        <h1 className="text-xl font-extrabold text-gray-800">
          Добро пожаловать!
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Заполните данные для завершения регистрации
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 text-sm">
        {/* Выбор роли: пациент или специалист */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-gray-600">Роль</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setRole('user')}
              className={
                role === 'user'
                  ? 'btn-primary flex-1'
                  : 'btn-secondary flex-1'
              }
            >
              👤 Пациент
            </button>
            <button
              type="button"
              onClick={() => setRole('specialist')}
              className={
                role === 'specialist'
                  ? 'btn-primary flex-1'
                  : 'btn-secondary flex-1'
              }
            >
              ⚕️ Специалист
            </button>
          </div>
        </div>

        {/* Поле логина */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-gray-600">
            Логин <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            className="input-field"
            placeholder="Только латинские буквы"
            value={username}
            onChange={(e) => setUsername(e.target.value.replace(/[^A-Za-z]/g, ''))}
            maxLength={32}
          />
          {username.length > 0 && !usernameValid && (
            <p className="mt-1 text-[11px] font-semibold text-red-500">
              3–32 символа, ТОЛЬКО латинские буквы
            </p>
          )}
        </div>

        {/* Поля ФИО — заполняются при регистрации и сразу сохраняются в профиль */}
        <div className="grid gap-3 grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-600">Имя</label>
            <input
              type="text"
              className="input-field"
              placeholder="Иван"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-600">Фамилия</label>
            <input
              type="text"
              className="input-field"
              placeholder="Иванов"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
        </div>

        {/* Телефон — +7 зафиксирован, пользователь вводит только 10 цифр после кода страны */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-gray-600">Телефон</label>
          <input
            type="tel"
            className="input-field"
            placeholder="+79511232314"
            value={phone}
            maxLength={12}
            onChange={(e) => {
              const d = e.target.value.replace(/\D/g, '');
              setPhone('+7' + (d.startsWith('7') ? d.slice(1) : d).slice(0, 10));
            }}
          />
        </div>

        <div className="rounded-xl bg-mint-50 px-3 py-2 text-xs font-medium text-mint-700">
          E-mail: {email}
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!usernameValid || loading}
          className="btn-primary w-full"
        >
          {loading ? 'Сохранение...' : 'Продолжить'}
        </button>
      </form>
    </div>
  );
}

// Хук авторизации: Clerk-сессия + синхронизация профиля с бэкендом
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

  // Этот блок обновлён, чтобы передавать ФИО и телефон на бэкенд при завершении регистрации.
  const completeRoleSelect = async (data: {
    role: 'user' | 'specialist';
    username: string;
    firstName: string;
    lastName: string;
    phone: string;
  }) => {
    const token = await getToken();
    if (!token) return;
    await apiSyncFromClerk(token, {
      email: roleSelectEmail,
      username: data.username,
      role: data.role,
      firstName: data.firstName || undefined,
      lastName: data.lastName || undefined,
      phone: data.phone || undefined,
    });
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
