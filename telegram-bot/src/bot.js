/**
 * Этот модуль создаётся, чтобы:
 * - поднять Telegraf-бота с inline-кнопками и текстовым вводом ФИО;
 * - подгружать специалистов и слоты с FastAPI (та же БД, что у сайта) и создавать запись через API.
 */

import { Telegraf, Markup } from "telegraf";
import { createBooking, fetchSlots, fetchSpecialists } from "./api.js";
import { emptyDraft, getSession, resetSession, State } from "./sessionStore.js";

function formatDateRu(yyyyMmDd) {
  const [y, m, d] = yyyyMmDd.split("-");
  return `${d}.${m}.${y}`;
}

/** Находит специалиста в кэше сессии после /start */
function specialistFromSession(session, id) {
  return (session.specialistsList || []).find((s) => s.id === id);
}

/** Уникальные даты из кэша слотов */
function freeDatesFromCache(slotsCache) {
  const set = new Set();
  for (const s of slotsCache) {
    if (s.status === "free") set.add(s.date);
  }
  return [...set].sort();
}

/** Слоты на дату из кэша */
function slotsForDay(slotsCache, date) {
  return slotsCache.filter((s) => s.date === date && s.status === "free");
}

/**
 * Нормализация телефона для БД: оставляем цифры и +, формат +7XXXXXXXXXX при 10–11 цифрах РФ.
 */
function normalizePhoneInput(raw) {
  const t = (raw || "").trim();
  const digits = t.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("7")) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+7${digits}`;
  }
  if (t.startsWith("+")) {
    return t;
  }
  return digits.length >= 10 ? `+${digits}` : t;
}

/** Минимальная проверка: достаточно цифр для контактного номера */
function isPlausiblePhone(raw) {
  const n = (raw || "").replace(/\D/g, "").length;
  return n >= 10 && n <= 15;
}

/** Клавиатура выбора специалиста — данные с API */
function specialistKeyboard(specialists) {
  const rows = specialists.map((s) => {
    const fn = s.firstName || "";
    const ln = s.lastName || "";
    const short = fn.length ? `${ln} ${fn[0]}.` : ln || s.id;
    return [Markup.button.callback(`${short} — запись на приём`, `sp:${s.id}`)];
  });
  return Markup.inlineKeyboard(rows);
}

/** Клавиатура выбора дня */
function daysKeyboard(specialistId, slotsCache) {
  const dates = freeDatesFromCache(slotsCache);
  const rows = dates.map((date) => [
    Markup.button.callback(formatDateRu(date), `dt:${date}`),
  ]);
  rows.push([Markup.button.callback("« К специалистам", "back:sp")]);
  return Markup.inlineKeyboard(rows);
}

/** Клавиатура выбора времени */
function timesKeyboard(specialistId, date, slotsCache) {
  const list = slotsForDay(slotsCache, date);
  const rows = list.map((s) => [
    Markup.button.callback(s.time, `tm:${s.id}`),
  ]);
  rows.push([Markup.button.callback("« К датам", "back:dt")]);
  return Markup.inlineKeyboard(rows);
}

/**
 * @param {string} token — TELEGRAM_BOT_TOKEN
 * @param {{ apiBaseUrl: string, apiSecret: string }} api — URL бэкенда и TELEGRAM_BOT_API_SECRET
 */
export function createBot(token, api) {
  const { apiBaseUrl, apiSecret } = api;
  const bot = new Telegraf(token);

  // Блок: /start — загрузка специалистов с сервера и выбор
  bot.start(async (ctx) => {
    const uid = ctx.from.id;
    let specialists;
    try {
      specialists = await fetchSpecialists(apiBaseUrl, apiSecret);
    } catch (e) {
      await ctx.reply(
        `Не удалось связаться с сервером записи.\nПроверьте, что API запущен и в .env заданы API_BASE_URL и TELEGRAM_BOT_API_SECRET (как на бэкенде).\n\n${e.message}`,
      );
      return;
    }
    if (!specialists.length) {
      await ctx.reply(
        "Сейчас нет доступных специалистов для записи. Обратитесь в клинику или попробуйте позже.",
      );
      return;
    }
    resetSession(uid, specialists);
    await ctx.reply(
      "Здравствуйте! Выберите специалиста для записи на приём:",
      specialistKeyboard(specialists),
    );
  });

  // Блок: /cancel — сброс сценария
  bot.command("cancel", async (ctx) => {
    const uid = ctx.from.id;
    const s = getSession(uid);
    s.state = State.IDLE;
    s.draft = emptyDraft();
    s.specialistsList = [];
    await ctx.reply("Запись отменена. Нажмите /start, чтобы начать снова.");
  });

  // Блок: выбор специалиста — подгрузка реальных слотов из БД
  bot.action(/^sp:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const specialistId = ctx.match[1];
    const session = getSession(ctx.from.id);
    const spec = specialistFromSession(session, specialistId);
    if (!spec) {
      await ctx.reply("Специалист не найден. Нажмите /start.");
      return;
    }
    let slotsCache;
    try {
      slotsCache = await fetchSlots(apiBaseUrl, apiSecret, specialistId);
    } catch (e) {
      await ctx.reply(`Не удалось загрузить расписание: ${e.message}`);
      return;
    }
    if (!slotsCache.length) {
      await ctx.reply(
        "К этому специалисту пока нет свободных слотов. Нажмите /start и выберите другого.",
      );
      return;
    }
    const s = session;
    s.state = State.CHOOSE_DAY;
    s.draft.specialistId = specialistId;
    s.draft.slotsCache = slotsCache;

    const ln = spec.lastName || "";
    const fn = spec.firstName || "";
    await ctx.editMessageText(
      `Вы выбрали: ${ln} ${fn}\n\nТеперь выберите день:`,
      daysKeyboard(specialistId, slotsCache),
    );
  });

  // Блок: назад к списку специалистов
  bot.action("back:sp", async (ctx) => {
    await ctx.answerCbQuery();
    const uid = ctx.from.id;
    const session = getSession(uid);
    const list = session.specialistsList || [];
    if (!list.length) {
      await ctx.reply("Сессия устарела. Нажмите /start.");
      return;
    }
    resetSession(uid, list);
    await ctx.editMessageText(
      "Выберите специалиста:",
      specialistKeyboard(list),
    );
  });

  // Блок: выбор даты
  bot.action(/^dt:(\d{4}-\d{2}-\d{2})$/, async (ctx) => {
    await ctx.answerCbQuery();
    const date = ctx.match[1];
    const s = getSession(ctx.from.id);
    const specId = s.draft.specialistId;
    const slotsCache = s.draft.slotsCache || [];
    if (!specId) {
      await ctx.reply("Сессия устарела. Нажмите /start.");
      return;
    }
    const times = slotsForDay(slotsCache, date);
    if (!times.length) {
      await ctx.reply("На этот день слотов уже нет. Выберите другую дату.");
      return;
    }
    s.state = State.CHOOSE_TIME;
    s.draft.date = date;
    await ctx.editMessageText(
      `Дата: ${formatDateRu(date)}\n\nВыберите время:`,
      timesKeyboard(specId, date, slotsCache),
    );
  });

  // Блок: назад к выбору дня
  bot.action("back:dt", async (ctx) => {
    await ctx.answerCbQuery();
    const s = getSession(ctx.from.id);
    const specId = s.draft.specialistId;
    const slotsCache = s.draft.slotsCache || [];
    if (!specId) {
      await ctx.reply("Сессия устарела. Нажмите /start.");
      return;
    }
    s.state = State.CHOOSE_DAY;
    const spec = specialistFromSession(s, specId);
    const ln = spec?.lastName || "";
    const fn = spec?.firstName || "";
    await ctx.editMessageText(
      `Вы выбрали: ${ln} ${fn}\n\nВыберите день:`,
      daysKeyboard(specId, slotsCache),
    );
  });

  // Блок: выбор времени — переход к вводу имени
  bot.action(/^tm:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const slotId = ctx.match[1];
    const s = getSession(ctx.from.id);
    const slotsCache = s.draft.slotsCache || [];
    const slot = slotsCache.find((x) => x.id === slotId);
    if (
      !slot ||
      slot.status !== "free" ||
      slot.specialistId !== s.draft.specialistId
    ) {
      await ctx.reply(
        "Этот слот уже занят или недоступен. Нажмите /start и выберите время снова.",
      );
      return;
    }
    s.state = State.ENTER_FIRST_NAME;
    s.draft.slotId = slotId;
    s.draft.time = slot.time;
    s.draft.date = slot.date;
    await ctx.editMessageText(
      `Выбрано: ${formatDateRu(slot.date)} в ${slot.time}\n\nВведите ваше имя одним сообщением:`,
    );
  });

  // Блок: текстовые ответы — имя и фамилия, затем POST на API
  bot.on("text", async (ctx) => {
    const uid = ctx.from.id;
    const s = getSession(uid);
    const text = (ctx.message.text || "").trim();

    if (s.state === State.ENTER_FIRST_NAME) {
      if (text.length < 2) {
        await ctx.reply("Имя слишком короткое. Введите имя ещё раз.");
        return;
      }
      s.draft.firstName = text;
      s.state = State.ENTER_LAST_NAME;
      await ctx.reply("Введите фамилию одним сообщением:");
      return;
    }

    if (s.state === State.ENTER_LAST_NAME) {
      if (text.length < 2) {
        await ctx.reply("Фамилия слишком короткая. Введите фамилию ещё раз.");
        return;
      }
      s.draft.lastName = text;
      s.state = State.ENTER_PHONE;
      await ctx.reply(
        "Введите номер телефона для связи (например +79001234567 или 89001234567):",
      );
      return;
    }

    if (s.state === State.ENTER_PHONE) {
      if (!isPlausiblePhone(text)) {
        await ctx.reply(
          "Похоже на неверный номер. Введите телефон с кодом страны (от 10 цифр), например +79001234567.",
        );
        return;
      }
      const spec = specialistFromSession(s, s.draft.specialistId);
      const slotId = s.draft.slotId;
      if (!spec || !slotId || !s.draft.firstName || !s.draft.lastName) {
        s.state = State.IDLE;
        await ctx.reply("Сессия устарела. Нажмите /start.");
        return;
      }

      const phoneNorm = normalizePhoneInput(text);

      try {
        const booking = await createBooking(apiBaseUrl, apiSecret, {
          slotId,
          firstName: s.draft.firstName,
          lastName: s.draft.lastName,
          phone: phoneNorm,
        });

        s.state = State.IDLE;
        s.draft = emptyDraft();

        const specLn = spec.lastName || "";
        const specFn = spec.firstName || "";
        const phoneLine = booking.phone ? `Телефон: ${booking.phone}` : `Телефон: ${phoneNorm}`;
        await ctx.reply(
          [
            "Запись оформлена.",
            "",
            `Пациент: ${booking.lastName} ${booking.firstName}`,
            phoneLine,
            `Специалист: ${specLn} ${specFn}`,
            `Дата и время: ${formatDateRu(booking.date)} в ${booking.time}`,
            `Номер записи: ${booking.id}`,
            "",
            "Чтобы записаться снова, отправьте /start.",
          ].join("\n"),
        );
      } catch (e) {
        const msg = e.message || String(e);
        if (msg.includes("409") || msg.includes("SLOT_BUSY") || msg.includes("занят")) {
          await ctx.reply(
            "Это время только что заняли. Нажмите /start и выберите другой слот.",
          );
        } else {
          await ctx.reply(`Не удалось сохранить запись: ${msg}`);
        }
        s.state = State.IDLE;
        s.draft = emptyDraft();
      }
      return;
    }

    await ctx.reply(
      "Нажмите /start, чтобы записаться на приём, или /cancel для сброса.",
    );
  });

  return { bot };
}
