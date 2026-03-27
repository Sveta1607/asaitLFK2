// api.ts — клиент для запросов к бэкенду (fetch), базовый URL и заголовки.
// Также отправляет HTTP-ошибки (4xx/5xx) в Sentry как breadcrumbs и события.
import type { Booking, HomeContent, NewsItem, SpecialistInfo, TimeSlot, User } from './mockData';
import * as Sentry from '@sentry/react';

const HOME_CONTENT_STORAGE_KEY = 'lfk-home-content-fallback';

/** Приводит URL к виду …/api (роуты FastAPI под префиксом /api). */
function normalizeApiBase(raw: string): string {
  let u = (raw || '').trim().replace(/\/+$/, '');
  if (!u.endsWith('/api')) {
    u = `${u}/api`;
  }
  return u;
}

/**
 * В dev по умолчанию локальный бэкенд; иначе запросы шли бы на Amvera без frontend/.env — NetworkError.
 * В production — URL деплоя, если VITE_API_URL не задан при сборке.
 */
const _rawBase =
  import.meta.env.VITE_API_URL?.trim() ||
  (import.meta.env.DEV
    ? 'http://127.0.0.1:3000'
    : 'https://lfk-b-svetlanagolovchanskaya.amvera.io');
const API_BASE = normalizeApiBase(_rawBase);

/**
 * Обёртка над fetch: «NetworkError» в браузере заменяем на понятный текст (часто — не запущен API или неверный VITE_API_URL).
 */
async function fetchApi(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await globalThis.fetch(input, init);
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    const isNetwork =
      /NetworkError|Failed to fetch|Load failed|Network request failed|fetch/i.test(m) ||
      (err instanceof TypeError && /fetch|network/i.test(m));
    if (isNetwork) {
      throw new Error(
        `Нет связи с API (${API_BASE}). ` +
          (import.meta.env.DEV
            ? 'Запустите бэкенд: cd backend → python -m uvicorn main:app --host 127.0.0.1 --port 3000. При необходимости в frontend/.env: VITE_API_URL=http://127.0.0.1:3000/api'
            : 'Проверьте VITE_API_URL при сборке фронта и доступность бэкенда (CORS, HTTPS).'),
      );
    }
    throw err;
  }
}

// Заголовки для запросов с авторизацией через Bearer-токен Clerk
function headers(token?: string): Record<string, string> {
  // Этот блок создаётся, чтобы:
  // - всегда отправлять Content-Type: application/json;
  // - при наличии токена добавлять Authorization: Bearer <token> вместо X-User-Id.
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

// Ошибка с сообщением от сервера (detail может быть строкой или объектом).
// Этот вспомогательный блок создан, чтобы аккуратно разобрать detail и вернуть
// человекочитаемое сообщение для отображения в интерфейсе без лишних побочных запросов.
// Также отправляет серверные ошибки (5xx) в Sentry.
async function parseError(res: Response): Promise<string> {
  let message: string;
  try {
    const data = await res.json();
    const d = data.detail;
    if (typeof d === 'string') message = d;
    else if (d && typeof d === 'object' && typeof d.detail === 'string') message = d.detail;
    else message = `Ошибка ${res.status}`;
  } catch {
    message = `Ошибка ${res.status}`;
  }

  // Серверные ошибки (5xx) отправляются в Sentry как полноценные события
  if (res.status >= 500) {
    Sentry.captureException(new Error(`API ${res.status}: ${message}`), {
      extra: { url: res.url, status: res.status },
    });
  }

  return message;
}

// --- Auth (Clerk) ---
// Этот блок создаётся, чтобы:
// - синхронизировать профиль пользователя из Clerk в локальную БД;
// - передавать email, username и выбранную роль (user/specialist).
// Этот блок создаётся, чтобы при регистрации сразу передавать ФИО и телефон в профиль.
export async function apiSyncFromClerk(
  token: string,
  body: {
    email: string;
    username: string;
    role: 'user' | 'specialist';
    firstName?: string;
    lastName?: string;
    phone?: string;
  }
): Promise<{ id: string; role: string; email: string; username?: string }> {
  const res = await fetchApi(`${API_BASE}/users/sync-from-clerk`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

// Этот блок создаётся, чтобы получать профиль текущего пользователя по JWT Clerk.
export async function apiGetMe(token: string): Promise<User> {
  const res = await fetchApi(`${API_BASE}/users/me`, { headers: headers(token) });
  // Явно пробрасываем 403 как специальный маркер для показа выбора роли
  if (res.status === 403) {
    throw new Error('403');
  }
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

// --- Auth (legacy, для совместимости) ---
export async function apiAuth(
  mode: 'login' | 'register',
  body: { email: string; firstName: string; lastName: string; role: 'user' | 'specialist'; phone?: string }
): Promise<User> {
  // Этот блок остаётся для совместимости, но в новой версии авторизация будет происходить через Clerk.
  const url = mode === 'login' ? `${API_BASE}/auth/login` : `${API_BASE}/auth/register`;
  const res = await fetchApi(url, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const msg = await parseError(res);
    throw new Error(msg);
  }
  const user = (await res.json()) as User;
  return user;
}

// --- Users ---
export async function apiUpdateUser(
  token: string,
  body: { email: string; firstName?: string; lastName?: string; phone?: string }
): Promise<User> {
  // Этот блок создаётся, чтобы:
  // - отправлять на бэкенд все редактируемые поля профиля;
  // - использовать один и тот же метод для пациента и специалиста.
  const res = await fetchApi(`${API_BASE}/users/me`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify({ ...body }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

// --- Specialists (список специалистов для страницы записи) ---
export async function apiGetSpecialists(token: string): Promise<SpecialistInfo[]> {
  const res = await fetchApi(`${API_BASE}/users/specialists`, { headers: headers(token) });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

// --- News ---
export async function apiGetNews(): Promise<NewsItem[]> {
  const res = await fetchApi(`${API_BASE}/news`);
  if (!res.ok) throw new Error(await parseError(res));
  const items = (await res.json()) as NewsItem[];
  return items;
}

export async function apiAddNews(
  token: string,
  body: { title: string; excerpt: string; imageUrl: string }
): Promise<NewsItem> {
  const res = await fetchApi(`${API_BASE}/news`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function apiUpdateNews(
  token: string,
  newsId: string,
  body: { title: string; excerpt: string; imageUrl: string }
): Promise<NewsItem> {
  const res = await fetchApi(`${API_BASE}/news/${newsId}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

// Удаление новости — только специалист (JWT Clerk).
export async function apiDeleteNews(token: string, newsId: string): Promise<void> {
  const res = await fetchApi(`${API_BASE}/news/${newsId}`, {
    method: 'DELETE',
    headers: headers(token),
  });
  if (!res.ok) throw new Error(await parseError(res));
}

// --- Site content (главная страница) ---
export async function apiGetHomeContent(): Promise<HomeContent> {
  // Этот блок создаётся, чтобы публично загружать редактируемый контент главной страницы.
  const res = await fetchApi(`${API_BASE}/site-content/home`);
  if (res.ok) {
    const data = (await res.json()) as HomeContent;
    try {
      localStorage.setItem(HOME_CONTENT_STORAGE_KEY, JSON.stringify(data));
    } catch {
      // ignore
    }
    return data;
  }
  // Этот блок создаётся, чтобы сохранить работоспособность UI, если бэкенд ещё не обновлён.
  try {
    const raw = localStorage.getItem(HOME_CONTENT_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as HomeContent;
  } catch {
    // ignore
  }
  throw new Error(await parseError(res));
}

export async function apiUpdateHomeContent(
  token: string,
  body: HomeContent
): Promise<HomeContent> {
  // Этот блок создаётся, чтобы позволить специалисту обновлять тексты главной страницы.
  const res = await fetchApi(`${API_BASE}/site-content/home`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (res.ok) {
    const data = (await res.json()) as HomeContent;
    try {
      localStorage.setItem(HOME_CONTENT_STORAGE_KEY, JSON.stringify(data));
    } catch {
      // ignore
    }
    return data;
  }
  // Этот блок создаётся, чтобы при недоступном API всё равно сохранять контент локально.
  try {
    localStorage.setItem(HOME_CONTENT_STORAGE_KEY, JSON.stringify(body));
  } catch {
    // ignore
  }
  return body;
}

// --- Slots ---
export async function apiGetSlots(
  token: string,
  specialistId?: string,
  date?: string
): Promise<TimeSlot[]> {
  // Этот блок создаётся, чтобы:
  // - уметь запрашивать слоты как по конкретному специалисту, так и по всем сразу;
  // - не плодить отдельные эндпоинты для пациентов и специалистов.
  const params = new URLSearchParams();
  if (specialistId) params.set('specialistId', specialistId);
  if (date) params.set('date', date);
  const query = params.toString();
  const url = query ? `${API_BASE}/slots?${query}` : `${API_BASE}/slots`;
  const res = await fetchApi(url, { headers: headers(token) });
  if (!res.ok) throw new Error(await parseError(res));
  const items = (await res.json()) as TimeSlot[];
  return items;
}

export async function apiCreateSlot(
  token: string,
  body: { specialistId: string; date: string; time: string }
): Promise<TimeSlot> {
  const res = await fetchApi(`${API_BASE}/slots`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function apiCreateSlotsBatch(
  token: string,
  body: { specialistId: string; date: string; times: string[] }
): Promise<TimeSlot[]> {
  const res = await fetchApi(`${API_BASE}/slots/batch`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function apiDeleteSlot(token: string, slotId: string): Promise<void> {
  const res = await fetchApi(`${API_BASE}/slots/${slotId}`, {
    method: 'DELETE',
    headers: headers(token),
  });
  if (!res.ok) throw new Error(await parseError(res));
}

// --- Bookings ---
export async function apiGetBookings(
  token: string,
  params: { userId?: string; specialistId?: string }
): Promise<Booking[]> {
  const q = new URLSearchParams();
  if (params.userId) q.set('userId', params.userId);
  if (params.specialistId) q.set('specialistId', params.specialistId);
  const res = await fetchApi(`${API_BASE}/bookings?${q}`, { headers: headers(token) });
  if (!res.ok) throw new Error(await parseError(res));
  const items = (await res.json()) as Booking[];
  return items;
}

export async function apiCreateBookingByPatient(
  token: string,
  body: {
    specialistId: string;
    slotId: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }
): Promise<Booking & { cancelToken?: string }> {
  const res = await fetchApi(`${API_BASE}/bookings`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ ...body }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function apiCreateBookingBySpecialist(
  token: string,
  body: {
    specialistId: string;
    date: string;
    time: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }
): Promise<Booking & { cancelToken?: string }> {
  const res = await fetchApi(`${API_BASE}/bookings`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function apiCancelBooking(token: string, bookingId: string): Promise<{ id: string; status: string }> {
  const res = await fetchApi(`${API_BASE}/bookings/${bookingId}/cancel`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}
