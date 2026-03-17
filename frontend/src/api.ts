// api.ts — клиент для запросов к бэкенду (fetch), базовый URL и заголовки
import type { Booking, NewsItem, TimeSlot, User } from './mockData';

// Базовый URL API из переменной окружения
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

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
async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    const d = data.detail;
    if (typeof d === 'string') return d;
    if (d && typeof d === 'object' && typeof d.detail === 'string') return d.detail;
    return `Ошибка ${res.status}`;
  } catch {
    return `Ошибка ${res.status}`;
  }
}

// --- Auth (Clerk) ---
// Этот блок создаётся, чтобы:
// - синхронизировать профиль пользователя из Clerk в локальную БД;
// - передавать email, username и выбранную роль (user/specialist).
export async function apiSyncFromClerk(
  token: string,
  body: { email: string; username: string; role: 'user' | 'specialist' }
): Promise<{ id: string; role: string; email: string; username?: string }> {
  const res = await fetch(`${API_BASE}/users/sync-from-clerk`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

// Этот блок создаётся, чтобы получать профиль текущего пользователя по JWT Clerk.
export async function apiGetMe(token: string): Promise<User> {
  const res = await fetch(`${API_BASE}/users/me`, { headers: headers(token) });
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
  const res = await fetch(url, {
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
  const res = await fetch(`${API_BASE}/users/me`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify({ ...body }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

// --- News ---
export async function apiGetNews(): Promise<NewsItem[]> {
  const res = await fetch(`${API_BASE}/news`);
  if (!res.ok) throw new Error(await parseError(res));
  const items = (await res.json()) as NewsItem[];
  return items;
}

export async function apiAddNews(
  token: string,
  body: { title: string; excerpt: string; imageUrl: string }
): Promise<NewsItem> {
  const res = await fetch(`${API_BASE}/news`, {
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
  const res = await fetch(`${API_BASE}/news/${newsId}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
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
  const res = await fetch(url, { headers: headers(token) });
  if (!res.ok) throw new Error(await parseError(res));
  const items = (await res.json()) as TimeSlot[];
  return items;
}

export async function apiCreateSlot(
  token: string,
  body: { specialistId: string; date: string; time: string }
): Promise<TimeSlot> {
  const res = await fetch(`${API_BASE}/slots`, {
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
  const res = await fetch(`${API_BASE}/slots/batch`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function apiDeleteSlot(token: string, slotId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/slots/${slotId}`, {
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
  const res = await fetch(`${API_BASE}/bookings?${q}`, { headers: headers(token) });
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
  const res = await fetch(`${API_BASE}/bookings`, {
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
  const res = await fetch(`${API_BASE}/bookings`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function apiCancelBooking(token: string, bookingId: string): Promise<{ id: string; status: string }> {
  const res = await fetch(`${API_BASE}/bookings/${bookingId}/cancel`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}
