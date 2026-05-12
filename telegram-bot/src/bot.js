/**
 * Этот модуль создаётся, чтобы:
 * - поднять Telegraf-бота с inline-кнопками и текстовым вводом ФИО;
 * - подгружать специалистов и слоты с FastAPI (та же БД, что у сайта) и создавать запись через API.
 */

import { Telegraf, Markup } from "telegraf";
import { createBooking, fetchSlots, fetchSpecialists, linkTelegramChat } from "./api.js";
import { fetchInternetNewsContextForLlm } from "./internetNews.js";
import { buildLlmContext } from "./llmContext.js";
import { interpretNewsSourceReply, isNewsRelatedQuestion } from "./newsIntent.js";
import { getAiReply } from "./openaiChat.js";
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
 * Этот блок создаётся, чтобы убрать невидимые символы из аргумента /start (копипаст из браузера).
 */
function stripInvisible(s) {
  return String(s || "").replace(/[\u200B-\u200D\uFEFF]/g, "");
}

/**
 * Этот блок создаётся, чтобы взять аргумент после /start или /start@Bot из текста сообщения (источник правды в Telegram).
 */
function extractStartArgumentFromMessageText(text) {
  const t = stripInvisible(text || "").trim();
  return t.replace(/^\/start(?:@[^\s]+)?\s*/i, "").trim();
}

/**
 * Этот блок создаётся, чтобы извлечь токен для POST /api/telegram/link-chat: 32 hex (старый формат) или подписанная строка (регистр важен).
 */
function parseLinkTokenForApi(payload) {
  const raw = stripInvisible(payload || "").trim();
  if (!raw) return null;
  let t = raw;
  if (t.toLowerCase().startsWith("link_")) t = t.slice("link_".length).trim();
  if (!t) return null;
  if (/^[a-fA-F0-9]{32}$/.test(t)) return t.toLowerCase();
  if (/^[A-Za-z0-9_-]+$/.test(t) && t.length >= 8 && t.length <= 96) return t;
  return null;
}

/**
 * Этот блок создаётся, чтобы для чистого /start не использовать ctx.startPayload — иначе после ошибки по deep link
 * повторный /start без аргумента теоретически может унаследовать старый payload в middleware и снова вызвать привязку.
 */
function resolveStartLinkArgument(ctx) {
  const fullText = stripInvisible(ctx.message?.text || "").trim();
  const fromText = extractStartArgumentFromMessageText(fullText);
  if (fromText) return fromText;
  const onlyStart = /^\/start(?:@[A-Za-z0-9_]+)?$/i.test(fullText);
  if (onlyStart) return "";
  return stripInvisible((ctx.startPayload || "").trim());
}

/**
 * Этот блок создаётся, чтобы один раз выполнить вызов API привязки и ответ пользователю.
 */
async function runTelegramSpecialistLink(ctx, apiBaseUrl, apiSecret, linkToken) {
  try {
    await linkTelegramChat(apiBaseUrl, apiSecret, linkToken, ctx.chat.id);
    await ctx.reply(
      "Уведомления о новых записях подключены. Вы будете получать сюда ФИО, телефон, дату и время при записи пациента.",
    );
  } catch (e) {
    await ctx.reply(`Не удалось подключить уведомления: ${e.message}`);
  }
}

/**
 * Этот блок держит индикатор «печатает…» в Telegram, пока идёт запрос к LLM (обновление каждые ~4 с).
 */
async function withTyping(ctx, work) {
  const chatId = ctx.chat.id;
  const tick = () => ctx.telegram.sendChatAction(chatId, "typing").catch(() => {});
  await tick();
  const id = setInterval(tick, 4000);
  try {
    return await work();
  } finally {
    clearInterval(id);
  }
}

/** Состояния, где текст сообщения — это только данные для записи (не вопрос ассистенту). */
const BOOKING_TEXT_STATES = new Set([
  State.ENTER_FIRST_NAME,
  State.ENTER_LAST_NAME,
  State.ENTER_PHONE,
]);

/**
 * Этот блок — вежливый текст и кнопки, чтобы пользователь явно выбрал источник новостей (сайт центра или открытый интернет).
 */
const NEWS_SOURCE_PROMPT =
  "Подскажите, пожалуйста: вас интересуют новости, опубликованные на сайте нашего центра, " +
  "или краткий обзор материалов из открытых источников в интернете по теме детского здоровья, ЛФК и реабилитации? " +
  "Выберите вариант кнопкой ниже — так мы не перепутаем источник.";

/**
 * Этот блок рисует inline-клавиатуру выбора источника новостей (короткий callback ns:… для лимита Telegram).
 */
function newsSourceKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("С сайта центра", "ns:site"),
      Markup.button.callback("Из интернета", "ns:net"),
    ],
  ]);
}

/**
 * Этот блок формирует читаемый список новостей с сайта — пользователь видит факты даже если модель скупится на детали.
 */
function formatSiteNewsForTelegram(items) {
  if (!items?.length) {
    return "";
  }
  const lines = items.slice(0, 15).map((n) => {
    const title = (n.title || "").trim();
    const date = (n.date || "").trim();
    const ex = (n.excerpt || "").replace(/\s+/g, " ").trim().slice(0, 200);
    const tail = ex ? `\n  ${ex}` : "";
    return `• ${date} — ${title}${tail}`;
  });
  return `📰 Новости с сайта центра:\n${lines.join("\n")}`;
}

/**
 * Этот блок отвечает по новостям сайта: сначала явный список из API, затем краткий ответ LLM по тому же контексту.
 */
async function replyAiWithSiteNews(ctx, apiBaseUrl, apiSecret, questionText, key) {
  const { dataContext, siteNewsItems, newsLoadError } = await buildLlmContext(
    apiBaseUrl,
    apiSecret,
  );
  const headerParts = [];
  if (newsLoadError) {
    headerParts.push(
      `Не удалось загрузить новости с сайта: ${newsLoadError}. Проверьте API_BASE_URL бота и доступность ${apiBaseUrl.replace(/\/$/, "")}/api/news`,
    );
  } else if (siteNewsItems.length) {
    headerParts.push(formatSiteNewsForTelegram(siteNewsItems));
  } else {
    headerParts.push("На сайте центра сейчас нет опубликованных новостей в выгрузке API.");
  }
  const answer = await getAiReply(questionText, dataContext, key);
  const full = [...headerParts, answer].filter(Boolean).join("\n\n").slice(0, 4090);
  await ctx.reply(full, { disable_web_page_preview: true });
}

/**
 * Этот блок подгружает RSS из интернета и просит модель выбрать релевантную публикацию без выдумывания фактов.
 */
async function replyAiWithInternetNews(ctx, questionText, key) {
  const rss = await fetchInternetNewsContextForLlm(questionText);
  const dataContext = [
    "Режим: ответ только по приведённым ниже строкам RSS (открытые источники). Это не официальный контент центра; не подставляй новости с сайта клиники.",
    "",
    rss,
    "",
    "Задача: выбери одну или две записи, наиболее близкие к вопросу пользователя и теме здоровья детей, ЛФК и реабилитации. Кратко перескажи только по фактам из списка; обязательно укажи ссылку(и). Если подходящего материала нет — скажи честно. Без диагнозов и назначений.",
  ].join("\n");
  const answer = await getAiReply(questionText, dataContext, key);
  await ctx.reply(answer);
}

/**
 * @param {string} token — TELEGRAM_BOT_TOKEN
 * @param {{ apiBaseUrl: string, apiSecret: string, openAiApiKey?: string }} api — бэкенд, секрет бота и ключ OpenAI
 */
export function createBot(token, api) {
  const { apiBaseUrl, apiSecret, openAiApiKey = "" } = api;
  const bot = new Telegraf(token);

  // Этот блок включается через TELEGRAM_BOT_DEBUG=1 — видно, доходят ли апдейты от Telegram до бота (если строк нет при /start — проблема сети или webhook).
  if ((process.env.TELEGRAM_BOT_DEBUG || "").trim() === "1") {
    bot.use(async (ctx, next) => {
      const t = ctx.message?.text;
      const cq = ctx.callbackQuery?.data;
      console.log(
        `[telegram-bot] update_id=${ctx.update?.update_id} chat=${ctx.chat?.id} text=${t ? JSON.stringify(t) : "-"} cb=${cq ? JSON.stringify(cq) : "-"}`,
      );
      return next();
    });
  }

  // Блок: /link <токен> — ручная привязка, если deep link из браузера ведёт себя нестабильно.
  bot.command("link", async (ctx) => {
    const arg = stripInvisible((ctx.payload || "").trim());
    const tok = parseLinkTokenForApi(arg);
    if (!tok) {
      await ctx.reply(
        "Укажите хвост ссылки после link_: /link <токен> (32 символа 0-9 a-f или короткая подписанная строка с сайта).",
      );
      return;
    }
    await runTelegramSpecialistLink(ctx, apiBaseUrl, apiSecret, tok);
  });

  // Блок: /start — загрузка специалистов с сервера и выбор
  bot.start(async (ctx) => {
    const uid = ctx.from.id;
    // Этот блок создаётся, чтобы обработать привязку уведомлений для специалиста (ссылка из ЛК на сайте).
    const startArg = resolveStartLinkArgument(ctx);
    const linkTok = parseLinkTokenForApi(startArg);
    if (linkTok) {
      await runTelegramSpecialistLink(ctx, apiBaseUrl, apiSecret, linkTok);
      return;
    }
    if (startArg && startArg.toLowerCase().startsWith("link_")) {
      await ctx.reply(
        "Неверный формат ссылки. Откройте профиль на сайте и сгенерируйте новую ссылку для Telegram.",
      );
      return;
    }

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
    s.pendingNewsUserText = null;
    await ctx.reply("Запись отменена. Нажмите /start, чтобы начать снова.");
  });

  // Блок: выбор источника новостей после вопроса пользователя (сайт центра или RSS интернета).
  bot.action(/^ns:(site|net)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const uid = ctx.from.id;
    const s = getSession(uid);
    const kind = ctx.match[1];
    const key = (openAiApiKey || "").trim();
    if (!key) {
      s.pendingNewsUserText = null;
      await ctx.reply(
        "Ассистент выключен: задайте OPENAI_API_KEY в telegram-bot/.env. Запись: /start.",
      );
      return;
    }
    const q = s.pendingNewsUserText || "Расскажите, какие есть новости.";
    s.pendingNewsUserText = null;
    await withTyping(ctx, async () => {
      try {
        if (kind === "site") {
          await replyAiWithSiteNews(ctx, apiBaseUrl, apiSecret, q, key);
        } else {
          await replyAiWithInternetNews(ctx, q, key);
        }
      } catch (e) {
        await ctx.reply(
          `Сейчас не получилось обработать запрос: ${e.message || String(e)}`,
        );
      }
    });
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

    // Этот блок отвечает произвольным текстом через OpenAI, когда пользователь не на шаге ввода ФИО/телефона.
    if (!BOOKING_TEXT_STATES.has(s.state)) {
      if (text.startsWith("/")) {
        await ctx.reply(
          "Неизвестная команда. Доступны: /start — запись, /cancel — сброс, /link — привязка для специалиста.",
        );
        return;
      }
      const key = (openAiApiKey || "").trim();
      if (!key) {
        await ctx.reply(
          "Ассистент выключен: задайте OPENAI_API_KEY в telegram-bot/.env. Запись: /start.",
        );
        return;
      }

      // Этот блок обрабатывает уточнение источника новостей и повторный вопрос, пока ждём выбор кнопкой или текстом.
      if (s.pendingNewsUserText) {
        const src = interpretNewsSourceReply(text);
        if (src === "site") {
          const q = s.pendingNewsUserText;
          s.pendingNewsUserText = null;
          await withTyping(ctx, async () => {
            try {
              await replyAiWithSiteNews(ctx, apiBaseUrl, apiSecret, q, key);
            } catch (e) {
              await ctx.reply(
                `Сейчас не получилось обработать запрос: ${e.message || String(e)}`,
              );
            }
          });
          return;
        }
        if (src === "internet") {
          const q = s.pendingNewsUserText;
          s.pendingNewsUserText = null;
          await withTyping(ctx, async () => {
            try {
              await replyAiWithInternetNews(ctx, q, key);
            } catch (e) {
              await ctx.reply(
                `Сейчас не получилось обработать запрос: ${e.message || String(e)}`,
              );
            }
          });
          return;
        }
        if (isNewsRelatedQuestion(text)) {
          s.pendingNewsUserText = text;
          await ctx.reply(NEWS_SOURCE_PROMPT, newsSourceKeyboard());
          return;
        }
        s.pendingNewsUserText = null;
      } else if (isNewsRelatedQuestion(text)) {
        s.pendingNewsUserText = text;
        await ctx.reply(NEWS_SOURCE_PROMPT, newsSourceKeyboard());
        return;
      }

      // Этот блок оборачивает и загрузку контекста, и OpenAI — иначе при ошибке buildLlmContext ответа в чат не было.
      await withTyping(ctx, async () => {
        try {
          const { dataContext } = await buildLlmContext(apiBaseUrl, apiSecret);
          const answer = await getAiReply(text, dataContext, key);
          await ctx.reply(answer);
        } catch (e) {
          await ctx.reply(
            `Сейчас не получилось связаться с ассистентом: ${e.message || String(e)}`,
          );
        }
      });
      return;
    }
  });

  // Этот блок создаётся, чтобы на голос, стикеры и фото не было «тишины» — обработчик текста их не видит.
  bot.on(["photo", "voice", "video_note", "sticker", "document", "audio", "video"], async (ctx) => {
    await ctx.reply(
      "Пока отвечаю только на текст. Напиши вопрос сообщением или отправь /start для записи.",
    );
  });

  // Этот блок ловит необработанные ошибки Telegraf, чтобы пользователь видел ответ, а не пустоту.
  bot.catch((err, ctx) => {
    console.error("[telegram-bot] update error:", err);
    return ctx.reply("Произошла ошибка при обработке сообщения. Попробуй ещё раз или /start.").catch(() => {});
  });

  return { bot };
}
