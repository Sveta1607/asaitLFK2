/**
 * Этот модуль создаётся, чтобы:
 * - хранить демо-данные (специалисты, услуги, слоты) без подключения к БД;
 * - выдавать копию слотов при старте бота — дальше слоты помечаются busy в памяти процесса.
 */

/** Список специалистов для выбора в боте */
export const specialists = [
  {
    id: "spec-1",
    firstName: "Анна",
    lastName: "Смирнова",
    title: "Инструктор ЛФК",
  },
  {
    id: "spec-2",
    firstName: "Пётр",
    lastName: "Козлов",
    title: "Массажист",
  },
];

/**
 * Услуги по специалисту — показываем при выборе мастера,
 * чтобы пользователь понимал контекст записи.
 */
export const servicesBySpecialistId = {
  "spec-1": ["ЛФК", "Реабилитация после травм", "Консультация"],
  "spec-2": ["Лечебный массаж", "Спортивный массаж"],
};

/** Начальное расписание: свободные слоты (id уникален в рамках демо) */
export const initialSlots = [
  { id: "slot-1", specialistId: "spec-1", date: "2026-03-28", time: "09:00", status: "free" },
  { id: "slot-2", specialistId: "spec-1", date: "2026-03-28", time: "11:00", status: "free" },
  { id: "slot-3", specialistId: "spec-1", date: "2026-03-29", time: "10:00", status: "free" },
  { id: "slot-4", specialistId: "spec-1", date: "2026-03-30", time: "14:00", status: "free" },
  { id: "slot-5", specialistId: "spec-2", date: "2026-03-28", time: "10:00", status: "free" },
  { id: "slot-6", specialistId: "spec-2", date: "2026-03-28", time: "15:30", status: "free" },
  { id: "slot-7", specialistId: "spec-2", date: "2026-03-29", time: "12:00", status: "free" },
];

/**
 * Глубокая копия слотов — чтобы мутировать статусы при записях,
 * не трогая исходный шаблон в модуле.
 */
export function cloneSlots() {
  return initialSlots.map((s) => ({ ...s }));
}
