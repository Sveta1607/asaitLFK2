// App.tsx — корневой компонент приложения: навигация, страницы и базовая логика
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { SignIn, SignOutButton, SignUp } from '@clerk/clerk-react';
import {
  apiCancelBooking,
  apiCreateBookingByPatient,
  apiCreateBookingBySpecialist,
  apiCreateSlot,
  apiCreateSlotsBatch,
  apiDeleteSlot,
  apiGetBookings,
  apiGetNews,
  apiGetSlots,
  apiAddNews,
  apiUpdateNews,
  apiUpdateUser,
} from './api';
import { useClerkAuth, RoleSelectForm } from './ClerkAuth';
import type { Booking, NewsItem, TimeSlot, User } from './mockData';

// Компонент шапки сайта — навигация по ролям, мягкие зелёные тона, дружелюбный стиль
const Header: React.FC<{ currentUser: User | null }> = ({ currentUser }) => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 border-b border-mint-100 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        {/* Логотип с детским акцентом */}
        <Link to="/" className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-mint-700">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-mint-100 text-lg">
            🧒
          </span>
          Детский ЛФК
        </Link>

        {/* Навигационные ссылки */}
        <nav className="flex items-center gap-1 text-sm font-semibold">
          <Link
            to="/"
            className={
              isActive('/')
                ? 'rounded-lg bg-mint-50 px-3 py-1.5 text-mint-700'
                : 'rounded-lg px-3 py-1.5 text-gray-600 transition-colors hover:bg-mint-50 hover:text-mint-700'
            }
          >
            Главная
          </Link>

          {/* Ссылки пациента */}
          {currentUser?.role === 'user' && (
            <>
              <Link
                to="/book"
                className={
                  isActive('/book')
                    ? 'rounded-lg bg-mint-50 px-3 py-1.5 text-mint-700'
                    : 'rounded-lg px-3 py-1.5 text-gray-600 transition-colors hover:bg-mint-50 hover:text-mint-700'
                }
              >
                Записаться
              </Link>
              <Link
                to="/my-bookings"
                className={
                  isActive('/my-bookings')
                    ? 'rounded-lg bg-mint-50 px-3 py-1.5 text-mint-700'
                    : 'rounded-lg px-3 py-1.5 text-gray-600 transition-colors hover:bg-mint-50 hover:text-mint-700'
                }
              >
                Мои записи
              </Link>
            </>
          )}

          {/* Ссылки специалиста */}
          {currentUser?.role === 'specialist' && (
            <>
              <Link
                to="/specialist/schedule"
                className={
                  isActive('/specialist/schedule')
                    ? 'rounded-lg bg-mint-50 px-3 py-1.5 text-mint-700'
                    : 'rounded-lg px-3 py-1.5 text-gray-600 transition-colors hover:bg-mint-50 hover:text-mint-700'
                }
              >
                Расписание
              </Link>
              <Link
                to="/specialist/news"
                className={
                  isActive('/specialist/news')
                    ? 'rounded-lg bg-mint-50 px-3 py-1.5 text-mint-700'
                    : 'rounded-lg px-3 py-1.5 text-gray-600 transition-colors hover:bg-mint-50 hover:text-mint-700'
                }
              >
                Новости
              </Link>
            </>
          )}

          {/* Ссылка на профиль */}
          {currentUser && (
            <Link
              to="/profile"
              className={
                isActive('/profile')
                  ? 'rounded-lg bg-mint-50 px-3 py-1.5 text-mint-700'
                  : 'rounded-lg px-3 py-1.5 text-gray-600 transition-colors hover:bg-mint-50 hover:text-mint-700'
              }
            >
              Профиль
            </Link>
          )}

          {/* Кнопка входа для гостей */}
          {!currentUser && (
            <a href="/login" className="btn-primary ml-2">
              Войти
            </a>
          )}

          {/* Индикатор роли и кнопка выхода */}
          {currentUser && (
            <div className="ml-2 flex items-center gap-2">
              <span className="rounded-full bg-warm-100 px-2.5 py-0.5 text-xs font-bold text-warm-500">
                {currentUser.role === 'user' ? '👤 Пациент' : currentUser.role === 'specialist' ? '⚕️ Специалист' : '🔧 Админ'}
              </span>
              <SignOutButton>
                <button
                  type="button"
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                >
                  Выйти
                </button>
              </SignOutButton>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
};

// Компонент карточки новости — мягкие тени, скруглённые углы, зелёный акцент
const NewsCard: React.FC<{ item: NewsItem }> = ({ item }) => {
  return (
    <article className="card group flex flex-col overflow-hidden !p-0">
      {/* Изображение новости с плавным зумом при наведении */}
      <div className="h-44 w-full overflow-hidden">
        <img
          src={item.imageUrl}
          alt={item.title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>
      {/* Текстовая часть */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-sm font-bold text-gray-800">{item.title}</h3>
        <p className="text-xs leading-relaxed text-gray-500">{item.excerpt}</p>
        <div className="mt-auto flex items-center justify-between border-t border-gray-50 pt-3 text-[11px] text-gray-400">
          <span>{new Date(item.date).toLocaleDateString('ru-RU')}</span>
          {item.source && (
            <span className="rounded-full bg-mint-50 px-2 py-0.5 text-mint-600">
              {item.source === 'manual' ? 'Вручную' : 'Авто'}
            </span>
          )}
        </div>
      </div>
    </article>
  );
};

// Главная страница — hero-блок с иллюстрацией, блок новостей, информация о специалисте
const HomePage: React.FC<{
  currentUser: User | null;
  news: NewsItem[];
  newsLoading?: boolean;
  newsError?: string | null;
}> = ({ currentUser, news, newsLoading, newsError }) => {
  const navigate = useNavigate();

  const handlePrimaryCta = () => {
    if (currentUser?.role === 'user') {
      navigate('/book');
    } else {
      navigate('/login');
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {/* Hero-блок — тёплый градиент, дружелюбная подача */}
      <section className="relative mb-10 overflow-hidden rounded-3xl bg-gradient-to-br from-mint-100 via-mint-50 to-warm-50 p-8 md:flex md:items-center md:justify-between md:p-10">
        {/* Декоративные круги на фоне */}
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-mint-200/30" />
        <div className="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-warm-200/30" />

        <div className="relative max-w-xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-mint-700 shadow-sm backdrop-blur-sm">
            🌿 Лечебная физкультура для детей
          </div>
          <h1 className="mb-3 text-3xl font-extrabold leading-tight text-gray-800 md:text-4xl">
            Здоровье и радость<br />
            <span className="text-mint-600">движения для вашего ребёнка</span>
          </h1>
          <p className="mb-2 text-sm leading-relaxed text-gray-600">
            Индивидуальные занятия ЛФК с опытным специалистом. Коррекция осанки,
            укрепление мышечного корсета и профилактика травм — в удобное для вас время.
          </p>
          <p className="mb-5 text-xs text-gray-400">
            Онлайн-запись на приём с выбором даты и времени.
          </p>

          {/* CTA-кнопки для неавторизованных гостей */}
          {!currentUser && (
            <div className="flex gap-3">
              <button type="button" onClick={handlePrimaryCta} className="btn-primary text-base">
                Записаться на приём
              </button>
              <a href="/login" className="btn-secondary">
                Войти
              </a>
            </div>
          )}
        </div>

        {/* Информационная колонка справа */}
        <div className="relative mt-6 flex-shrink-0 md:mt-0 md:ml-8 md:text-right">
          <div className="inline-flex flex-col items-end gap-3">
            <div className="rounded-2xl bg-white/80 p-4 shadow-soft backdrop-blur-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-coral-500">
                🏃 Индивидуальный подход
              </p>
              <p className="mt-1 text-sm text-gray-600">
                Программа упражнений под<br />каждого ребёнка
              </p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4 shadow-soft backdrop-blur-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-mint-600">
                📅 Удобная запись
              </p>
              <p className="mt-1 text-sm text-gray-600">
                Выбирайте время прямо<br />на сайте
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Блок преимуществ */}
      <section className="mb-10 grid gap-4 md:grid-cols-3">
        <div className="card flex items-start gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-mint-100 text-xl">💪</span>
          <div>
            <h3 className="text-sm font-bold text-gray-800">Укрепление здоровья</h3>
            <p className="mt-1 text-xs text-gray-500">Коррекция осанки и укрепление мышечного корсета под руководством специалиста</p>
          </div>
        </div>
        <div className="card flex items-start gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-coral-100 text-xl">🎯</span>
          <div>
            <h3 className="text-sm font-bold text-gray-800">Индивидуальный план</h3>
            <p className="mt-1 text-xs text-gray-500">Подбор упражнений с учётом возраста, здоровья и рекомендаций врача</p>
          </div>
        </div>
        <div className="card flex items-start gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-warm-100 text-xl">😊</span>
          <div>
            <h3 className="text-sm font-bold text-gray-800">Позитивная атмосфера</h3>
            <p className="mt-1 text-xs text-gray-500">Занятия в игровой форме, чтобы ребёнку было интересно и весело</p>
          </div>
        </div>
      </section>

      {/* Блок новостей */}
      <section className="mb-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-extrabold text-gray-800">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-mint-100 text-base">📰</span>
            Новости и статьи
          </h2>
          <span className="rounded-full bg-mint-50 px-3 py-1 text-xs font-semibold text-mint-600">
            ЛФК и здоровье детей
          </span>
        </div>
        {newsLoading && (
          <div className="card border-mint-100 bg-mint-50 text-xs text-mint-700">
            Загрузка новостей...
          </div>
        )}
        {newsError && (
          <div className="card border-red-100 bg-red-50 text-xs text-red-600">
            {newsError}
          </div>
        )}
        {!newsLoading && !newsError && (
          <div className="grid gap-5 md:grid-cols-3">
            {news.map((item) => (
              <NewsCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>

      {/* Блок «О специалисте» */}
      <section className="card border-mint-100 bg-gradient-to-r from-mint-50 to-white">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-mint-100 text-2xl">
            ⚕️
          </span>
          <div>
            <h3 className="mb-2 text-base font-bold text-gray-800">О специалисте</h3>
            <p className="text-sm leading-relaxed text-gray-600">
              Специалист по лечебной физкультуре с опытом работы более 10 лет. Индивидуальный
              подбор упражнений с учётом возраста, состояния здоровья и рекомендаций врача.
              Работа с детьми от 3 лет.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
};

// Страница профиля — просмотр и редактирование данных пользователя
const ProfilePage: React.FC<{
  currentUser: User | null;
  getToken: () => Promise<string | null>;
  onUpdateUser: () => void;
}> = ({ currentUser, getToken, onUpdateUser }) => {
  if (!currentUser) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="card text-center">
          <span className="mb-3 inline-block text-4xl">🔒</span>
          <h1 className="mb-2 text-lg font-bold text-gray-800">Профиль недоступен</h1>
          <p className="text-sm text-gray-500">
            Войдите в систему как пациент или специалист, чтобы просматривать профиль.
          </p>
        </div>
      </main>
    );
  }

  const [email, setEmail] = useState(currentUser.email);
  const [firstName, setFirstName] = useState(currentUser.firstName ?? '');
  const [lastName, setLastName] = useState(currentUser.lastName ?? '');
  const [phone, setPhone] = useState(currentUser.phone ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('E-mail обязателен для заполнения.');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Нет токена авторизации');
      const updated = await apiUpdateUser(token, {
        email: email.trim(),
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        phone: phone.trim() || undefined
      });
      onUpdateUser(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при сохранении');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="card">
        {/* Заголовок профиля с иконкой */}
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-mint-100 text-xl">👤</span>
          <div>
            <h1 className="text-lg font-bold text-gray-800">Профиль</h1>
            <p className="text-xs text-gray-400">Управление вашими данными</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">Имя</label>
              <input
                type="text"
                className="input-field"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">Фамилия</label>
              <input
                type="text"
                className="input-field"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">Телефон</label>
              <input
                type="tel"
                className="input-field"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">Роль</label>
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-mint-50 px-4 py-2.5 text-sm font-semibold text-mint-700">
                <span>{currentUser.role === 'user' ? '👤' : '⚕️'}</span>
                {currentUser.role === 'user' ? 'Пациент' : 'Специалист'}
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-600">
              E-mail <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
              {error}
            </p>
          )}

          <button type="submit" disabled={!email.trim() || isLoading} className="btn-primary w-full">
            {isLoading ? 'Сохранение...' : 'Сохранить изменения'}
          </button>
        </form>
      </div>
    </main>
  );
};

// Страница записи на приём для пациента
const BookingPage: React.FC<{
  currentUser: User | null;
  slots: TimeSlot[];
  slotsLoading?: boolean;
  slotsError?: string | null;
  onCreateBooking: (payload: {
    slotId: string;
    specialistId: string;
    date: string;
    time: string;
    lastName: string;
    firstName: string;
    phone?: string;
  }) => Promise<void>;
}> = ({ currentUser, slots, slotsLoading, slotsError, onCreateBooking }) => {
  const navigate = useNavigate();

  // Уникальные даты с доступными слотами
  const availableDates = useMemo(() => {
    const dates = new Set(slots.map((s) => s.date));
    return Array.from(dates).sort();
  }, [slots]);

  const firstDate = availableDates[0] ?? '';

  const [selectedDate, setSelectedDate] = useState(firstDate);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [firstName, setFirstName] = useState(currentUser?.firstName ?? '');
  const [lastName, setLastName] = useState(currentUser?.lastName ?? '');
  const [phone, setPhone] = useState(currentUser?.phone ?? '');
  const [over18, setOver18] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (availableDates.length > 0 && !availableDates.includes(selectedDate)) {
      setSelectedDate(availableDates[0]);
      setSelectedTime(null);
    }
  }, [availableDates]);

  if (!currentUser || currentUser.role !== 'user') {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="card text-center">
          <span className="mb-3 inline-block text-4xl">📋</span>
          <h1 className="mb-2 text-lg font-bold text-gray-800">
            Запись доступна только авторизованным пациентам
          </h1>
          <p className="mb-4 text-sm text-gray-500">
            Пожалуйста, войдите в систему как пациент, чтобы выбрать время приёма.
          </p>
          <button type="button" onClick={() => navigate('/login')} className="btn-primary">
            Войти
          </button>
        </div>
      </main>
    );
  }

  // Слоты на выбранную дату
  const dateSlots = useMemo(
    () => slots.filter((s) => s.date === selectedDate),
    [slots, selectedDate]
  );

  const selectedSlot = dateSlots.find((s) => s.time === selectedTime);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTime || !selectedSlot || !over18) return;
    setSubmitError(null);
    setSubmitLoading(true);
    try {
      await onCreateBooking({
        slotId: selectedSlot.id,
        specialistId: selectedSlot.specialistId,
        date: selectedDate,
        time: selectedTime,
        lastName: lastName || 'Пациент',
        firstName: firstName || 'Без имени',
        phone
      });
      navigate('/book/success');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Ошибка при записи');
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      {/* Выбор даты и времени */}
      <section className="card mb-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-mint-100 text-xl">📅</span>
          <h1 className="text-lg font-bold text-gray-800">Запись на приём</h1>
        </div>

        {slotsLoading && (
          <div className="mb-3 rounded-xl bg-mint-50 px-4 py-2.5 text-xs font-semibold text-mint-700">
            Загрузка доступного времени...
          </div>
        )}
        {slotsError && (
          <div className="mb-3 rounded-xl bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-600">
            {slotsError}
          </div>
        )}

        {/* Выбор даты */}
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-semibold text-gray-600">Дата</label>
          <select
            className="input-field"
            value={availableDates.includes(selectedDate) ? selectedDate : firstDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setSelectedTime(null);
            }}
          >
            {availableDates.length === 0 ? (
              <option value="">Нет доступных дат для записи</option>
            ) : (
              availableDates.map((d) => (
                <option key={d} value={d}>
                  {new Date(d + 'T12:00:00').toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Сетка временных слотов */}
        <div className="mb-2 text-xs font-semibold text-gray-600">Время</div>
        {!slotsLoading && dateSlots.length === 0 && !slotsError && (
          <p className="mb-2 text-xs text-gray-400">Нет доступных слотов на выбранную дату.</p>
        )}
        <div className="grid grid-cols-3 gap-2">
          {dateSlots.map((slot) => {
            const isBusy = slot.status === 'busy';
            const isSelected = selectedTime === slot.time;
            return (
              <button
                key={slot.id}
                type="button"
                disabled={isBusy}
                onClick={() => setSelectedTime(slot.time)}
                className={[
                  'rounded-xl border-2 px-3 py-2 text-sm font-semibold transition-all',
                  isBusy
                    ? 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-300'
                    : isSelected
                    ? 'border-mint-500 bg-mint-50 text-mint-700 shadow-sm'
                    : 'border-gray-100 text-gray-600 hover:border-mint-300 hover:bg-mint-50/50'
                ].join(' ')}
              >
                <div>{slot.time}</div>
                <div className="text-[10px] font-normal">
                  {isBusy ? 'Занято' : 'Свободно'}
                </div>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] text-gray-400">
          Другие пациенты не видят ваши данные — только статус «Свободно» или «Занято».
        </p>
      </section>

      {/* Данные пациента */}
      <section className="card">
        <div className="mb-3 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-coral-100 text-lg">✍️</span>
          <h2 className="text-base font-bold text-gray-800">Данные пациента</h2>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">Имя</label>
              <input
                type="text"
                className="input-field"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">Фамилия</label>
              <input
                type="text"
                className="input-field"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-600">Телефон</label>
            <input
              type="tel"
              className="input-field"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          {/* Чекбокс подтверждения возраста */}
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={over18}
              onChange={(e) => setOver18(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-mint-500 focus:ring-mint-400"
            />
            <span className="font-medium">Мне уже исполнилось 18 лет</span>
          </label>

          <button
            type="submit"
            disabled={!selectedTime || !over18 || submitLoading}
            className="btn-primary w-full"
          >
            {submitLoading ? 'Отправка...' : 'Подтвердить запись'}
          </button>
          {submitError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{submitError}</p>
          )}
        </form>
      </section>
    </main>
  );
};

// Страница подтверждения успешной записи
const BookingSuccessPage: React.FC = () => {
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <div className="card text-center">
        <span className="mb-3 inline-block text-5xl">🎉</span>
        <h1 className="mb-2 text-xl font-bold text-gray-800">Вы успешно записаны!</h1>
        <p className="mb-4 text-sm text-gray-500">
          Сохраните ссылку для отмены записи, если планы изменятся. Специалист
          получит уведомление о вашей записи.
        </p>
        <div className="mb-5 rounded-xl bg-mint-50 p-4 text-left text-xs">
          <p className="mb-1 font-bold text-gray-700">Ссылка для отмены (пример):</p>
          <code className="block break-all text-[11px] text-mint-700">
            https://example.com/cancel?token=demo-token
          </code>
        </div>
        <Link to="/" className="btn-primary inline-flex">
          На главную
        </Link>
      </div>
    </main>
  );
};

// Страница отмены записи по ссылке
const CancelBookingPage: React.FC = () => {
  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <div className="card text-center">
        <span className="mb-3 inline-block text-5xl">🗓️</span>
        <h1 className="mb-2 text-xl font-bold text-gray-800">Отмена записи</h1>
        <p className="mb-2 text-sm text-gray-500">
          В этой демо-версии отмена записи не изменяет реальные данные, но показывает
          структуру страницы.
        </p>
        <p className="mb-5 text-xs text-gray-400">
          В рабочей версии по токену из ссылки будет находиться запись, её статус станет
          «отменён», а специалисту отправится уведомление.
        </p>
        <Link to="/" className="btn-primary inline-flex">
          На главную
        </Link>
      </div>
    </main>
  );
};

// Страница «Мои записи» для пациента
const MyBookingsPage: React.FC<{
  currentUser: User | null;
  bookings: Booking[];
  isLoading?: boolean;
  error?: string | null;
  onCancelBooking: (bookingId: string) => Promise<void>;
}> = ({ currentUser, bookings, isLoading, error, onCancelBooking }) => {
  const userBookings = useMemo(
    () =>
      bookings.filter(
        (b) => b.status === 'active' && b.userId === currentUser?.id
      ),
    [bookings, currentUser]
  );

  if (!currentUser || currentUser.role !== 'user') {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="card text-center">
          <span className="mb-3 inline-block text-4xl">🔒</span>
          <h1 className="mb-2 text-lg font-bold text-gray-800">
            Раздел доступен только пациентам
          </h1>
          <p className="text-sm text-gray-500">
            Войдите как пациент, чтобы просмотреть ваши записи.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="card">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-mint-100 text-xl">📋</span>
          <h1 className="text-lg font-bold text-gray-800">Мои записи</h1>
        </div>

        {isLoading && (
          <div className="rounded-xl bg-mint-50 px-4 py-2.5 text-xs font-semibold text-mint-700">
            Загрузка списка записей...
          </div>
        )}

        {!isLoading && error && (
          <div className="rounded-xl bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-600">
            {error}
          </div>
        )}

        {!isLoading && !error && (
          <>
            {userBookings.length === 0 && (
              <div className="py-6 text-center">
                <span className="mb-2 inline-block text-3xl">📭</span>
                <p className="text-sm text-gray-500">У вас пока нет активных записей.</p>
              </div>
            )}
            <ul className="space-y-2">
              {userBookings.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 transition-colors hover:bg-mint-50/30"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-gray-700">
                      {new Date(b.date).toLocaleDateString('ru-RU')}, {b.time}
                    </span>
                    <span className="text-xs text-gray-400">
                      Специалист:{' '}
                      {(b.specialistLastName || b.specialistFirstName)
                        ? `${b.specialistLastName ?? ''} ${b.specialistFirstName ?? ''}`.trim()
                        : 'не указан'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-mint-100 px-2.5 py-0.5 text-[11px] font-bold text-mint-700">
                      Активна
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = window.confirm('Вы уверены, что хотите отменить эту запись?');
                        if (!ok) return;
                        await onCancelBooking(b.id);
                      }}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-500 transition-colors hover:bg-red-50"
                    >
                      Отменить
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </main>
  );
};

// Страница расписания специалиста
const SpecialistSchedulePage: React.FC<{
  currentUser: User | null;
  slots: TimeSlot[];
  bookings: Booking[];
  slotsLoading?: boolean;
  slotsError?: string | null;
  bookingsLoading?: boolean;
  bookingsError?: string | null;
  onCreateBySpecialist: (payload: {
    date: string;
    time: string;
    lastName: string;
    firstName: string;
    phone?: string;
  }) => Promise<void>;
  onCreateSlot: (payload: { date: string; time: string }) => Promise<void>;
  onCreateSlotsBatch: (payload: { date: string; times: string[] }) => Promise<void>;
  onDeleteSlot: (slotId: string) => Promise<void>;
}> = ({
  currentUser,
  slots,
  bookings,
  slotsLoading,
  slotsError,
  bookingsLoading,
  bookingsError,
  onCreateBySpecialist,
  onCreateSlot,
  onCreateSlotsBatch,
  onDeleteSlot
}) => {
  const today = useMemo(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }, []);

  const availableDatesForSpecialist = useMemo(() => {
    if (!currentUser) return [];
    const dates = new Set(
      slots
        .filter((s) => s.specialistId === currentUser.id)
        .map((s) => s.date)
    );
    return Array.from(dates).sort();
  }, [slots, currentUser]);

  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [newSlotTime, setNewSlotTime] = useState('');
  const [batchStartTime, setBatchStartTime] = useState('');
  const [batchEndTime, setBatchEndTime] = useState('');
  const [batchStepMin, setBatchStepMin] = useState(30);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (
      availableDatesForSpecialist.length > 0 &&
      !availableDatesForSpecialist.includes(selectedDate)
    ) {
      setSelectedDate(availableDatesForSpecialist[0]);
      setSelectedTime(null);
    }
  }, [availableDatesForSpecialist]);

  if (!currentUser || currentUser.role !== 'specialist') {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="card text-center">
          <span className="mb-3 inline-block text-4xl">🔒</span>
          <h1 className="mb-2 text-lg font-bold text-gray-800">
            Раздел доступен только специалистам
          </h1>
          <p className="text-sm text-gray-500">
            Войдите как специалист, чтобы просмотреть своё расписание.
          </p>
        </div>
      </main>
    );
  }

  const specialistBookings = useMemo(
    () =>
      bookings.filter(
        (b) => b.specialistId === currentUser.id && b.status === 'active'
      ),
    [bookings, currentUser]
  );

  const dateSlots = useMemo(
    () =>
      slots.filter(
        (s) =>
          s.specialistId === currentUser.id &&
          s.date === selectedDate &&
          s.status === 'free'
      ),
    [slots, currentUser, selectedDate]
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTime) return;
    setActionError(null);
    setActionLoading(true);
    try {
      await onCreateBySpecialist({
        date: selectedDate,
        time: selectedTime,
        lastName: lastName || 'Пациент',
        firstName: firstName || 'Без имени',
        phone
      });
      setFirstName('');
      setLastName('');
      setPhone('');
      setSelectedTime(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Ошибка при создании записи');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSlotTime) return;
    setActionError(null);
    setActionLoading(true);
    try {
      await onCreateSlot({ date: selectedDate, time: newSlotTime });
      setNewSlotTime('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Ошибка при добавлении слота');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateSlotsBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchStartTime || !batchEndTime) return;
    const toMinutes = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + (m || 0);
    };
    const fromMinutes = (min: number) => {
      const h = Math.floor(min / 60);
      const m = min % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };
    const start = toMinutes(batchStartTime);
    const end = toMinutes(batchEndTime);
    if (start >= end) return;
    const step = Math.max(1, batchStepMin);
    const times: string[] = [];
    for (let m = start; m < end; m += step) {
      times.push(fromMinutes(m));
    }
    if (times.length > 0) {
      setActionError(null);
      setActionLoading(true);
      try {
        await onCreateSlotsBatch({ date: selectedDate, times });
        setBatchStartTime('');
        setBatchEndTime('');
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Ошибка при добавлении слотов');
      } finally {
        setActionLoading(false);
      }
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    setActionError(null);
    setActionLoading(true);
    try {
      await onDeleteSlot(slotId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Ошибка при удалении слота');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {/* Блок ошибок */}
      {slotsError && (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-600">
          {slotsError}
        </div>
      )}
      {bookingsError && (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-600">
          {bookingsError}
        </div>
      )}
      {actionError && (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-600">
          {actionError}
        </div>
      )}

      {/* Таблица записей */}
      <section className="card mb-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-mint-100 text-xl">📊</span>
          <h1 className="text-lg font-bold text-gray-800">Расписание записей</h1>
        </div>
        {bookingsLoading && (
          <p className="text-xs font-semibold text-mint-700">Загрузка записей...</p>
        )}
        {!bookingsLoading && specialistBookings.length === 0 ? (
          <div className="py-4 text-center">
            <span className="mb-2 inline-block text-3xl">📭</span>
            <p className="text-sm text-gray-500">На выбранный период у вас пока нет записей.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-[11px] font-bold uppercase text-gray-400">
                  <th className="px-3 py-2.5">Дата</th>
                  <th className="px-3 py-2.5">Время</th>
                  <th className="px-3 py-2.5">Фамилия</th>
                  <th className="px-3 py-2.5">Имя</th>
                  <th className="px-3 py-2.5">Телефон</th>
                </tr>
              </thead>
              <tbody>
                {specialistBookings.map((b) => (
                  <tr key={b.id} className="border-b border-gray-50 last:border-0 hover:bg-mint-50/30">
                    <td className="px-3 py-2.5 font-semibold text-gray-700">
                      {new Date(b.date).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">{b.time}</td>
                    <td className="px-3 py-2.5 text-gray-600">{b.lastName}</td>
                    <td className="px-3 py-2.5 text-gray-600">{b.firstName}</td>
                    <td className="px-3 py-2.5 text-gray-600">{b.phone ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Настройка расписания */}
      <section className="card mb-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-coral-100 text-xl">⚙️</span>
          <div>
            <h2 className="text-base font-bold text-gray-800">Настройка расписания приёма</h2>
            <p className="text-xs text-gray-400">Добавьте дату и часы, когда вы готовы принимать</p>
          </div>
        </div>

        {/* Выбор даты */}
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-semibold text-gray-600">Дата для записи</label>
          <input
            type="date"
            className="input-field"
            value={selectedDate}
            min={today}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setSelectedTime(null);
            }}
          />
        </div>

        {/* Добавление одного слота */}
        <form onSubmit={handleCreateSlot} className="mb-4 space-y-3">
          <label className="mb-1.5 block text-xs font-semibold text-gray-600">
            Добавить один час приёма
          </label>
          <div className="flex gap-2">
            <input
              type="time"
              className="input-field flex-1"
              value={newSlotTime}
              onChange={(e) => setNewSlotTime(e.target.value)}
            />
            <button type="submit" disabled={!newSlotTime || actionLoading} className="btn-primary">
              Добавить слот
            </button>
          </div>
        </form>

        {/* Добавление нескольких слотов (диапазон) */}
        <form onSubmit={handleCreateSlotsBatch} className="rounded-2xl border border-mint-100 bg-mint-50/30 p-4">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">
            Добавить несколько часов подряд
          </h3>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[100px]">
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">С</label>
              <input
                type="time"
                className="input-field"
                value={batchStartTime}
                onChange={(e) => setBatchStartTime(e.target.value)}
              />
            </div>
            <div className="min-w-[100px]">
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">До</label>
              <input
                type="time"
                className="input-field"
                value={batchEndTime}
                onChange={(e) => setBatchEndTime(e.target.value)}
              />
            </div>
            <div className="min-w-[80px]">
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">Шаг (мин)</label>
              <select
                className="input-field"
                value={batchStepMin}
                onChange={(e) => setBatchStepMin(Number(e.target.value))}
              >
                <option value={15}>15</option>
                <option value={30}>30</option>
                <option value={60}>60</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={!batchStartTime || !batchEndTime || actionLoading}
              className="btn-primary"
            >
              Добавить слоты
            </button>
          </div>
        </form>

        {/* Список свободных слотов */}
        <div className="mt-5">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
            Свободные слоты на выбранную дату
          </h3>
          {slotsLoading && <p className="text-xs font-semibold text-mint-700">Загрузка слотов...</p>}
          {!slotsLoading && dateSlots.length === 0 ? (
            <div className="rounded-xl bg-gray-50 py-4 text-center text-xs text-gray-400">
              Свободные слоты не заданы. Добавьте время приёма выше.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {dateSlots.map((slot) => (
                <li
                  key={slot.id}
                  className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-2 transition-colors hover:bg-mint-50/30"
                >
                  <span className="text-sm font-semibold text-gray-700">{slot.time}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteSlot(slot.id)}
                    disabled={actionLoading}
                    className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                  >
                    Убрать
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Форма «Записать пациента» */}
      <section className="card">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-warm-100 text-xl">✍️</span>
          <h2 className="text-base font-bold text-gray-800">Записать пациента</h2>
        </div>
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">Дата</label>
              <select
                className="input-field"
                value={
                  availableDatesForSpecialist.includes(selectedDate)
                    ? selectedDate
                    : availableDatesForSpecialist[0] ?? ''
                }
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setSelectedTime(null);
                }}
              >
                {availableDatesForSpecialist.length === 0 ? (
                  <option value="">Сначала добавьте даты и часы выше</option>
                ) : (
                  availableDatesForSpecialist.map((d) => (
                    <option key={d} value={d}>
                      {new Date(d + 'T12:00:00').toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">Свободные слоты</label>
              <select
                className="input-field"
                value={selectedTime ?? ''}
                onChange={(e) => setSelectedTime(e.target.value || null)}
              >
                <option value="">Не выбрано</option>
                {dateSlots.map((slot) => (
                  <option key={slot.id} value={slot.time}>
                    {slot.time}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">Имя</label>
              <input
                type="text"
                className="input-field"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">Фамилия</label>
              <input
                type="text"
                className="input-field"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-600">Телефон</label>
            <input
              type="tel"
              className="input-field"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={!selectedTime || availableDatesForSpecialist.length === 0 || actionLoading}
            className="btn-primary w-full"
          >
            {actionLoading ? 'Создание...' : 'Создать запись'}
          </button>
          <p className="mt-1 text-[11px] text-gray-400">
            Пациент не видит ФИО других пациентов — только статус свободного или занятого слота.
          </p>
        </form>
      </section>
    </main>
  );
};

// Страница управления новостями для специалиста
const SpecialistNewsPage: React.FC<{
  currentUser: User | null;
  news: NewsItem[];
  newsLoading?: boolean;
  newsError?: string | null;
  onAddNews: (payload: { title: string; excerpt: string; imageUrl: string }) => Promise<void>;
  onUpdateNews: (payload: { id: string; title: string; excerpt: string; imageUrl: string }) => Promise<void>;
}> = ({ currentUser, news, newsLoading, newsError, onAddNews, onUpdateNews }) => {
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!currentUser || currentUser.role !== 'specialist') {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="card text-center">
          <span className="mb-3 inline-block text-4xl">🔒</span>
          <h1 className="mb-2 text-lg font-bold text-gray-800">
            Раздел доступен только специалистам
          </h1>
          <p className="text-sm text-gray-500">
            Войдите как специалист, чтобы управлять новостями.
          </p>
        </div>
      </main>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !imageUrl) return;
    setError(null);
    setIsLoading(true);
    try {
      if (editingId) {
        await onUpdateNews({ id: editingId, title, excerpt, imageUrl });
      } else {
        await onAddNews({ title, excerpt, imageUrl });
      }
      setTitle('');
      setExcerpt('');
      setImageUrl('');
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при сохранении');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {newsError && (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-600">
          {newsError}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-600">
          {error}
        </div>
      )}

      {/* Форма добавления/редактирования новости */}
      <section className="card mb-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-coral-100 text-xl">📝</span>
          <h1 className="text-lg font-bold text-gray-800">Управление новостями</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-600">Заголовок</label>
            <input
              type="text"
              className="input-field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-600">
              Краткий текст (описание)
            </label>
            <textarea
              className="input-field resize-none"
              rows={3}
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-600">
              URL картинки
            </label>
            <input
              type="text"
              className="input-field"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
          </div>
          <button type="submit" disabled={!title || !imageUrl || isLoading} className="btn-primary w-full">
            {isLoading ? 'Сохранение...' : editingId ? 'Сохранить изменения' : 'Добавить новость'}
          </button>
        </form>
      </section>

      {/* Список текущих новостей */}
      <section className="card">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-mint-100 text-xl">📰</span>
          <h2 className="text-base font-bold text-gray-800">Текущие новости</h2>
        </div>
        {newsLoading && (
          <p className="text-xs font-semibold text-mint-700">Загрузка новостей...</p>
        )}
        {!newsLoading && (
          <div className="grid gap-5 md:grid-cols-3">
            {news.map((item) => (
              <div key={item.id} className="flex flex-col gap-2">
                <NewsCard item={item} />
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(item.id);
                    setTitle(item.title);
                    setExcerpt(item.excerpt);
                    setImageUrl(item.imageUrl);
                  }}
                  className="btn-secondary text-xs"
                >
                  Редактировать
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
};

// Корневой компонент App — хранит глобальное состояние, загружает данные через API
const App: React.FC = () => {
  const { user: currentUser, loading: authLoading, needsRoleSelect, roleSelectEmail, completeRoleSelect, getToken, refreshUser } = useClerkAuth();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingNews, setLoadingNews] = useState(true);
  const [errorNews, setErrorNews] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [errorSlots, setErrorSlots] = useState<string | null>(null);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [errorBookings, setErrorBookings] = useState<string | null>(null);

  const fetchNews = useCallback(async () => {
    setLoadingNews(true);
    setErrorNews(null);
    try {
      const data = await apiGetNews();
      setNews(Array.isArray(data) ? data : []);
    } catch (err) {
      setErrorNews(err instanceof Error ? err.message : 'Не удалось загрузить новости');
    } finally {
      setLoadingNews(false);
    }
  }, []);

  const fetchSlots = useCallback(async () => {
    if (!currentUser) return;
    const token = await getToken();
    if (!token) return;
    setLoadingSlots(true);
    setErrorSlots(null);
    try {
      const specId = currentUser.role === 'specialist' ? currentUser.id : undefined;
      const data = await apiGetSlots(token, specId);
      setSlots(Array.isArray(data) ? data : []);
    } catch (err) {
      setErrorSlots(err instanceof Error ? err.message : 'Не удалось загрузить слоты');
    } finally {
      setLoadingSlots(false);
    }
  }, [currentUser, getToken]);

  const fetchBookings = useCallback(async () => {
    if (!currentUser) return;
    const token = await getToken();
    if (!token) return;
    setLoadingBookings(true);
    setErrorBookings(null);
    try {
      const params = currentUser.role === 'user' ? { userId: currentUser.id } : { specialistId: currentUser.id };
      const data = await apiGetBookings(token, params);
      setBookings(Array.isArray(data) ? data : []);
    } catch (err) {
      setErrorBookings(err instanceof Error ? err.message : 'Не удалось загрузить записи');
    } finally {
      setLoadingBookings(false);
    }
  }, [currentUser, getToken]);

  useEffect(() => { fetchNews(); }, [fetchNews]);

  useEffect(() => {
    if (currentUser) {
      fetchSlots();
      fetchBookings();
    } else {
      setSlots([]);
      setBookings([]);
      setLoadingSlots(false);
      setLoadingBookings(false);
      setErrorSlots(null);
      setErrorBookings(null);
    }
  }, [currentUser, fetchSlots, fetchBookings]);

  const handleCreateBookingByUser = useCallback(async (payload: {
    slotId: string;
    specialistId: string;
    date: string;
    time: string;
    lastName: string;
    firstName: string;
    phone?: string;
  }) => {
    if (!currentUser) return;
    const token = await getToken();
    if (!token) return;
    await apiCreateBookingByPatient(token, {
      specialistId: payload.specialistId,
      slotId: payload.slotId,
      firstName: payload.firstName,
      lastName: payload.lastName,
      phone: payload.phone
    });
    await fetchSlots();
    await fetchBookings();
  }, [currentUser, getToken, fetchSlots, fetchBookings]);

  const handleCancelBookingByUser = useCallback(async (bookingId: string) => {
    if (!currentUser) return;
    const token = await getToken();
    if (!token) return;
    await apiCancelBooking(token, bookingId);
    await fetchSlots();
    await fetchBookings();
  }, [currentUser, getToken, fetchSlots, fetchBookings]);

  const handleCreateBookingBySpecialist = useCallback(async (payload: {
    date: string;
    time: string;
    lastName: string;
    firstName: string;
    phone?: string;
  }) => {
    if (!currentUser) return;
    const token = await getToken();
    if (!token) return;
    await apiCreateBookingBySpecialist(token, {
      specialistId: currentUser.id,
      date: payload.date,
      time: payload.time,
      firstName: payload.firstName,
      lastName: payload.lastName,
      phone: payload.phone
    });
    await fetchSlots();
    await fetchBookings();
  }, [currentUser, getToken, fetchSlots, fetchBookings]);

  const handleUpdateProfile = useCallback(() => {
    refreshUser();
  }, [refreshUser]);

  const handleAddNews = useCallback(async (payload: { title: string; excerpt: string; imageUrl: string }) => {
    if (!currentUser) return;
    const token = await getToken();
    if (!token) return;
    const item = await apiAddNews(token, payload);
    setNews((prev) => [item, ...prev]);
  }, [currentUser, getToken]);

  const handleUpdateNews = useCallback(async (payload: { id: string; title: string; excerpt: string; imageUrl: string }) => {
    if (!currentUser) return;
    const token = await getToken();
    if (!token) return;
    const updated = await apiUpdateNews(token, payload.id, payload);
    setNews((prev) => prev.map((n) => (n.id === payload.id ? updated : n)));
  }, [currentUser, getToken]);

  const handleCreateSlotBySpecialist = useCallback(async (payload: { date: string; time: string }) => {
    if (!currentUser) return;
    const token = await getToken();
    if (!token) return;
    const slot = await apiCreateSlot(token, {
      specialistId: currentUser.id,
      date: payload.date,
      time: payload.time
    });
    setSlots((prev) => [...prev, slot]);
  }, [currentUser, getToken]);

  const handleDeleteSlotBySpecialist = useCallback(async (slotId: string) => {
    if (!currentUser) return;
    const token = await getToken();
    if (!token) return;
    await apiDeleteSlot(token, slotId);
    setSlots((prev) => prev.filter((s) => s.id !== slotId));
  }, [currentUser, getToken]);

  const handleCreateSlotsBatchBySpecialist = useCallback(async (payload: { date: string; times: string[] }) => {
    if (!currentUser) return;
    const token = await getToken();
    if (!token) return;
    const created = await apiCreateSlotsBatch(token, {
      specialistId: currentUser.id,
      date: payload.date,
      times: payload.times
    });
    if (created.length > 0) setSlots((prev) => [...prev, ...created]);
  }, [currentUser, getToken]);

  // Общая тема Clerk — нужна, чтобы формы входа и регистрации визуально совпадали с новым дизайном сайта
  const clerkAppearance = useMemo(
    () => ({
      variables: {
        colorPrimary: '#22c55e',
        colorBackground: '#ffffff',
        colorText: '#1f2937',
        colorInputBackground: '#ffffff',
        colorInputText: '#1f2937',
        borderRadius: '14px',
        fontFamily: 'Nunito, system-ui, sans-serif',
      },
      elements: {
        card: 'shadow-soft border border-mint-100 rounded-2xl',
        headerTitle: 'text-gray-800 font-extrabold',
        headerSubtitle: 'text-gray-500',
        socialButtonsBlockButton:
          'rounded-xl border border-gray-200 text-gray-700 hover:bg-mint-50 hover:border-mint-200',
        dividerLine: 'bg-gray-100',
        dividerText: 'text-gray-400',
        formFieldLabel: 'text-gray-600 font-semibold',
        formFieldInput:
          'rounded-xl border border-gray-200 focus:border-mint-400 focus:ring-2 focus:ring-mint-100',
        formButtonPrimary: 'bg-mint-500 hover:bg-mint-600 text-white rounded-xl font-bold',
        footerActionText: 'text-gray-500',
        footerActionLink: 'text-mint-600 hover:text-mint-700 font-semibold',
        identityPreviewText: 'text-gray-600',
      },
    }),
    []
  );

  // Экран выбора роли при первом входе
  if (needsRoleSelect) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-mint-50 via-white to-warm-50">
        <Header currentUser={null} />
        <main className="flex min-h-[70vh] items-center justify-center px-4 py-8">
          <RoleSelectForm email={roleSelectEmail} onComplete={completeRoleSelect} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-mint-50 via-white to-warm-50">
      <Header currentUser={currentUser} />
      <Routes>
        <Route
          path="/"
          element={
            <HomePage
              currentUser={currentUser}
              news={news}
              newsLoading={loadingNews}
              newsError={errorNews}
            />
          }
        />
        <Route
          path="/login/*"
          element={
            <main className="flex min-h-[70vh] items-center justify-center px-4 py-8">
              {/* Обёртка нужна, чтобы форма авторизации выглядела как карточка текущего дизайна сайта */}
              <div className="w-full max-w-md rounded-3xl bg-gradient-to-br from-mint-100/60 via-white to-warm-50 p-4 shadow-soft">
              {/* Заголовок нужен, чтобы сразу объяснить пользователю назначение экрана входа */}
              <div className="mb-3 rounded-2xl bg-white/80 p-4 text-center shadow-sm">
                <div className="mb-1 text-3xl">🔐</div>
                <h1 className="text-lg font-extrabold text-gray-800">Вход в личный кабинет</h1>
                <p className="mt-1 text-xs text-gray-500">
                  Авторизуйтесь, чтобы записаться на занятия ЛФК
                </p>
              </div>
              <SignIn
                routing="path"
                path="/login"
                signUpUrl="/register"
                afterSignInUrl="/"
                afterSignOutUrl="/"
                appearance={clerkAppearance}
              />
              </div>
            </main>
          }
        />
        <Route
          path="/register/*"
          element={
            <main className="flex min-h-[70vh] items-center justify-center px-4 py-8">
              {/* Обёртка нужна, чтобы форма регистрации выглядела как карточка текущего дизайна сайта */}
              <div className="w-full max-w-md rounded-3xl bg-gradient-to-br from-mint-100/60 via-white to-warm-50 p-4 shadow-soft">
                {/* Заголовок нужен, чтобы сделать экран регистрации понятным и дружелюбным */}
                <div className="mb-3 rounded-2xl bg-white/80 p-4 text-center shadow-sm">
                  <div className="mb-1 text-3xl">✨</div>
                  <h1 className="text-lg font-extrabold text-gray-800">Регистрация</h1>
                  <p className="mt-1 text-xs text-gray-500">
                    Создайте аккаунт для записи и управления посещениями
                  </p>
                </div>
                <SignUp
                  routing="path"
                  path="/register"
                  signInUrl="/login"
                  afterSignUpUrl="/"
                  appearance={clerkAppearance}
                />
              </div>
            </main>
          }
        />
        <Route
          path="/profile"
          element={
            <ProfilePage
              currentUser={currentUser}
              getToken={getToken}
              onUpdateUser={handleUpdateProfile}
            />
          }
        />
        <Route
          path="/book"
          element={
            <BookingPage
              currentUser={currentUser}
              slots={slots}
              slotsLoading={loadingSlots}
              slotsError={errorSlots}
              onCreateBooking={handleCreateBookingByUser}
            />
          }
        />
        <Route path="/book/success" element={<BookingSuccessPage />} />
        <Route path="/cancel" element={<CancelBookingPage />} />
        <Route
          path="/my-bookings"
          element={
            <MyBookingsPage
              currentUser={currentUser}
              bookings={bookings}
              isLoading={loadingBookings}
              error={errorBookings}
              onCancelBooking={handleCancelBookingByUser}
            />
          }
        />
        <Route
          path="/specialist/schedule"
          element={
            <SpecialistSchedulePage
              currentUser={currentUser}
              slots={slots}
              bookings={bookings}
              slotsLoading={loadingSlots}
              slotsError={errorSlots}
              bookingsLoading={loadingBookings}
              bookingsError={errorBookings}
              onCreateBySpecialist={handleCreateBookingBySpecialist}
              onCreateSlot={handleCreateSlotBySpecialist}
              onCreateSlotsBatch={handleCreateSlotsBatchBySpecialist}
              onDeleteSlot={handleDeleteSlotBySpecialist}
            />
          }
        />
        <Route
          path="/specialist/news"
          element={
            <SpecialistNewsPage
              currentUser={currentUser}
              news={news}
              newsLoading={loadingNews}
              newsError={errorNews}
              onAddNews={handleAddNews}
              onUpdateNews={handleUpdateNews}
            />
          }
        />
      </Routes>

      {/* Футер сайта */}
      <footer className="mt-12 border-t border-gray-100 bg-white/60 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl px-4 py-6 text-center text-xs text-gray-400">
          <p className="font-semibold text-gray-500">🧒 Детский ЛФК</p>
          <p className="mt-1">Запись на приём к специалисту по лечебной физкультуре</p>
        </div>
      </footer>
    </div>
  );
};

export default App;
