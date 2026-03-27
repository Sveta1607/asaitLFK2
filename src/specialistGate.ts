/**
 * Единственный e-mail для роли специалист (совпадает с ALLOWED_SPECIALIST_EMAIL на бэкенде).
 */
export const ALLOWED_SPECIALIST_EMAIL = (
  import.meta.env.VITE_ALLOWED_SPECIALIST_EMAIL || "Sharunkina2014@yandex.ru"
)
  .trim()
  .toLowerCase();

export function canRegisterAsSpecialist(email: string): boolean {
  return (email || "").trim().toLowerCase() === ALLOWED_SPECIALIST_EMAIL;
}
