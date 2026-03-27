/**
 * Этот модуль создаётся, чтобы:
 * - хранить FSM-состояние и черновик записи по telegram user id в памяти процесса;
 * - кэшировать список специалистов и слотов, полученных с API, на время сценария.
 */

/** Константы шагов сценария записи */
export const State = {
  IDLE: "idle",
  CHOOSE_SPECIALIST: "choose_specialist",
  CHOOSE_DAY: "choose_day",
  CHOOSE_TIME: "choose_time",
  ENTER_FIRST_NAME: "enter_first_name",
  ENTER_LAST_NAME: "enter_last_name",
  ENTER_PHONE: "enter_phone",
};

/** Карта userId -> сессия; при рестарте процесса данные теряются */
const store = new Map();

/** Пустой черновик перед новым сценарием */
export function emptyDraft() {
  return {
    specialistId: null,
    date: null,
    slotId: null,
    time: null,
    firstName: null,
    lastName: null,
    /** Телефон для связи — передаётся в bookings.phone */
    phone: null,
    /** Свободные слоты с API для выбранного специалиста */
    slotsCache: [],
  };
}

/** Возвращает объект сессии, создавая запись при первом обращении */
export function getSession(telegramUserId) {
  if (!store.has(telegramUserId)) {
    store.set(telegramUserId, {
      state: State.IDLE,
      draft: emptyDraft(),
      specialistsList: [],
    });
  }
  return store.get(telegramUserId);
}

/**
 * Сброс в начало сценария (команда /start или /cancel).
 * specialistsList — результат GET /api/telegram/specialists для кнопок и подписей.
 */
export function resetSession(telegramUserId, specialistsList = []) {
  store.set(telegramUserId, {
    state: State.CHOOSE_SPECIALIST,
    draft: emptyDraft(),
    specialistsList,
  });
  return store.get(telegramUserId);
}
