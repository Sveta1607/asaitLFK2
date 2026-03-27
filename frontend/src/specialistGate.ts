/**
 * Единственный e-mail, которому разрешена регистрация как специалист.
 * Должен совпадать с ALLOWED_SPECIALIST_EMAIL на бэкенде; для Vite — префикс VITE_.
 */
export const ALLOWED_SPECIALIST_EMAIL = (
  import.meta.env.VITE_ALLOWED_SPECIALIST_EMAIL || "Sharunkina2014@yandex.ru"
)
  .trim()
  .toLowerCase();

/** Разрешена ли роль специалиста для данного адреса (без учёта регистра). */
export function canRegisterAsSpecialist(email: string): boolean {
  return (email || "").trim().toLowerCase() === ALLOWED_SPECIALIST_EMAIL;
}
