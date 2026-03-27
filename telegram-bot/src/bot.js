/**
 * Этот модуль создаётся, чтобы:
 * - поднять Telegraf-бота с inline-кнопками и текстовым вводом ФИО;
 * - реализовать FSM записи на приём и фиксировать результат в памяти (демо-«база»).
 */

import { Telegraf, Markup } from "telegraf";
import {
  specialists,
  servicesBySpecialistId,
  cloneSlots,
} from "./data.js";
import { getSession, resetSession, State } from "./sessionStore.js";

/** Живой список слотов — при записи слот переводится в busy */
const slots = cloneSlots();

/** История записей в памяти процесса (вместо PostgreSQL в этом демо) */
const bookings = [];

function specialistById(id) {
  return specialists.find((s) => s.id === id);
}

function formatDateRu(yyyyMmDd) {
  const [y, m, d] = yyyyMmDd.split("-");
  return `${d}.${m}.${y}`;
}

/** Уникальные даты со свободными слотами для выбранного специалиста */
function freeDatesForSpecialist(specialistId) {
  const set = new Set();
  for (const s of slots) {
    if (s.specialistId === specialistId && s.status === "free") {
      set.add(s.date);
    }
  }
  return [...set].sort();
}

/** Свободные слоты на конкретную дату и специалиста */
function freeSlotsForDay(specialistId, date) {
  return slots.filter(
    (s) =>
      s.specialistId === specialistId &&
      s.date === date &&
      s.status === "free",
  );
}

function nextBookingId() {
  return `b-${Date.now()}`;
}

/** Клавиатура выбора специалиста — по одной кнопке на мастера */
function specialistKeyboard() {
  const rows = specialists.map((s) => [
    Markup.button.callback(
      `${s.lastName} ${s.firstName[0]}. — ${s.title}`,
      `sp:${s.id}`,
    ),
  ]);
  return Markup.inlineKeyboard(rows);
}

/** Клавиатура выбора дня */
function daysKeyboard(specialistId) {
  const dates = freeDatesForSpecialist(specialistId);
  const rows = dates.map((date) => [
    Markup.button.callback(formatDateRu(date), `dt:${date}`),
  ]);
  rows.push([Markup.button.callback("« К специалистам", "back:sp")]);
  return Markup.inlineKeyboard(rows);
}

/** Клавиатура выбора времени */
function timesKeyboard(specialistId, date) {
  const list = freeSlotsForDay(specialistId, date);
  const rows = list.map((s) => [
    Markup.button.callback(s.time, `tm:${s.id}`),
  ]);
  rows.push([Markup.button.callback("« К датам", "back:dt")]);
  return Markup.inlineKeyboard(rows);
}

export function createBot(token) {
  const bot = new Telegraf(token);

  // Блок: команда /start — сброс сессии и выбор специалиста
  bot.start(async (ctx) => {
    const uid = ctx.from.id;
    resetSession(uid);
    await ctx.reply(
      "Здравствуйте! Выберите специалиста для записи на приём:",
      specialistKeyboard(),
    );
  });

  // Блок: /cancel — выход из сценария
  bot.command("cancel", async (ctx) => {
    const uid = ctx.from.id;
    const s = getSession(uid);
    s.state = State.IDLE;
    s.draft = {
      specialistId: null,
      date: null,
      slotId: null,
      time: null,
      firstName: null,
    };
    await ctx.reply("Запись отменена. Нажмите /start, чтобы начать снова.");
  });

  // Блок: выбор специалиста
  bot.action(/^sp:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const specialistId = ctx.match[1];
    const spec = specialistById(specialistId);
    if (!spec) {
      await ctx.reply("Специалист не найден. Нажмите /start.");
      return;
    }
    const dates = freeDatesForSpecialist(specialistId);
    if (dates.length === 0) {
      await ctx.reply(
        "К этому специалисту пока нет свободных слотов. Нажмите /start и выберите другого.",
      );
      return;
    }
    const s = getSession(ctx.from.id);
    s.state = State.CHOOSE_DAY;
    s.draft.specialistId = specialistId;

    const svc = (servicesBySpecialistId[specialistId] || []).join(", ");
    const svcLine = svc ? `\nУслуги: ${svc}` : "";
    await ctx.editMessageText(
      `Вы выбрали: ${spec.lastName} ${spec.firstName}${svcLine}\n\nТеперь выберите день:`,
      daysKeyboard(specialistId),
    );
  });

  // Блок: назад к списку специалистов
  bot.action("back:sp", async (ctx) => {
    await ctx.answerCbQuery();
    resetSession(ctx.from.id);
    await ctx.editMessageText(
      "Выберите специалиста:",
      specialistKeyboard(),
    );
  });

  // Блок: выбор даты
  bot.action(/^dt:(\d{4}-\d{2}-\d{2})$/, async (ctx) => {
    await ctx.answerCbQuery();
    const date = ctx.match[1];
    const s = getSession(ctx.from.id);
    const specId = s.draft.specialistId;
    if (!specId) {
      await ctx.reply("Сессия устарела. Нажмите /start.");
      return;
    }
    const times = freeSlotsForDay(specId, date);
    if (times.length === 0) {
      await ctx.reply("На этот день слотов уже нет. Выберите другую дату.");
      return;
    }
    s.state = State.CHOOSE_TIME;
    s.draft.date = date;
    await ctx.editMessageText(
      `Дата: ${formatDateRu(date)}\n\nВыберите время:`,
      timesKeyboard(specId, date),
    );
  });

  // Блок: назад к выбору дня
  bot.action("back:dt", async (ctx) => {
    await ctx.answerCbQuery();
    const s = getSession(ctx.from.id);
    const specId = s.draft.specialistId;
    if (!specId) {
      await ctx.reply("Сессия устарела. Нажмите /start.");
      return;
    }
    s.state = State.CHOOSE_DAY;
    const spec = specialistById(specId);
    const svc = (servicesBySpecialistId[specId] || []).join(", ");
    const svcLine = svc ? `\nУслуги: ${svc}` : "";
    await ctx.editMessageText(
      `Вы выбрали: ${spec.lastName} ${spec.firstName}${svcLine}\n\nВыберите день:`,
      daysKeyboard(specId),
    );
  });

  // Блок: выбор времени — переход к вводу имени
  bot.action(/^tm:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const slotId = ctx.match[1];
    const slot = slots.find((x) => x.id === slotId);
    const s = getSession(ctx.from.id);
    if (!slot || slot.status !== "free" || slot.specialistId !== s.draft.specialistId) {
      await ctx.reply("Этот слот уже занят или недоступен. Выберите другое время.");
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

  // Блок: текстовые ответы — имя и фамилия
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
      const spec = specialistById(s.draft.specialistId);
      const slot = slots.find((x) => x.id === s.draft.slotId);
      if (!spec || !slot || slot.status !== "free") {
        s.state = State.IDLE;
        await ctx.reply(
          "Не удалось завершить запись (слот недоступен). Нажмите /start и выберите время снова.",
        );
        return;
      }

      slot.status = "busy";
      const booking = {
        id: nextBookingId(),
        specialistId: spec.id,
        specialistLastName: spec.lastName,
        specialistFirstName: spec.firstName,
        date: slot.date,
        time: slot.time,
        firstName: s.draft.firstName,
        lastName: text,
        telegramUserId: uid,
        createdAt: new Date().toISOString(),
      };
      bookings.push(booking);

      s.state = State.IDLE;
      s.draft = {
        specialistId: null,
        date: null,
        slotId: null,
        time: null,
        firstName: null,
      };

      await ctx.reply(
        [
          "Запись оформлена.",
          "",
          `Пациент: ${booking.lastName} ${booking.firstName}`,
          `Специалист: ${booking.specialistLastName} ${booking.specialistFirstName}`,
          `Дата и время: ${formatDateRu(booking.date)} в ${booking.time}`,
          `Номер записи: ${booking.id}`,
          "",
          "Чтобы записаться снова, отправьте /start.",
        ].join("\n"),
      );
      return;
    }

    await ctx.reply("Нажмите /start, чтобы записаться на приём, или /cancel для сброса.");
  });

  return { bot, getBookings: () => [...bookings] };
}
