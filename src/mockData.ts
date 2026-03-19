// mockData.ts — типы данных и сохранение текущего пользователя в localStorage (сессия)
// Все остальные данные загружаются через API (api.ts)

// Тип роли пользователя: пациент или специалист
export type UserRole = 'user' | 'specialist';

// Тип пользователя в приложении
export type User = {
  id: string;
  role: UserRole;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
};

// Тип слота времени для записи
export type TimeSlot = {
  id: string;
  specialistId: string;
  date: string;
  time: string;
  status: 'free' | 'busy';
};

// Тип записи к специалисту
export type Booking = {
  id: string;
  specialistId: string;
  userId?: string;
  date: string;
  time: string;
  lastName: string;
  firstName: string;
  phone?: string;
  status: 'active' | 'cancelled';
  // Эти поля создаются, чтобы:
  // - отображать ФИО специалиста в списке записей пациента;
  // - при этом не требовать отдельного запроса за данными специалиста.
  specialistLastName?: string | null;
  specialistFirstName?: string | null;
};

// Тип новости для главной страницы
export type NewsItem = {
  id: string;
  title: string;
  excerpt: string;
  imageUrl: string;
  date: string;
  source?: 'manual' | 'rss';
};

// Ключ localStorage для текущего пользователя (сессия между перезагрузками)
const STORAGE_KEY_USER = 'lfk-current-user';

/** Загружает текущего пользователя из localStorage */
export function loadCurrentUserFromStorage(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USER);
    if (raw) {
      const parsed = JSON.parse(raw) as User;
      if (parsed && typeof parsed.id === 'string' && typeof parsed.role === 'string' && typeof parsed.email === 'string') {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

/** Сохраняет текущего пользователя в localStorage; при выходе передать null */
export function saveCurrentUserToStorage(user: User | null): void {
  try {
    if (user === null) {
      localStorage.removeItem(STORAGE_KEY_USER);
    } else {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    }
  } catch {
    // ignore
  }
}
