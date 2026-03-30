// App.tsx — корневой компонент приложения: навигация, страницы и базовая логика
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
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
  apiGetSpecialists,
  apiGetHomeContent,
  apiAddNews,
  apiUpdateHomeContent,
  apiUpdateNews,
  apiDeleteNews,
  apiUpdateUser,
  apiRequestTelegramLink,
} from './api';
import { useClerkAuth, RoleSelectForm } from './ClerkAuth';
import type { Booking, HomeContent, NewsItem, SpecialistInfo, TimeSlot, User } from './mockData';

// Этот блок создаётся, чтобы иметь дефолтные тексты главной страницы
// до загрузки данных с бэкенда или при временной ошибке API.
const DEFAULT_HOME_CONTENT: HomeContent = {
  heroBadge: '🌿 Лечебная физкультура для детей',
  heroTitle: 'Здоровье и радость движения для вашего ребёнка',
  heroSubtitle:
    'Индивидуальные занятия ЛФК с опытным специалистом. Коррекция осанки, укрепление мышечного корсета и профилактика травм.',
  heroCtaNote: 'Онлайн-запись на приём с выбором даты и времени.',
  primaryCtaText: 'Записаться на приём',
  secondaryCtaText: 'Войти',
  feature1Icon: '🏃',
  feature1Title: 'Индивидуальный подход',
  feature1Text: 'Программа упражнений под каждого ребёнка',
  feature2Icon: '📅',
  feature2Title: 'Удобная запись',
  feature2Text: 'Выбирайте время прямо на сайте',
  benefit1Icon: '💪',
  benefit1Title: 'Укрепление здоровья',
  benefit1Text:
    'Коррекция осанки и укрепление мышечного корсета под руководством специалиста',
  benefit2Icon: '🎯',
  benefit2Title: 'Индивидуальный план',
  benefit2Text:
    'Подбор упражнений с учётом возраста, здоровья и рекомендаций врача',
  benefit3Icon: '😊',
  benefit3Title: 'Позитивная атмосфера',
  benefit3Text:
    'Занятия в игровой форме, чтобы ребёнку было интересно и весело',
  newsIcon: '📰',
  newsTitle: 'Новости и статьи',
  newsSubtitle: 'ЛФК и здоровье детей',
  specialistIcon: '⚕️',
  specialistTitle: 'О специалисте',
  specialistText:
    'Специалист по лечебной физкультуре с опытом работы более 10 лет. Индивидуальный подбор упражнений с учётом возраста, состояния здоровья и рекомендаций врача. Работа с детьми от 3 лет.',
};

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

// Компонент карточки новости — предпросмотр с обрезкой текста, клик открывает полную новость
const NewsCard: React.FC<{ item: NewsItem; onClick?: () => void }> = ({ item, onClick }) => {
  return (
    <article
      className="card group flex cursor-pointer flex-col overflow-hidden !p-0 transition-shadow hover:shadow-lg"
      onClick={onClick}
    >
      {/* Изображение новости с плавным зумом при наведении */}
      <div className="h-44 w-full overflow-hidden">
        <img
          src={item.imageUrl}
          alt={item.title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>
      {/* Текстовая часть с обрезкой: заголовок — 3 строки, описание — 5 строк */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-3 text-sm font-bold text-gray-800">{item.title}</h3>
        <p className="line-clamp-5 text-xs leading-relaxed text-gray-500">{item.excerpt}</p>
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

// Страница полной новости — открывается при клике на карточку
const NewsDetailPage: React.FC<{ news: NewsItem[] }> = ({ news }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const item = news.find((n) => n.id === id);

  if (!item) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="card text-center">
          <span className="mb-3 inline-block text-4xl">📭</span>
          <h1 className="mb-2 text-lg font-bold text-gray-800">Новость не найдена</h1>
          <button onClick={() => navigate('/')} className="btn-primary mt-4">На главную</button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 flex items-center gap-1 text-sm font-semibold text-mint-600 transition-colors hover:text-mint-700"
      >
        ← Назад
      </button>
      <article className="card overflow-hidden !p-0">
        <img
          src={item.imageUrl}
          alt={item.title}
          className="h-64 w-full object-cover md:h-80"
        />
        <div className="p-6">
          <div className="mb-3 flex items-center gap-3 text-xs text-gray-400">
            <span>{new Date(item.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            {item.source && (
              <span className="rounded-full bg-mint-50 px-2 py-0.5 text-mint-600">
                {item.source === 'manual' ? 'Вручную' : 'Авто'}
              </span>
            )}
          </div>
          <h1 className="mb-4 text-xl font-extrabold text-gray-800">{item.title}</h1>
          <p className="whitespace-pre-line text-sm leading-relaxed text-gray-600">{item.excerpt}</p>
        </div>
      </article>
    </main>
  );
};

// Главная страница — hero-блок с иллюстрацией, блок новостей, информация о специалисте
const HomePage: React.FC<{
  currentUser: User | null;
  homeContent: HomeContent;
  news: NewsItem[];
  newsLoading?: boolean;
  newsError?: string | null;
}> = ({ currentUser, homeContent, news, newsLoading, newsError }) => {
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
            {homeContent.heroBadge}
          </div>
          <h1 className="mb-3 text-3xl font-extrabold leading-tight text-gray-800 md:text-4xl">
            {homeContent.heroTitle}
          </h1>
          <p className="mb-2 text-sm leading-relaxed text-gray-600">
            {homeContent.heroSubtitle}
          </p>
          <p className="mb-5 text-xs text-gray-400">
            {homeContent.heroCtaNote}
          </p>

          {/* CTA-кнопки для неавторизованных гостей */}
          {!currentUser && (
            <div className="flex gap-3">
              <button type="button" onClick={handlePrimaryCta} className="btn-primary text-base">
                {homeContent.primaryCtaText}
              </button>
              <a href="/login" className="btn-secondary">
                {homeContent.secondaryCtaText}
              </a>
            </div>
          )}
        </div>

        {/* Информационная колонка справа */}
        <div className="relative mt-6 flex-shrink-0 md:mt-0 md:ml-8 md:text-right">
          <div className="inline-flex flex-col items-end gap-3">
            <div className="rounded-2xl bg-white/80 p-4 shadow-soft backdrop-blur-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-coral-500">
                {homeContent.feature1Icon} {homeContent.feature1Title}
              </p>
              <p className="mt-1 text-sm text-gray-600">
                {homeContent.feature1Text}
              </p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4 shadow-soft backdrop-blur-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-mint-600">
                {homeContent.feature2Icon} {homeContent.feature2Title}
              </p>
              <p className="mt-1 text-sm text-gray-600">
                {homeContent.feature2Text}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Блок преимуществ */}
      <section className="mb-10 grid gap-4 md:grid-cols-3">
        <div className="card flex items-start gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-mint-100 text-xl">{homeContent.benefit1Icon}</span>
          <div>
            <h3 className="text-sm font-bold text-gray-800">{homeContent.benefit1Title}</h3>
            <p className="mt-1 text-xs text-gray-500">{homeContent.benefit1Text}</p>
          </div>
        </div>
        <div className="card flex items-start gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-coral-100 text-xl">{homeContent.benefit2Icon}</span>
          <div>
            <h3 className="text-sm font-bold text-gray-800">{homeContent.benefit2Title}</h3>
            <p className="mt-1 text-xs text-gray-500">{homeContent.benefit2Text}</p>
          </div>
        </div>
        <div className="card flex items-start gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-warm-100 text-xl">{homeContent.benefit3Icon}</span>
          <div>
            <h3 className="text-sm font-bold text-gray-800">{homeContent.benefit3Title}</h3>
            <p className="mt-1 text-xs text-gray-500">{homeContent.benefit3Text}</p>
          </div>
        </div>
      </section>

      {/* Блок «О специалисте» */}
      <section className="card mb-10 border-mint-100 bg-gradient-to-r from-mint-50 to-white">
        <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-mint-100 text-2xl">
            {homeContent.specialistIcon}
          </span>
          <div>
            <h3 className="mb-2 text-base font-bold text-gray-800">{homeContent.specialistTitle}</h3>
            <p className="text-sm leading-relaxed text-gray-600">
              {homeContent.specialistText}
            </p>
          </div>
        </div>
      </section>

      {/* Блок новостей */}
      <section className="mb-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-extrabold text-gray-800">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-mint-100 text-base">{homeContent.newsIcon}</span>
            {homeContent.newsTitle}
          </h2>
          <span className="rounded-full bg-mint-50 px-3 py-1 text-xs font-semibold text-mint-600">
            {homeContent.newsSubtitle}
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
              <NewsCard key={item.id} item={item} onClick={() => navigate(`/news/${item.id}`)} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
};

/**
 * Этот блок создаётся, чтобы из ссылки вида https://t.me/bot?start=link_… получить:
 * - URI tg:// для открытия бота в приложении Telegram (без захода на t.me в браузере);
 * - текст команды /start … для ручного ввода, если браузер или сеть блокируют t.me.
 */
function parseTelegramWebLink(url: string): { appUrl: string; startCommand: string; botUsername: string } | null {
  try {
    const u = new URL(url);
    if (u.hostname !== 't.me' && u.hostname !== 'telegram.me') return null;
    const botUsername = u.pathname.replace(/^\//, '').split('/')[0];
    const start = (u.searchParams.get('start') || '').trim();
    if (!botUsername || !start.startsWith('link_')) return null;
    const appUrl = `tg://resolve?domain=${encodeURIComponent(botUsername)}&start=${encodeURIComponent(start)}`;
    const startCommand = `/start ${start}`;
    return { appUrl, startCommand, botUsername };
  } catch {
    return null;
  }
}

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
  // Телефон инициализируется из профиля или с +7 по умолчанию
  const [phone, setPhone] = useState(currentUser.phone || '+7');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // Состояние блока привязки Telegram для специалиста: ссылка из API и отдельные ошибки/загрузка
  const [tgLinkUrl, setTgLinkUrl] = useState<string | null>(null);
  // Режим ссылки с бэкенда: database — токен только в БД этого API; signed — подпись, одинаковая на всех репликах.
  const [tgLinkMode, setTgLinkMode] = useState<'signed' | 'database' | null>(null);
  const [tgError, setTgError] = useState<string | null>(null);
  const [tgLoading, setTgLoading] = useState(false);
  // Этот блок создаётся, чтобы один раз разобрать ссылку t.me и показать обход блокировки в браузере.
  const tgParsed = useMemo(() => (tgLinkUrl ? parseTelegramWebLink(tgLinkUrl) : null), [tgLinkUrl]);

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

  const handleRequestTelegramLink = async () => {
    setTgError(null);
    setTgLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Нет токена авторизации');
      const data = await apiRequestTelegramLink(token);
      setTgLinkUrl(data.url);
      setTgLinkMode(data.linkMode === 'database' || data.linkMode === 'signed' ? data.linkMode : null);
    } catch (err) {
      setTgError(err instanceof Error ? err.message : 'Не удалось получить ссылку');
    } finally {
      setTgLoading(false);
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
            {/* Телефон — +7 зафиксирован, пользователь вводит только 10 цифр после кода */}
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

        {/* Блок для специалиста: подключение Telegram, чтобы получать оповещения о новых записях */}
        {currentUser.role === 'specialist' && (
          <div className="mt-6 border-t border-mint-100 pt-6">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-lg">📲</span>
              <h2 className="text-sm font-bold text-gray-800">Уведомления в Telegram</h2>
            </div>
            <p className="mb-3 text-xs text-gray-500">
              Получайте ФИО пациента, телефон, дату и время сразу после записи с сайта или через бота.
            </p>
            <div className="mb-3 rounded-xl border border-gray-100 bg-mint-50/50 px-3 py-2 text-xs font-semibold text-mint-800">
              Статус:{' '}
              {currentUser.telegramLinked ? 'подключено' : 'не подключено'}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                className="btn-primary text-sm"
                disabled={tgLoading}
                onClick={handleRequestTelegramLink}
              >
                {tgLoading ? 'Загрузка…' : 'Получить ссылку для Telegram'}
              </button>
              <button
                type="button"
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                onClick={() => onUpdateUser()}
              >
                Обновить статус
              </button>
            </div>
            {tgLinkUrl && (
              <div className="mt-3 rounded-xl border border-mint-200 bg-white p-3 text-xs">
                <p className="mb-2 font-semibold text-gray-700">Откройте ссылку в Telegram (действует ~30 минут):</p>
                <a
                  href={tgLinkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-mint-700 underline"
                >
                  {tgLinkUrl}
                </a>
                {/* Блок создаётся, чтобы предупредить: hex-токен в ссылке существует только в БД того API, куда ходит сайт — бот должен звать тот же URL. */}
                {tgLinkMode === 'database' && (
                  <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50/80 px-2 py-2 text-[11px] leading-relaxed text-amber-950">
                    Ссылка с длинным кодом из букв и цифр (32 символа после link_) записана в базу{' '}
                    <strong>этого</strong> сервера. Процесс Telegram-бота обязан вызывать{' '}
                    <strong>тот же</strong> адрес API, что и сайт (в <code className="rounded bg-white/80 px-0.5">telegram-bot/.env</code>{' '}
                    — <code className="rounded bg-white/80 px-0.5">API_BASE_URL</code>, не localhost, если сайт на хостинге), и тот же{' '}
                    <code className="rounded bg-white/80 px-0.5">TELEGRAM_BOT_API_SECRET</code>, что у бэкенда. Иначе в чате бота будет
                    «ссылка недействительна». На бэкенде задайте <code className="rounded bg-white/80 px-0.5">TELEGRAM_BOT_API_SECRET</code>{' '}
                    — тогда новые ссылки станут короче (подпись) и не зависят от реплик БД.
                  </p>
                )}
                {/* Блок создаётся, чтобы объяснить ERR_CONNECTION_RESET на t.me и дать обход без браузера. */}
                <p className="mt-3 rounded-lg bg-amber-50 px-2 py-2 text-[11px] leading-relaxed text-amber-900">
                  Если в браузере появляется «соединение сброшено» или сайт t.me не открывается — это часто
                  блокировка или фильтрация сети, а не ошибка сайта ЛФК. Ссылка уже сформирована верно (см. запрос
                  telegram-link в инструментах разработчика).
                </p>
                {tgParsed && (
                  <div className="mt-3 space-y-2 border-t border-mint-100 pt-3 text-[11px] text-gray-600">
                    <p className="font-semibold text-gray-700">Как подключить без браузера:</p>
                    <p>
                      <a
                        href={tgParsed.appUrl}
                        className="font-semibold text-mint-700 underline"
                      >
                        Открыть в приложении Telegram
                      </a>{' '}
                      (если Telegram установлен на этом устройстве).
                    </p>
                    <p>
                      Или в Telegram найдите бота{' '}
                      <span className="font-mono font-semibold text-gray-800">@{tgParsed.botUsername}</span> и
                      отправьте в чат одной строкой:
                    </p>
                    <code className="block break-all rounded bg-gray-100 px-2 py-1.5 text-[10px] text-gray-800">
                      {tgParsed.startCommand}
                    </code>
                  </div>
                )}
              </div>
            )}
            {tgError && (
              <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{tgError}</p>
            )}
          </div>
        )}
      </div>
    </main>
  );
};

// Карточка специалиста — отображается на шаге выбора специалиста перед записью
const SpecialistCard: React.FC<{
  specialist: SpecialistInfo;
  freeSlotCount: number;
  isSelected: boolean;
  onClick: () => void;
}> = ({ specialist, freeSlotCount, isSelected, onClick }) => {
  const displayName = [specialist.lastName, specialist.firstName].filter(Boolean).join(' ') || 'Специалист';
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'card group flex flex-col items-center gap-3 !p-5 text-center transition-all',
        isSelected
          ? 'border-2 border-mint-500 bg-mint-50/50 shadow-md'
          : 'border-2 border-transparent hover:border-mint-200 hover:shadow-md',
      ].join(' ')}
    >
      {/* Аватар специалиста */}
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-mint-100 text-2xl transition-transform group-hover:scale-105">
        ⚕️
      </span>
      <div>
        <h3 className="text-sm font-bold text-gray-800">{displayName}</h3>
        <p className="mt-0.5 text-xs text-gray-400">{specialist.email}</p>
      </div>
      {/* Счётчик свободных слотов */}
      <span className={[
        'rounded-full px-3 py-1 text-[11px] font-bold',
        freeSlotCount > 0
          ? 'bg-mint-100 text-mint-700'
          : 'bg-gray-100 text-gray-400',
      ].join(' ')}>
        {freeSlotCount > 0
          ? `${freeSlotCount} свободн. слот${freeSlotCount === 1 ? '' : freeSlotCount < 5 ? 'а' : 'ов'}`
          : 'Нет свободных слотов'}
      </span>
    </button>
  );
};

// Страница записи на приём для пациента — двухшаговая: выбор специалиста, затем дата/время
const BookingPage: React.FC<{
  currentUser: User | null;
  slots: TimeSlot[];
  specialists: SpecialistInfo[];
  specialistsLoading?: boolean;
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
}> = ({ currentUser, slots, specialists, specialistsLoading, slotsLoading, slotsError, onCreateBooking }) => {
  const navigate = useNavigate();

  // Шаг записи: 'specialist' — выбор специалиста, 'schedule' — выбор даты/времени
  const [selectedSpecialistId, setSelectedSpecialistId] = useState<string | null>(null);
  const [step, setStep] = useState<'specialist' | 'schedule'>('specialist');

  // Фильтрация: не показываем прошедшие даты и слоты с прошедшим временем
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const futureSlots = useMemo(() => {
    return slots.filter((s) => {
      if (s.date < todayStr) return false;
      if (s.date === todayStr) {
        const [h, m] = s.time.split(':').map(Number);
        if (h * 60 + m <= currentMinutes) return false;
      }
      return true;
    });
  }, [slots, todayStr, currentMinutes]);

  // Свободные слоты выбранного специалиста
  const specialistSlots = useMemo(
    () => futureSlots.filter((s) => s.specialistId === selectedSpecialistId),
    [futureSlots, selectedSpecialistId]
  );

  // Количество свободных слотов каждого специалиста — для отображения на карточках
  const freeCountBySpecialist = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of futureSlots) {
      if (s.status === 'free') {
        counts[s.specialistId] = (counts[s.specialistId] || 0) + 1;
      }
    }
    return counts;
  }, [futureSlots]);

  const availableDates = useMemo(() => {
    const dates = new Set(specialistSlots.map((s) => s.date));
    return Array.from(dates).sort();
  }, [specialistSlots]);

  const firstDate = availableDates[0] ?? '';

  const [selectedDate, setSelectedDate] = useState(firstDate);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [firstName, setFirstName] = useState(currentUser?.firstName ?? '');
  const [lastName, setLastName] = useState(currentUser?.lastName ?? '');
  // Телефон инициализируется из профиля или с +7 по умолчанию
  const [phone, setPhone] = useState(currentUser?.phone || '+7');
  const [over18, setOver18] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (availableDates.length > 0 && !availableDates.includes(selectedDate)) {
      setSelectedDate(availableDates[0]);
      setSelectedTime(null);
    }
  }, [availableDates]);

  // Автоматический выбор единственного специалиста, если он один
  useEffect(() => {
    if (specialists.length === 1 && !selectedSpecialistId) {
      setSelectedSpecialistId(specialists[0].id);
      setStep('schedule');
    }
  }, [specialists, selectedSpecialistId]);

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

  // Текущий выбранный специалист
  const selectedSpecialist = specialists.find((s) => s.id === selectedSpecialistId);
  const specialistDisplayName = selectedSpecialist
    ? [selectedSpecialist.lastName, selectedSpecialist.firstName].filter(Boolean).join(' ') || 'Специалист'
    : '';

  // Слоты на выбранную дату для выбранного специалиста
  const dateSlots = useMemo(
    () => specialistSlots.filter((s) => s.date === selectedDate),
    [specialistSlots, selectedDate]
  );

  const selectedSlot = dateSlots.find((s) => s.time === selectedTime);

  const handleSelectSpecialist = (specId: string) => {
    setSelectedSpecialistId(specId);
    setSelectedDate('');
    setSelectedTime(null);
    setStep('schedule');
  };

  const handleBackToSpecialists = () => {
    setStep('specialist');
    setSelectedSpecialistId(null);
    setSelectedDate('');
    setSelectedTime(null);
  };

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
    <main className="mx-auto max-w-4xl px-4 py-8">
      {/* Шаг 1: Выбор специалиста */}
      {step === 'specialist' && (
        <section className="card">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-mint-100 text-xl">⚕️</span>
            <div>
              <h1 className="text-lg font-bold text-gray-800">Выберите специалиста</h1>
              <p className="text-xs text-gray-400">Нажмите на карточку, чтобы увидеть расписание</p>
            </div>
          </div>

          {specialistsLoading && (
            <div className="rounded-xl bg-mint-50 px-4 py-2.5 text-xs font-semibold text-mint-700">
              Загрузка списка специалистов...
            </div>
          )}

          {!specialistsLoading && specialists.length === 0 && (
            <div className="py-6 text-center">
              <span className="mb-2 inline-block text-3xl">📭</span>
              <p className="text-sm text-gray-500">Специалисты ещё не зарегистрированы.</p>
            </div>
          )}

          {/* Сетка карточек специалистов */}
          {!specialistsLoading && specialists.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {specialists.map((spec) => (
                <SpecialistCard
                  key={spec.id}
                  specialist={spec}
                  freeSlotCount={freeCountBySpecialist[spec.id] || 0}
                  isSelected={selectedSpecialistId === spec.id}
                  onClick={() => handleSelectSpecialist(spec.id)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Шаг 2: Расписание выбранного специалиста */}
      {step === 'schedule' && selectedSpecialist && (
        <>
          {/* Кнопка «Назад» — возвращает к выбору специалиста (если их больше одного) */}
          {specialists.length > 1 && (
            <button
              type="button"
              onClick={handleBackToSpecialists}
              className="mb-4 flex items-center gap-1 text-sm font-semibold text-mint-600 transition-colors hover:text-mint-700"
            >
              ← К выбору специалиста
            </button>
          )}

          {/* Информация о выбранном специалисте */}
          <section className="card mb-5">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-mint-100 text-xl">📅</span>
              <div>
                <h1 className="text-lg font-bold text-gray-800">Запись на приём</h1>
                <p className="text-sm text-gray-500">
                  Специалист: <span className="font-semibold text-gray-700">{specialistDisplayName}</span>
                </p>
              </div>
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

              {/* Телефон — +7 зафиксирован, пользователь вводит только 10 цифр после кода */}
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
        </>
      )}
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

// Генерация вариантов времени для select-списков (24-часовой формат, шаг 30 мин)
const TIME_OPTIONS: string[] = (() => {
  const opts: string[] = [];
  for (let h = 8; h <= 20; h++) {
    for (const m of [0, 30]) {
      if (h === 20 && m === 30) break;
      opts.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return opts;
})();

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
  // Телефон начинается с +7 по умолчанию
  const [phone, setPhone] = useState('+7');
  const [newSlotTime, setNewSlotTime] = useState('');
  const [batchStartTime, setBatchStartTime] = useState('09:00');
  const [batchEndTime, setBatchEndTime] = useState('17:00');
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
      setPhone('+7');
      setSelectedTime(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Ошибка при создании записи');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSlotTime) {
      setActionError('Выберите время для добавления слота.');
      return;
    }
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
    if (!batchStartTime || !batchEndTime) {
      setActionError('Укажите начало и конец диапазона времени.');
      return;
    }
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
    if (start >= end) {
      setActionError('Время начала должно быть раньше времени окончания.');
      return;
    }
    const step = Math.max(1, batchStepMin);
    const times: string[] = [];
    for (let m = start; m < end; m += step) {
      times.push(fromMinutes(m));
    }
    if (times.length === 0) {
      setActionError('Не удалось сформировать слоты. Проверьте параметры.');
      return;
    }
    setActionError(null);
    setActionLoading(true);
    try {
      await onCreateSlotsBatch({ date: selectedDate, times });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Ошибка при добавлении слотов');
    } finally {
      setActionLoading(false);
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

        {/* Добавление одного слота — select с 24-часовым форматом */}
        <form onSubmit={handleCreateSlot} className="mb-4 space-y-3">
          <label className="mb-1.5 block text-xs font-semibold text-gray-600">
            Добавить один час приёма
          </label>
          <div className="flex gap-2">
            <select
              className="input-field flex-1"
              value={newSlotTime}
              onChange={(e) => setNewSlotTime(e.target.value)}
            >
              <option value="">— выберите время —</option>
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <button type="submit" disabled={!newSlotTime || actionLoading} className="btn-primary">
              Добавить слот
            </button>
          </div>
        </form>

        {/* Добавление нескольких слотов (диапазон) — select с 24-часовым форматом */}
        <form onSubmit={handleCreateSlotsBatch} className="rounded-2xl border border-mint-100 bg-mint-50/30 p-4">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">
            Добавить несколько часов подряд
          </h3>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[100px]">
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">С</label>
              <select
                className="input-field"
                value={batchStartTime}
                onChange={(e) => setBatchStartTime(e.target.value)}
              >
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="min-w-[100px]">
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">До</label>
              <select
                className="input-field"
                value={batchEndTime}
                onChange={(e) => setBatchEndTime(e.target.value)}
              >
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
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

          {/* Телефон — +7 зафиксирован, пользователь вводит только 10 цифр после кода */}
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
  homeContent: HomeContent;
  newsLoading?: boolean;
  newsError?: string | null;
  onAddNews: (payload: { title: string; excerpt: string; imageUrl: string }) => Promise<void>;
  onUpdateNews: (payload: { id: string; title: string; excerpt: string; imageUrl: string }) => Promise<void>;
  onDeleteNews: (newsId: string) => Promise<void>;
  onUpdateHomeContent: (payload: HomeContent) => Promise<void>;
}> = ({ currentUser, news, homeContent, newsLoading, newsError, onAddNews, onUpdateNews, onDeleteNews, onUpdateHomeContent }) => {
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Ref на форму новостей — для автопрокрутки при клике «Редактировать».
  const formRef = useRef<HTMLElement>(null);
  // Этот блок создаётся, чтобы редактировать все текстовые блоки главной страницы.
  const [homeForm, setHomeForm] = useState<HomeContent>(homeContent);
  const [homeLoading, setHomeLoading] = useState(false);
  const [homeError, setHomeError] = useState<string | null>(null);

  useEffect(() => {
    setHomeForm(homeContent);
  }, [homeContent]);

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

  const handleHomeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setHomeError(null);
    setHomeLoading(true);
    try {
      await onUpdateHomeContent(homeForm);
    } catch (err) {
      setHomeError(err instanceof Error ? err.message : 'Ошибка при сохранении главной страницы');
    } finally {
      setHomeLoading(false);
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
      <section ref={formRef} className="card mb-5">
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

      {/* Форма редактирования контента главной страницы */}
      <section className="card mb-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-warm-100 text-xl">🏠</span>
          <h2 className="text-base font-bold text-gray-800">Контент главной страницы</h2>
        </div>
        {homeError && (
          <div className="mb-3 rounded-xl bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-600">
            {homeError}
          </div>
        )}
        <form onSubmit={handleHomeSubmit} className="space-y-3">
          {/* Этот блок создаётся, чтобы специалист мог редактировать Hero-секцию главной страницы. */}
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">Кнопка 1 (основная)</label>
              <input className="input-field" value={homeForm.primaryCtaText} onChange={(e) => setHomeForm((p) => ({ ...p, primaryCtaText: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">Кнопка 2 (вторичная)</label>
              <input className="input-field" value={homeForm.secondaryCtaText} onChange={(e) => setHomeForm((p) => ({ ...p, secondaryCtaText: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">Hero: бейдж</label>
              <input className="input-field" value={homeForm.heroBadge} onChange={(e) => setHomeForm((p) => ({ ...p, heroBadge: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">Hero: заголовок</label>
              <input className="input-field" value={homeForm.heroTitle} onChange={(e) => setHomeForm((p) => ({ ...p, heroTitle: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">Hero: описание</label>
              <textarea className="input-field resize-none" rows={2} value={homeForm.heroSubtitle} onChange={(e) => setHomeForm((p) => ({ ...p, heroSubtitle: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">Hero: подпись под кнопкой</label>
              <input className="input-field" value={homeForm.heroCtaNote} onChange={(e) => setHomeForm((p) => ({ ...p, heroCtaNote: e.target.value }))} />
            </div>
          </div>

          {/* Этот блок создаётся, чтобы редактировать правые карточки Hero-блока. */}
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">Фича 1: иконка/эмодзи</label>
              <input className="input-field" value={homeForm.feature1Icon} onChange={(e) => setHomeForm((p) => ({ ...p, feature1Icon: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">Фича 1: заголовок</label>
              <input className="input-field" value={homeForm.feature1Title} onChange={(e) => setHomeForm((p) => ({ ...p, feature1Title: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">Фича 2: иконка/эмодзи</label>
              <input className="input-field" value={homeForm.feature2Icon} onChange={(e) => setHomeForm((p) => ({ ...p, feature2Icon: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">Фича 1: текст</label>
              <input className="input-field" value={homeForm.feature1Text} onChange={(e) => setHomeForm((p) => ({ ...p, feature1Text: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">Фича 2: заголовок</label>
              <input className="input-field" value={homeForm.feature2Title} onChange={(e) => setHomeForm((p) => ({ ...p, feature2Title: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">Фича 2: текст</label>
              <input className="input-field" value={homeForm.feature2Text} onChange={(e) => setHomeForm((p) => ({ ...p, feature2Text: e.target.value }))} />
            </div>
          </div>

          {/* Этот блок создаётся, чтобы редактировать карточки преимуществ. */}
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">Преимущество 1: иконка/эмодзи</label>
              <input className="input-field" value={homeForm.benefit1Icon} onChange={(e) => setHomeForm((p) => ({ ...p, benefit1Icon: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">Преимущество 1: заголовок</label>
              <input className="input-field" value={homeForm.benefit1Title} onChange={(e) => setHomeForm((p) => ({ ...p, benefit1Title: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">Преимущество 2: иконка/эмодзи</label>
              <input className="input-field" value={homeForm.benefit2Icon} onChange={(e) => setHomeForm((p) => ({ ...p, benefit2Icon: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">Преимущество 1: текст</label>
              <input className="input-field" value={homeForm.benefit1Text} onChange={(e) => setHomeForm((p) => ({ ...p, benefit1Text: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">Преимущество 3: иконка/эмодзи</label>
              <input className="input-field" value={homeForm.benefit3Icon} onChange={(e) => setHomeForm((p) => ({ ...p, benefit3Icon: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">Преимущество 2: заголовок</label>
              <input className="input-field" value={homeForm.benefit2Title} onChange={(e) => setHomeForm((p) => ({ ...p, benefit2Title: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">Преимущество 2: текст</label>
              <input className="input-field" value={homeForm.benefit2Text} onChange={(e) => setHomeForm((p) => ({ ...p, benefit2Text: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">Преимущество 3: заголовок</label>
              <input className="input-field" value={homeForm.benefit3Title} onChange={(e) => setHomeForm((p) => ({ ...p, benefit3Title: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">Преимущество 3: текст</label>
              <input className="input-field" value={homeForm.benefit3Text} onChange={(e) => setHomeForm((p) => ({ ...p, benefit3Text: e.target.value }))} />
            </div>
          </div>

          {/* Этот блок создаётся, чтобы редактировать заголовки новостей и раздел «О специалисте». */}
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">Новости: иконка/эмодзи</label>
              <input className="input-field" value={homeForm.newsIcon} onChange={(e) => setHomeForm((p) => ({ ...p, newsIcon: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">Новости: заголовок</label>
              <input className="input-field" value={homeForm.newsTitle} onChange={(e) => setHomeForm((p) => ({ ...p, newsTitle: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">О специалисте: иконка/эмодзи</label>
              <input className="input-field" value={homeForm.specialistIcon} onChange={(e) => setHomeForm((p) => ({ ...p, specialistIcon: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">Новости: подзаголовок</label>
              <input className="input-field" value={homeForm.newsSubtitle} onChange={(e) => setHomeForm((p) => ({ ...p, newsSubtitle: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">О специалисте: заголовок</label>
              <input className="input-field" value={homeForm.specialistTitle} onChange={(e) => setHomeForm((p) => ({ ...p, specialistTitle: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold text-gray-600">О специалисте: текст</label>
              <textarea className="input-field resize-none" rows={3} value={homeForm.specialistText} onChange={(e) => setHomeForm((p) => ({ ...p, specialistText: e.target.value }))} />
            </div>
          </div>
          <button type="submit" disabled={homeLoading} className="btn-primary w-full">
            {homeLoading ? 'Сохранение...' : 'Сохранить изменения главной страницы'}
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
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(item.id);
                      setTitle(item.title);
                      setExcerpt(item.excerpt);
                      setImageUrl(item.imageUrl);
                      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className="btn-secondary flex-1 text-xs"
                  >
                    Редактировать
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!window.confirm('Удалить эту новость?')) return;
                      try {
                        await onDeleteNews(item.id);
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Ошибка при удалении');
                      }
                    }}
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100"
                  >
                    Удалить
                  </button>
                </div>
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
  const [homeContent, setHomeContent] = useState<HomeContent>(DEFAULT_HOME_CONTENT);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  // Список специалистов — загружается для страницы записи пациента
  const [specialists, setSpecialists] = useState<SpecialistInfo[]>([]);
  const [loadingSpecialists, setLoadingSpecialists] = useState(false);
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

  const fetchHomeContent = useCallback(async () => {
    // Этот блок создаётся, чтобы загрузить редактируемый контент главной страницы из API.
    try {
      const data = await apiGetHomeContent();
      setHomeContent(data);
    } catch {
      setHomeContent(DEFAULT_HOME_CONTENT);
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

  // Загрузка списка специалистов для страницы записи пациента.
  // Если эндпоинт /users/specialists ещё не задеплоен, извлекаем специалистов из слотов.
  const fetchSpecialists = useCallback(async () => {
    if (!currentUser) return;
    const token = await getToken();
    if (!token) return;
    setLoadingSpecialists(true);
    try {
      const data = await apiGetSpecialists(token);
      if (Array.isArray(data) && data.length > 0) {
        setSpecialists(data);
        setLoadingSpecialists(false);
        return;
      }
    } catch {
      // эндпоинт ещё не задеплоен — fallback ниже
    }
    // Fallback: извлекаем уникальных специалистов из уже загруженных слотов
    const seen = new Map<string, SpecialistInfo>();
    for (const s of slots) {
      if (!seen.has(s.specialistId)) {
        seen.set(s.specialistId, {
          id: s.specialistId,
          firstName: s.specialistFirstName ?? null,
          lastName: s.specialistLastName ?? null,
          email: '',
        });
      }
    }
    setSpecialists(Array.from(seen.values()));
    setLoadingSpecialists(false);
  }, [currentUser, getToken, slots]);

  useEffect(() => {
    fetchNews();
    fetchHomeContent();
  }, [fetchNews, fetchHomeContent]);

  useEffect(() => {
    if (currentUser) {
      fetchSlots();
      fetchBookings();
    } else {
      setSlots([]);
      setBookings([]);
      setSpecialists([]);
      setLoadingSlots(false);
      setLoadingBookings(false);
      setLoadingSpecialists(false);
      setErrorSlots(null);
      setErrorBookings(null);
    }
  }, [currentUser, fetchSlots, fetchBookings]);

  // Загрузка специалистов запускается после загрузки слотов, чтобы fallback мог
  // извлечь список специалистов из слотов, если API-эндпоинт ещё не задеплоен.
  useEffect(() => {
    if (currentUser && !loadingSlots) {
      fetchSpecialists();
    }
  }, [currentUser, loadingSlots, fetchSpecialists]);

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

  const handleDeleteNews = useCallback(async (newsId: string) => {
    if (!currentUser) return;
    const token = await getToken();
    if (!token) return;
    await apiDeleteNews(token, newsId);
    setNews((prev) => prev.filter((n) => n.id !== newsId));
  }, [currentUser, getToken]);

  const handleUpdateHomeContent = useCallback(async (payload: HomeContent) => {
    // Этот блок создаётся, чтобы сохранить новый контент главной страницы и сразу обновить UI.
    if (!currentUser) return;
    const token = await getToken();
    if (!token) return;
    const updated = await apiUpdateHomeContent(token, payload);
    setHomeContent(updated);
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
              homeContent={homeContent}
              news={news}
              newsLoading={loadingNews}
              newsError={errorNews}
            />
          }
        />
        <Route
          path="/news/:id"
          element={<NewsDetailPage news={news} />}
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
              specialists={specialists}
              specialistsLoading={loadingSpecialists}
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
              homeContent={homeContent}
              newsLoading={loadingNews}
              newsError={errorNews}
              onAddNews={handleAddNews}
              onUpdateNews={handleUpdateNews}
              onDeleteNews={handleDeleteNews}
              onUpdateHomeContent={handleUpdateHomeContent}
            />
          }
        />
      </Routes>

      {/* Футер сайта */}
      <footer className="mt-12 border-t border-gray-100 bg-white/60 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl px-4 py-6 text-center text-xs text-gray-400">
          <p className="font-semibold text-gray-500">🧒 Детский ЛФК</p>
          <p className="mt-1">Запись на приём к специалисту по лечебной физкультуре</p>
          {/* Этот блок создаётся, чтобы добавить в футер фирменную подпись проекта. */}
          <p className="mt-2 text-sm text-gray-500">Сделано с любовью</p>
        </div>
      </footer>
    </div>
  );
};

export default App;
