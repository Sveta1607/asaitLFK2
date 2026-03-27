/**
 * Этот модуль создаётся, чтобы:
 * - хранить FSM-состояние и черновик записи по telegram user id в памяти процесса;
 * - не тянуть Redis до появления требований к масштабированию.
 */

/** Константы шагов сценария записи */
export const State = {
  IDLE: "idle",
  CHOOSE_SPECIALIST: "choose_specialist",
  CHOOSE_DAY: "choose_day",
  CHOOSE_TIME: "choose_time",
  ENTER_FIRST_NAME: "enter_first_name",
  ENTER_LAST_NAME: "enter_last_name",
};

/** Карта userId -> сессия; при рестарте процесса данные теряются */
const store = new Map();

/** Пустой черновик перед новым сценарием */
function emptyDraft() {
  return {
    specialistId: null,
    date: null,
    slotId: null,
    time: null,
    firstName: null,
  };
}

/** Возвращает объект сессии, создавая запись при первом обращении */
export function getSession(telegramUserId) {
  if (!store.has(telegramUserId)) {
    store.set(telegramUserId, {
      state: State.IDLE,
      draft: emptyDraft(),
    });
  }
  return store.get(telegramUserId);
}

/** Сброс в начало сценария (команда /start или /cancel) */
export function resetSession(telegramUserId) {
  store.set(telegramUserId, {
    state: State.CHOOSE_SPECIALIST,
    draft: emptyDraft(),
  });
  return store.get(telegramUserId);
}
