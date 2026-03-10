// App.tsx — корневой компонент приложения: навигация, страницы и базовая логика
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import {
  apiAuth,
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
  apiUpdateUser
} from './api';
import {
  Booking,
  NewsItem,
  TimeSlot,
  User,
  UserRole,
  loadCurrentUserFromStorage,
  saveCurrentUserToStorage
} from './mockData';

// Тип для простой формы логина/регистрации
type AuthMode = 'login' | 'register';

// Компонент шапки сайта с навигацией по ролям, ссылкой на профиль и авторизацией
const Header: React.FC<{
  currentUser: User | null;
  onLogout: () => void;
}> = ({ currentUser, onLogout }) => {
  // location нужен, чтобы подсвечивать активные ссылки при необходимости
  const location = useLocation();

  // Функция для проверки, активен ли сейчас маршрут
  const isActive = (path: string) => location.pathname === path;

  return (
    // Внешний контейнер шапки: фиксированный блок навигации
    <header className="border-b bg-white">
      {/* Внутренний контейнер: выравнивание контента по центру и распределение по сторонам */}
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        {/* Левая часть: логотип/название сайта */}
        <Link to="/" className="text-lg font-semibold text-sky-700">
          {/* Текстовое название приложения */}
          Сайт ЛФК
        </Link>

        {/* Правая часть: навигация и кнопки входа/выхода */}
        <nav className="flex items-center gap-4 text-sm">
          {/* Ссылка на главную страницу */}
          <Link
            to="/"
            className={isActive('/') ? 'text-sky-700 font-semibold' : 'text-slate-700 hover:text-sky-700'}
          >
            Главная
          </Link>

          {/* Если авторизован пациент — показываем ссылки на запись и свои записи */}
          {currentUser?.role === 'user' && (
            <>
              {/* Ссылка для пациента на страницу записи */}
              <Link
                to="/book"
                className={
                  isActive('/book') ? 'text-sky-700 font-semibold' : 'text-slate-700 hover:text-sky-700'
                }
              >
                Записаться
              </Link>
              {/* Ссылка для пациента на список своих записей */}
              <Link
                to="/my-bookings"
                className={
                  isActive('/my-bookings')
                    ? 'text-sky-700 font-semibold'
                    : 'text-slate-700 hover:text-sky-700'
                }
              >
                Мои записи
              </Link>
            </>
          )}

          {/* Если авторизован специалист — показываем ссылки на расписание и управление новостями */}
          {currentUser?.role === 'specialist' && (
            <>
              {/* Ссылка для специалиста на своё расписание */}
              <Link
                to="/specialist/schedule"
                className={
                  isActive('/specialist/schedule')
                    ? 'text-sky-700 font-semibold'
                    : 'text-slate-700 hover:text-sky-700'
                }
              >
                Расписание
              </Link>
              {/* Ссылка для специалиста на управление новостями */}
              <Link
                to="/specialist/news"
                className={
                  isActive('/specialist/news')
                    ? 'text-sky-700 font-semibold'
                    : 'text-slate-700 hover:text-sky-700'
                }
              >
                Новости
              </Link>
            </>
          )}

          {/* Ссылка на профиль для любого авторизованного пользователя */}
          {currentUser && (
            <Link
              to="/profile"
              className={
                isActive('/profile')
                  ? 'text-sky-700 font-semibold'
                  : 'text-slate-700 hover:text-sky-700'
              }
            >
              Профиль
            </Link>
          )}

          {/* Если пользователь не авторизован — показываем кнопку входа */}
          {!currentUser && (
            <Link
              to="/login"
              className="rounded-md bg-sky-600 px-3 py-1.5 text-white hover:bg-sky-700"
            >
              Войти
            </Link>
          )}

          {/* Если пользователь авторизован — показываем его роль и кнопку выхода */}
          {currentUser && (
            <>
              <span className="text-xs text-slate-500">
                {currentUser.role === 'user' ? 'Пациент' : 'Специалист'}
              </span>
              <button
                type="button"
                onClick={onLogout}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
              >
                Выйти
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
};

// Компонент карточки новости на главной странице
const NewsCard: React.FC<{ item: NewsItem }> = ({ item }) => {
  return (
    // Внешний контейнер новости: карточка с тенью
    <article className="flex flex-col overflow-hidden rounded-lg border bg-white shadow-sm">
      {/* Картинка новости */}
      <div className="h-40 w-full overflow-hidden">
        <img
          src={item.imageUrl}
          alt={item.title}
          className="h-full w-full object-cover"
        />
      </div>
      {/* Текстовое содержимое новости */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
        <p className="text-xs text-slate-600">{item.excerpt}</p>
        <div className="mt-auto flex items-center justify-between pt-2 text-[11px] text-slate-400">
          <span>{new Date(item.date).toLocaleDateString('ru-RU')}</span>
          {item.source && (
            <span>{item.source === 'manual' ? 'Добавлено вручную' : 'Автоисточник'}</span>
          )}
        </div>
      </div>
    </article>
  );
};

// Главная страница с описанием услуги и блоком новостей
const HomePage: React.FC<{
  currentUser: User | null;
  news: NewsItem[];
  newsLoading?: boolean;
  newsError?: string | null;
}> = ({ currentUser, news, newsLoading, newsError }) => {
  const navigate = useNavigate();

  // Обработчик нажатия на кнопку «Записаться на приём»
  const handlePrimaryCta = () => {
    // Если пользователь — пациент, ведём сразу на страницу записи
    if (currentUser?.role === 'user') {
      navigate('/book');
    } else {
      // Иначе отправляем на страницу входа
      navigate('/login');
    }
  };

  return (
    // Основной контейнер главной страницы
    <main className="mx-auto max-w-5xl px-4 py-6">
      {/* Hero-блок с кратким описанием и основной кнопкой */}
      <section className="mb-8 flex flex-col gap-4 rounded-xl bg-sky-50 p-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <h1 className="mb-2 text-2xl font-bold text-sky-900">
            ЛФК для детей и взрослых
          </h1>
          <p className="text-sm text-slate-700">
            Онлайн-запись на приём к специалисту по лечебной физкультуре. Удобный выбор
            времени и напоминания о приёме.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Сервис предназначен для лиц старше 18 лет.
          </p>
          {/* Блок основных кнопок (Записаться / Войти) показываем только гостю.
              После авторизации они скрываются, чтобы не дублировать навигацию. */}
          {!currentUser && (
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={handlePrimaryCta}
                className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
              >
                Записаться на приём
              </button>
              <Link
                to="/login"
                className="rounded-md border border-sky-200 px-4 py-2 text-sm text-sky-700 hover:bg-sky-50"
              >
                Войти
              </Link>
            </div>
          )}
        </div>
        <div className="mt-4 flex-1 md:mt-0 md:text-right">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Индивидуальные занятия ЛФК
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Коррекция осанки, укрепление мышечного корсета и профилактика травм.
          </p>
        </div>
      </section>

      {/* Блок новостей с карточками */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Новости и статьи</h2>
          <span className="text-xs text-slate-500">
            ЛФК, здоровье детей и полезные материалы
          </span>
        </div>
        {newsLoading && (
          <div className="rounded-md border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-700">
            Загрузка новостей...
          </div>
        )}
        {newsError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {newsError}
          </div>
        )}
        {!newsLoading && !newsError && (
          <div className="grid gap-4 md:grid-cols-3">
            {news.map((item) => (
              <NewsCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>

      {/* Небольшой блок «О специалисте» */}
      <section className="rounded-xl border bg-white p-4 text-sm text-slate-700">
        <h3 className="mb-2 text-base font-semibold text-slate-900">О специалисте</h3>
        <p>
          Специалист по лечебной физкультуре с опытом работы более 10 лет. Индивидуальный
          подбор упражнений с учётом возраста, состояния здоровья и рекомендаций врача.
        </p>
      </section>
    </main>
  );
};

// Страница логина/регистрации с выбором роли
const AuthPage: React.FC<{
  mode: AuthMode;
  onAuth: (user: User) => void;
}> = ({ mode, onAuth }) => {
  const navigate = useNavigate();
  const [role, setRole] = useState<UserRole>('user');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isUserRole = role === 'user';
  // Валидация: email — формат test@test.ru, только латиница; телефон — ровно 12 символов (+7 и 10 цифр)
  const emailValid = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim());
  const phoneValid = phone.length === 12 && phone.startsWith('+7') && /^\+7\d{10}$/.test(phone);
  const isFormInvalid =
    !email.trim() ||
    !firstName.trim() ||
    !lastName.trim() ||
    !emailValid ||
    (isUserRole && (!phone.trim() || !phoneValid));

  // Ограничение ввода email: только латиница, цифры, @, ., -, _
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/[^a-zA-Z0-9@._-]/g, '');
    setEmail(v);
  };

  // Телефон: автодобавление +7, макс 12 символов (+7 и 10 цифр)
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, '');
    if (v.startsWith('8')) v = v.slice(1);
    if (v.startsWith('7')) v = v.slice(1);
    v = v.slice(0, 10);
    setPhone(v ? '+7' + v : '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isFormInvalid) {
      setError('Пожалуйста, заполните все обязательные поля.');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const user = await apiAuth(mode, {
        email: email.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role,
        phone: isUserRole ? phone.trim() : undefined
      });
      onAuth(user);
      if (role === 'user') navigate('/book');
      else navigate('/specialist/schedule');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при входе');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // Центрируем карточку авторизации по центру экрана
    <main className="flex min-h-[70vh] items-center justify-center bg-slate-50 px-4 py-6">
      {/* Карточка с формой входа/регистрации */}
      <div className="w-full max-w-md rounded-xl border bg-white p-6 shadow-sm">
        <h1 className="mb-4 text-xl font-semibold text-slate-900">
          {mode === 'login' ? 'Вход в систему' : 'Регистрация'}
        </h1>

        {/* Переключатель роли: пациент / специалист */}
        <div className="mb-4 flex gap-2 text-xs">
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
            onClick={() => setRole('specialist')}
            className={
              role === 'specialist'
                ? 'flex-1 rounded-md bg-sky-600 px-3 py-2 font-medium text-white'
                : 'flex-1 rounded-md border border-slate-200 px-3 py-2 text-slate-700'
            }
          >
            Специалист
          </button>
        </div>

        {/* Форма авторизации/регистрации (упрощённая, без реальных паролей) */}
        <form onSubmit={handleSubmit} className="space-y-3 text-sm">
          <div>
            <label className="mb-1 block text-xs text-slate-600">
              E-mail <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-sky-500"
              placeholder="test@test.ru"
              value={email}
              onChange={handleEmailChange}
              autoComplete="email"
            />
            {email.trim() && !emailValid && (
              <p className="mt-0.5 text-[11px] text-red-600">Формат: test@test.ru, только латинские буквы</p>
            )}
          </div>

          {/* Для пациента и специалиста позволяем ввести ФИО и телефон (опционально) */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-slate-600">
                Имя <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-sky-500"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs text-slate-600">
                Фамилия <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-sky-500"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>

          {role === 'user' && (
            <div>
              <label className="mb-1 block text-xs text-slate-600">
                Телефон <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-sky-500"
                placeholder="+79001234567"
                value={phone}
                onChange={handlePhoneChange}
                maxLength={12}
              />
              {phone && !phoneValid && (
                <p className="mt-0.5 text-[11px] text-red-600">Введите +7 и 10 цифр (всего 12 символов)</p>
              )}
            </div>
          )}

          {/* Блок отображения ошибки валидации или сетевой ошибки */}
          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}

          {/* Кнопка отправки — disabled при загрузке или невалидной форме */}
          <button
            type="submit"
            disabled={isFormInvalid || isLoading}
            className="mt-2 w-full rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
          >
            {isLoading ? 'Загрузка...' : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
          </button>

          {/* Подпись о том, что это учебный прототип без реальной безопасности */}
          <p className="mt-2 text-[11px] text-slate-400">
            В этой версии логика авторизации упрощена и использует только моковые данные.
          </p>
        </form>
      </div>
    </main>
  );
};

// Страница профиля: просмотр и изменение части данных пользователя
const ProfilePage: React.FC<{
  currentUser: User | null;
  onUpdateUser: (user: User) => void;
}> = ({ currentUser, onUpdateUser }) => {
  // Если пользователь не авторизован — показываем простое сообщение
  if (!currentUser) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="rounded-xl border bg-white p-6 text-sm">
          <h1 className="mb-2 text-lg font-semibold text-slate-900">
            Профиль недоступен
          </h1>
          <p className="text-slate-700">
            Войдите в систему как пациент или специалист, чтобы просматривать профиль.
          </p>
        </div>
      </main>
    );
  }

  // Локальное состояние для редактируемого поля e-mail
  const [email, setEmail] = useState(currentUser.email);
  // Локальное состояние для текстовой ошибки (если e-mail не заполнен)
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
      const updated = await apiUpdateUser(currentUser.id, email.trim());
      onUpdateUser(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при сохранении');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      {/* Карточка с данными профиля и формой изменения части полей */}
      <div className="rounded-xl border bg-white p-6 text-sm">
        <h1 className="mb-4 text-lg font-semibold text-slate-900">Профиль</h1>
        <p className="mb-4 text-xs text-slate-500">
          Имя, фамилия и телефон в этой версии не изменяются. Можно обновить только
          e-mail.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            {/* Блок с неизменяемой информацией о пользователе */}
            <div>
              <label className="mb-1 block text-xs text-slate-600">Имя</label>
              <div className="rounded-md border bg-slate-50 px-3 py-2 text-sm text-slate-800">
                {currentUser.firstName ?? '—'}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-600">Фамилия</label>
              <div className="rounded-md border bg-slate-50 px-3 py-2 text-sm text-slate-800">
                {currentUser.lastName ?? '—'}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-600">Телефон</label>
              <div className="rounded-md border bg-slate-50 px-3 py-2 text-sm text-slate-800">
                {currentUser.phone ?? '—'}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-600">Роль</label>
              <div className="rounded-md border bg-slate-50 px-3 py-2 text-sm text-slate-800">
                {currentUser.role === 'user' ? 'Пациент' : 'Специалист'}
              </div>
            </div>
          </div>

          {/* Поле для редактируемого e-mail пользователя */}
          <div>
            <label className="mb-1 block text-xs text-slate-600">
              E-mail <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-sky-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {/* Если есть ошибка — показываем её под полем */}
          {error && (
            <p className="text-xs text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!email.trim() || isLoading}
            className="mt-1 w-full rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
          >
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
    date: string;
    time: string;
    lastName: string;
    firstName: string;
    phone?: string;
  }) => Promise<void>;
}> = ({ currentUser, slots, slotsLoading, slotsError, onCreateBooking }) => {
  const navigate = useNavigate();

  // Даты, на которые у специалиста spec1 есть слоты (для выбора при записи)
  const availableDates = useMemo(() => {
    const dates = new Set(
      slots.filter((s) => s.specialistId === 'spec1').map((s) => s.date)
    );
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

  // Если список дат обновился и выбранной даты в нём нет — выбираем первую доступную
  useEffect(() => {
    if (availableDates.length > 0 && !availableDates.includes(selectedDate)) {
      setSelectedDate(availableDates[0]);
      setSelectedTime(null);
    }
  }, [availableDates]);

  // Если пользователь не авторизован как пациент — показываем подсказку
  if (!currentUser || currentUser.role !== 'user') {
    return (
      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="rounded-xl border bg-white p-6 text-sm">
          <h1 className="mb-2 text-lg font-semibold text-slate-900">
            Запись доступна только авторизованным пациентам
          </h1>
          <p className="text-slate-700">
            Пожалуйста, войдите в систему как пациент, чтобы выбрать время приёма.
          </p>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="mt-4 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
          >
            Войти
          </button>
        </div>
      </main>
    );
  }

  // Фильтруем слоты только для выбранной даты и специалиста spec1
  const dateSlots = useMemo(
    () =>
      slots.filter(
        (s) => s.date === selectedDate && s.specialistId === 'spec1'
      ),
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
    <main className="mx-auto max-w-3xl px-4 py-6">
      {/* Карточка выбора даты и времени */}
      <section className="mb-4 rounded-xl border bg-white p-4">
        <h1 className="mb-3 text-lg font-semibold text-slate-900">
          Запись на приём
        </h1>

        {/* Состояние загрузки слотов */}
        {slotsLoading && (
          <div className="mb-3 rounded-md border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-700">
            Загрузка доступного времени...
          </div>
        )}
        {slotsError && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {slotsError}
          </div>
        )}

        {/* Выбор даты из тех, на которые специалист принимает */}
        <div className="mb-3 text-sm">
          <label className="mb-1 block text-xs text-slate-600">Дата</label>
          <select
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-sky-500"
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

        {/* Сетка слотов */}
        <div className="mb-1 text-xs text-slate-600">Время</div>
        {!slotsLoading && dateSlots.length === 0 && !slotsError && (
          <p className="mb-2 text-xs text-slate-500">Нет доступных слотов на выбранную дату.</p>
        )}
        <div className="grid grid-cols-3 gap-2 text-xs">
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
                  'rounded-md border px-2 py-1',
                  isBusy
                    ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                    : isSelected
                    ? 'border-sky-600 bg-sky-50 text-sky-700'
                    : 'border-slate-200 text-slate-700 hover:border-sky-500'
                ].join(' ')}
              >
                <div>{slot.time}</div>
                <div className="text-[10px]">
                  {isBusy ? 'Занято' : 'Свободно'}
                </div>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          Другие пациенты не видят ваши данные — только статус «Свободно» или
          «Занято».
        </p>
      </section>

      {/* Форма ввода данных пациента и подтверждения */}
      <section className="rounded-xl border bg-white p-4 text-sm">
        <h2 className="mb-2 text-base font-semibold text-slate-900">
          Данные пациента
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-slate-600">Имя</label>
              <input
                type="text"
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-sky-500"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs text-slate-600">Фамилия</label>
              <input
                type="text"
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-sky-500"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-600">Телефон</label>
            <input
              type="tel"
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-sky-500"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          {/* Чекбокс подтверждения возраста 18+ */}
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={over18}
              onChange={(e) => setOver18(e.target.checked)}
            />
            <span>Мне уже исполнилось 18 лет</span>
          </label>

          <button
            type="submit"
            disabled={!selectedTime || !over18 || submitLoading}
            className="mt-1 w-full rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
          >
            {submitLoading ? 'Отправка...' : 'Подтвердить запись'}
          </button>
          {submitError && (
            <p className="mt-2 text-xs text-red-600">{submitError}</p>
          )}
        </form>
      </section>
    </main>
  );
};

// Страница подтверждения записи
const BookingSuccessPage: React.FC = () => {
  return (
    <main className="mx-auto max-w-md px-4 py-8">
      {/* Карточка с сообщением об успешной записи */}
      <div className="rounded-xl border bg-white p-6 text-sm shadow-sm">
        <h1 className="mb-2 text-lg font-semibold text-slate-900">
          Вы успешно записаны
        </h1>
        <p className="text-slate-700">
          Сохраните ссылку для отмены записи, если планы изменятся. Специалист
          получит уведомление о вашей записи.
        </p>
        <div className="mt-4 rounded-md bg-slate-50 p-3 text-xs text-slate-600">
          <p className="mb-1 font-semibold text-slate-800">
            Ссылка для отмены (пример):
          </p>
          <code className="block break-all text-[11px] text-slate-700">
            https://example.com/cancel?token=demo-token
          </code>
        </div>
        <Link
          to="/"
          className="mt-4 inline-flex rounded-md bg-sky-600 px-4 py-2 text-xs font-medium text-white hover:bg-sky-700"
        >
          На главную
        </Link>
      </div>
    </main>
  );
};

// Страница отмены записи по ссылке
const CancelBookingPage: React.FC = () => {
  return (
    <main className="mx-auto max-w-md px-4 py-8">
      {/* Карточка с подтверждением отмены (в этой версии без реального поиска записи) */}
      <div className="rounded-xl border bg-white p-6 text-sm shadow-sm">
        <h1 className="mb-2 text-lg font-semibold text-slate-900">
          Отмена записи
        </h1>
        <p className="text-slate-700">
          В этой демо-версии отмена записи не изменяет реальные данные, но показывает
          структуру страницы.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          В рабочей версии по токену из ссылки будет находиться запись, её статус станет
          «отменён», а специалисту отправится уведомление.
        </p>
        <Link
          to="/"
          className="mt-4 inline-flex rounded-md bg-sky-600 px-4 py-2 text-xs font-medium text-white hover:bg-sky-700"
        >
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
}> = ({ currentUser, bookings, isLoading, error }) => {
  // Фильтруем только активные записи текущего пациента
  const userBookings = useMemo(
    () =>
      bookings.filter(
        (b) => b.status === 'active' && b.userId === currentUser?.id
      ),
    [bookings, currentUser]
  );

  if (!currentUser || currentUser.role !== 'user') {
    return (
      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="rounded-xl border bg-white p-6 text-sm">
          <h1 className="mb-2 text-lg font-semibold text-slate-900">
            Раздел доступен только пациентам
          </h1>
          <p className="text-slate-700">
            Войдите как пациент, чтобы просмотреть ваши записи.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      {/* Карточка со списком записей пациента */}
      <div className="rounded-xl border bg-white p-6 text-sm">
        <h1 className="mb-4 text-lg font-semibold text-slate-900">Мои записи</h1>
        {/* Если идёт «загрузка» — показываем заглушку с индикатором */}
        {isLoading && (
          <div className="rounded-md border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-700">
            Загрузка списка записей...
          </div>
        )}

        {/* Если произошла «ошибка» — показываем сообщение об ошибке */}
        {!isLoading && error && (
          <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        {/* Если нет загрузки и ошибки — показываем реальный список записей */}
        {!isLoading && !error && (
          <>
            {userBookings.length === 0 && (
              <p className="text-slate-600">У вас пока нет активных записей.</p>
            )}
            <ul className="space-y-2">
              {userBookings.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <span className="text-xs text-slate-700">
                    {new Date(b.date).toLocaleDateString('ru-RU')}, {b.time}
                  </span>
                  <span className="text-[11px] text-slate-500">Статус: активна</span>
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
  // Минимальная дата для выбора — сегодня (формат YYYY-MM-DD для input type="date")
  const today = useMemo(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }, []);

  // Список дат, по которым у специалиста уже есть слоты (для выбора в «Записать пациента»)
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
  // Время одного нового слота
  const [newSlotTime, setNewSlotTime] = useState('');
  // Диапазон для добавления нескольких слотов (часы приёма)
  const [batchStartTime, setBatchStartTime] = useState('');
  const [batchEndTime, setBatchEndTime] = useState('');
  const [batchStepMin, setBatchStepMin] = useState(30);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Поддерживаем выбранную дату в списке доступных (для блока «Записать пациента»)
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
      <main className="mx-auto max-w-4xl px-4 py-6">
        <div className="rounded-xl border bg-white p-6 text-sm">
          <h1 className="mb-2 text-lg font-semibold text-slate-900">
            Раздел доступен только специалистам
          </h1>
          <p className="text-slate-700">
            Войдите как специалист, чтобы просмотреть своё расписание.
          </p>
        </div>
      </main>
    );
  }

  // Фильтр записей только текущего специалиста
  const specialistBookings = useMemo(
    () =>
      bookings.filter(
        (b) => b.specialistId === currentUser.id && b.status === 'active'
      ),
    [bookings, currentUser]
  );

  // Свободные слоты для формы ручной записи
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
    <main className="mx-auto max-w-5xl px-4 py-6">
      {slotsError && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {slotsError}
        </div>
      )}
      {bookingsError && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {bookingsError}
        </div>
      )}
      {actionError && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {actionError}
        </div>
      )}
      {/* Верхний блок с таблицей записей */}
      <section className="mb-4 rounded-xl border bg-white p-4 text-sm">
        <h1 className="mb-3 text-lg font-semibold text-slate-900">
          Расписание записей
        </h1>
        {bookingsLoading && (
          <p className="text-xs text-sky-700">Загрузка записей...</p>
        )}
        {!bookingsLoading && specialistBookings.length === 0 ? (
          <p className="text-slate-600">
            На выбранный период у вас пока нет записей.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead>
                <tr className="border-b bg-slate-50 text-[11px] uppercase text-slate-500">
                  <th className="px-3 py-2">Дата</th>
                  <th className="px-3 py-2">Время</th>
                  <th className="px-3 py-2">Фамилия</th>
                  <th className="px-3 py-2">Имя</th>
                  <th className="px-3 py-2">Телефон</th>
                </tr>
              </thead>
              <tbody>
                {specialistBookings.map((b) => (
                  <tr key={b.id} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      {new Date(b.date).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="px-3 py-2">{b.time}</td>
                    <td className="px-3 py-2">{b.lastName}</td>
                    <td className="px-3 py-2">{b.firstName}</td>
                    <td className="px-3 py-2">{b.phone ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Блок настройки собственного расписания: добавление дат и часов приёма */}
      <section className="mb-4 rounded-xl border bg-white p-4 text-sm">
        <h2 className="mb-3 text-base font-semibold text-slate-900">
          Настройка расписания приёма
        </h2>
        <p className="mb-3 text-xs text-slate-600">
          Выберите дату и добавьте один слот или несколько слотов подряд (диапазон времени).
        </p>

        {/* Выбор даты для добавления слотов — любая дата начиная с сегодня */}
        <div className="mb-3">
          <label className="mb-1 block text-xs text-slate-600">Дата для записи</label>
          <input
            type="date"
            className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-sky-500"
            value={selectedDate}
            min={today}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setSelectedTime(null);
            }}
          />
        </div>

        {/* Добавление одного слота (один час) */}
        <form onSubmit={handleCreateSlot} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-slate-600">
              Добавить один час приёма
            </label>
            <div className="flex gap-2">
              <input
                type="time"
                className="flex-1 rounded-md border px-3 py-2 text-sm outline-none focus:border-sky-500"
                value={newSlotTime}
                onChange={(e) => setNewSlotTime(e.target.value)}
              />
              <button
                type="submit"
                disabled={!newSlotTime || actionLoading}
                className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
              >
                Добавить слот
              </button>
            </div>
          </div>
        </form>

        {/* Добавление нескольких слотов подряд (диапазон часов) */}
        <form onSubmit={handleCreateSlotsBatch} className="mt-4 space-y-3 rounded-md border border-slate-100 bg-slate-50/50 p-3">
          <h3 className="text-xs font-semibold uppercase text-slate-500">
            Добавить несколько часов подряд
          </h3>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[100px]">
              <label className="mb-1 block text-xs text-slate-600">С</label>
              <input
                type="time"
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-sky-500"
                value={batchStartTime}
                onChange={(e) => setBatchStartTime(e.target.value)}
              />
            </div>
            <div className="min-w-[100px]">
              <label className="mb-1 block text-xs text-slate-600">До</label>
              <input
                type="time"
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-sky-500"
                value={batchEndTime}
                onChange={(e) => setBatchEndTime(e.target.value)}
              />
            </div>
            <div className="min-w-[80px]">
              <label className="mb-1 block text-xs text-slate-600">Шаг (мин)</label>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-sky-500"
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
              className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
            >
              Добавить слоты
            </button>
          </div>
        </form>

        {/* Список свободных слотов */}
        <div className="mt-4">
          <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">
            Свободные слоты на выбранную дату
          </h3>
          {slotsLoading && <p className="text-xs text-sky-700">Загрузка слотов...</p>}
          {!slotsLoading && dateSlots.length === 0 ? (
            <p className="text-xs text-slate-600">
              На выбранную дату свободные слоты не заданы. Добавьте время, когда вы готовы
              принимать.
            </p>
          ) : (
            <ul className="space-y-1 text-xs">
              {dateSlots.map((slot) => (
                <li
                  key={slot.id}
                  className="flex items-center justify-between rounded-md border px-3 py-1.5"
                >
                  <span className="text-slate-800">{slot.time}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteSlot(slot.id)}
                    disabled={actionLoading}
                    className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Не принимаю в это время
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Блок: форма «Записать пациента» — даты берутся из уже добавленных слотов */}
      <section className="rounded-xl border bg-white p-4 text-sm">
        <h2 className="mb-3 text-base font-semibold text-slate-900">
          Записать пациента
        </h2>
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-slate-600">Дата</label>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-sky-500"
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
                  <option value="">Сначала добавьте даты и часы в расписании выше</option>
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
              <label className="mb-1 block text-xs text-slate-600">Свободные слоты</label>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-sky-500"
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

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-slate-600">Имя</label>
              <input
                type="text"
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-sky-500"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs text-slate-600">Фамилия</label>
              <input
                type="text"
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-sky-500"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-600">Телефон</label>
            <input
              type="tel"
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-sky-500"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={!selectedTime || availableDatesForSpecialist.length === 0 || actionLoading}
            className="w-full rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
          >
            {actionLoading ? 'Создание...' : 'Создать запись'}
          </button>
          <p className="mt-1 text-[11px] text-slate-400">
            Пациент не видит ФИО других пациентов — только статус свободного или занятого
            слота.
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
      <main className="mx-auto max-w-4xl px-4 py-6">
        <div className="rounded-xl border bg-white p-6 text-sm">
          <h1 className="mb-2 text-lg font-semibold text-slate-900">
            Раздел доступен только специалистам
          </h1>
          <p className="text-slate-700">
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
    <main className="mx-auto max-w-5xl px-4 py-6">
      {newsError && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {newsError}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}
      <section className="mb-4 rounded-xl border bg-white p-4 text-sm">
        <h1 className="mb-3 text-lg font-semibold text-slate-900">
          Управление новостями
        </h1>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-slate-600">Заголовок</label>
            <input
              type="text"
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-sky-500"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-600">
              Краткий текст (описание)
            </label>
            <textarea
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-sky-500"
              rows={3}
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-600">
              URL картинки (для прототипа)
            </label>
            <input
              type="text"
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-sky-500"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={!title || !imageUrl || isLoading}
            className="w-full rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
          >
            {isLoading ? 'Сохранение...' : editingId ? 'Сохранить изменения' : 'Добавить новость'}
          </button>
          <p className="mt-1 text-[11px] text-slate-400">
            В будущем здесь можно будет настроить автоматическую загрузку новостей (RSS,
            API) по темам ЛФК и здоровья детей.
          </p>
        </form>
      </section>

      <section className="rounded-xl border bg-white p-4 text-sm">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Текущие новости</h2>
        {newsLoading && (
          <p className="text-xs text-sky-700">Загрузка новостей...</p>
        )}
        {!newsLoading && (
        <div className="grid gap-4 md:grid-cols-3">
          {news.map((item) => (
            <div key={item.id} className="flex flex-col gap-2">
              {/* Карточка новости в виде превью */}
              <NewsCard item={item} />
              {/* Кнопка «Редактировать» для перехода в режим изменения новости */}
              <button
                type="button"
                onClick={() => {
                  setEditingId(item.id);
                  setTitle(item.title);
                  setExcerpt(item.excerpt);
                  setImageUrl(item.imageUrl);
                }}
                className="rounded-md border border-slate-200 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
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

// Корневой компонент App — хранит состояние, загружает данные через API
const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(loadCurrentUserFromStorage);
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
    setLoadingSlots(true);
    setErrorSlots(null);
    try {
      const specId = currentUser.role === 'specialist' ? currentUser.id : 'spec1';
      const data = await apiGetSlots(currentUser.id, specId);
      setSlots(Array.isArray(data) ? data : []);
    } catch (err) {
      setErrorSlots(err instanceof Error ? err.message : 'Не удалось загрузить слоты');
    } finally {
      setLoadingSlots(false);
    }
  }, [currentUser]);

  const fetchBookings = useCallback(async () => {
    if (!currentUser) return;
    setLoadingBookings(true);
    setErrorBookings(null);
    try {
      const params = currentUser.role === 'user' ? { userId: currentUser.id } : { specialistId: currentUser.id };
      const data = await apiGetBookings(currentUser.id, params);
      setBookings(Array.isArray(data) ? data : []);
    } catch (err) {
      setErrorBookings(err instanceof Error ? err.message : 'Не удалось загрузить записи');
    } finally {
      setLoadingBookings(false);
    }
  }, [currentUser]);

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

  useEffect(() => { saveCurrentUserToStorage(currentUser); }, [currentUser]);

  const handleLogout = () => setCurrentUser(null);

  const handleCreateBookingByUser = useCallback(async (payload: {
    slotId: string;
    date: string;
    time: string;
    lastName: string;
    firstName: string;
    phone?: string;
  }) => {
    if (!currentUser) return;
    await apiCreateBookingByPatient(currentUser.id, {
      specialistId: 'spec1',
      slotId: payload.slotId,
      firstName: payload.firstName,
      lastName: payload.lastName,
      phone: payload.phone
    });
    await fetchSlots();
    await fetchBookings();
  }, [currentUser, fetchSlots, fetchBookings]);

  const handleCreateBookingBySpecialist = useCallback(async (payload: {
    date: string;
    time: string;
    lastName: string;
    firstName: string;
    phone?: string;
  }) => {
    if (!currentUser) return;
    await apiCreateBookingBySpecialist(currentUser.id, {
      specialistId: currentUser.id,
      date: payload.date,
      time: payload.time,
      firstName: payload.firstName,
      lastName: payload.lastName,
      phone: payload.phone
    });
    await fetchSlots();
    await fetchBookings();
  }, [currentUser, fetchSlots, fetchBookings]);

  const handleAddNews = useCallback(async (payload: { title: string; excerpt: string; imageUrl: string }) => {
    if (!currentUser) return;
    const item = await apiAddNews(currentUser.id, payload);
    setNews((prev) => [item, ...prev]);
  }, [currentUser]);

  const handleUpdateNews = useCallback(async (payload: { id: string; title: string; excerpt: string; imageUrl: string }) => {
    if (!currentUser) return;
    const updated = await apiUpdateNews(currentUser.id, payload.id, payload);
    setNews((prev) => prev.map((n) => (n.id === payload.id ? updated : n)));
  }, [currentUser]);

  const handleCreateSlotBySpecialist = useCallback(async (payload: { date: string; time: string }) => {
    if (!currentUser) return;
    const slot = await apiCreateSlot(currentUser.id, {
      specialistId: currentUser.id,
      date: payload.date,
      time: payload.time
    });
    setSlots((prev) => [...prev, slot]);
  }, [currentUser]);

  const handleDeleteSlotBySpecialist = useCallback(async (slotId: string) => {
    if (!currentUser) return;
    await apiDeleteSlot(currentUser.id, slotId);
    setSlots((prev) => prev.filter((s) => s.id !== slotId));
  }, [currentUser]);

  const handleCreateSlotsBatchBySpecialist = useCallback(async (payload: { date: string; times: string[] }) => {
    if (!currentUser) return;
    const created = await apiCreateSlotsBatch(currentUser.id, {
      specialistId: currentUser.id,
      date: payload.date,
      times: payload.times
    });
    if (created.length > 0) setSlots((prev) => [...prev, ...created]);
  }, [currentUser]);

  return (
    // Базовый layout: шапка и область контента
    <div className="min-h-screen bg-slate-50">
      {/* Шапка с навигацией по ролям */}
      <Header currentUser={currentUser} onLogout={handleLogout} />

      {/* Область роутинга: разные страницы по URL */}
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
          path="/login"
          element={<AuthPage mode="login" onAuth={setCurrentUser} />}
        />
        <Route
          path="/register"
          element={<AuthPage mode="register" onAuth={setCurrentUser} />}
        />
        <Route
          path="/profile"
          element={
            <ProfilePage
              currentUser={currentUser}
              onUpdateUser={setCurrentUser}
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
    </div>
  );
};

export default App;

