/**
 * Этот модуль создаётся, чтобы собрать факты из API центра (новости, специалисты, свободные слоты)
 * и передать их модели — так она реже выдумывает расписание и заголовки новостей.
 */

import { fetchPublicHomeContent, fetchPublicNews, fetchSpecialists, fetchSlots } from "./api.js";

/**
 * Этот блок создаётся, чтобы превратить ответ /api/site-content/home в связный текст для LLM (без HTML).
 */
function formatHomeContentForLlm(home) {
  if (!home || typeof home !== "object") {
    return "Контент главной страницы не загружен.";
  }
  const lines = [];
  // Этот блок — коротко «кто мы»: бейдж и заголовки с главной.
  if (home.heroBadge) lines.push(`Направление / слоган: ${String(home.heroBadge).trim()}`);
  if (home.heroTitle) lines.push(`Заголовок: ${String(home.heroTitle).trim()}`);
  if (home.heroSubtitle) lines.push(`О центре: ${String(home.heroSubtitle).trim()}`);
  if (home.heroCtaNote) lines.push(`Примечание к записи: ${String(home.heroCtaNote).trim()}`);
  // Этот блок — преимущества и блок «о специалисте» с сайта (частично дублирует карточку специалистов из API, но даёт маркетинговый контекст).
  const feats = [
    [home.feature1Title, home.feature1Text],
    [home.feature2Title, home.feature2Text],
  ];
  for (const [t, x] of feats) {
    if (t || x) lines.push(`Услуга/особенность: ${String(t || "").trim()} — ${String(x || "").trim()}`.trim());
  }
  const ben = [
    [home.benefit1Title, home.benefit1Text],
    [home.benefit2Title, home.benefit2Text],
    [home.benefit3Title, home.benefit3Text],
  ];
  for (const [t, x] of ben) {
    if (t || x) lines.push(`Преимущество: ${String(t || "").trim()} — ${String(x || "").trim()}`.trim());
  }
  if (home.specialistTitle || home.specialistText) {
    lines.push(
      `Текст на сайте (${String(home.specialistTitle || "О специалисте").trim()}): ${String(home.specialistText || "").trim()}`,
    );
  }
  return lines.filter(Boolean).join("\n") || "Раздел главной страницы пуст.";
}

/**
 * Этот блок — назначение бота для ассистента: в первую очередь ответы на вопросы, затем запись и уведомления.
 */
const TELEGRAM_BOT_PURPOSE_RU = [
  "Назначение этого Telegram-бота:",
  "- Главное — отвечать на вопросы пользователей о центре, специалистах, записи и смежных темах (в рамках данных ниже и правил безопасности).",
  "- Запись на приём: выбор специалиста, даты и времени из актуальных свободных слотов.",
  "- Для одобренных специалистов после привязки чата по ссылке из личного кабинета на сайте — уведомления о новых записях.",
  "- Запись через бота без входа в личный кабинет (гостевая).",
].join("\n");

/**
 * Этот блок — базовое описание профиля центра (реабилитация детей, ЛФК, массаж), пока нет отдельного поля в БД только под ассистента.
 */
const CENTER_MISSION_RU = [
  "О центре (общая справка; детали с сайта см. блок ниже, если загрузился):",
  "Центр занимается реабилитацией и сопровождением детей: восстановление после травм и операций, работа с нарушениями осанки, координации и двигательных навыков — в том числе по направлениям невролога и ортопеда, в рамках рекомендованной ЛФК.",
  "Направления работы: лечебная физкультура (ЛФК) — подбор упражнений под возраст, состояние и рекомендации врача; детский массаж в составе комплекса — для снятия гипертонуса, улучшения кровообращения и подготовки к занятиям (не заменяет очный осмотр и назначения лечащего врача).",
  "Фокус — безопасная, поэтапная работа с ребёнком и семьёй в поддержку двигательного развития и качества жизни.",
].join("\n");

/**
 * Этот блок создаётся, чтобы модель не выдумывала юридический адрес и реквизиты, пока их нет в открытом доступе.
 */
const LEGAL_FACTS_NOTICE_RU =
  "Юридический адрес, почтовый адрес и реквизиты организации в этом чате не приводятся: они пока не опубликованы. Если спрашивают адрес или реквизиты — ответь вежливо, что точные юридические данные появятся на официальных материалах центра позже; не придумывай улицу, индекс, ОГРН и т.п. Для записи ориентируй на онлайн-запись через бота и сайт.";

/**
 * Этот блок превращает список новостей в короткий текст для контекста LLM (обрезка длины).
 */
function formatNewsForLlm(items) {
  const list = (items || []).slice(0, 12);
  if (!list.length) {
    return "Новостей в выгрузке нет.";
  }
  return list
    .map((n) => {
      const ex = (n.excerpt || "").replace(/\s+/g, " ").trim();
      const title = (n.title || "").replace(/\s+/g, " ").trim();
      const line = `${n.date || ""} — ${title}${ex ? `: ${ex}` : ""}`;
      return `- ${line.slice(0, 240)}`;
    })
    .join("\n");
}

/**
 * Этот блок сжимает свободные слоты по датам, чтобы не переполнять контекст при большом расписании.
 */
function formatSlotsForLlm(slots, maxDates = 8) {
  const free = (slots || []).filter((s) => s.status === "free");
  if (!free.length) {
    return "Свободных слотов в выгрузке нет.";
  }
  const byDate = new Map();
  for (const s of free) {
    if (!byDate.has(s.date)) byDate.set(s.date, []);
    byDate.get(s.date).push(s.time);
  }
  const dates = [...byDate.keys()].sort().slice(0, maxDates);
  return dates
    .map((d) => {
      const times = [...byDate.get(d)].sort().join(", ");
      return `${d}: ${times}`;
    })
    .join("; ");
}

/**
 * Этот блок собирает контекст для LLM и отдельно отдаёт сырые новости для показа в Telegram.
 * Раньше новости и специалисты грузились через Promise.all — при ошибке слотов/специалистов пропадали и новости.
 */
export async function buildLlmContext(apiBaseUrl, apiSecret) {
  let homeContentText = "";
  let homeLoadError = null;
  try {
    const home = await fetchPublicHomeContent(apiBaseUrl);
    homeContentText = formatHomeContentForLlm(home);
  } catch (e) {
    homeLoadError = e.message || String(e);
  }

  let siteNewsItems = [];
  let newsLoadError = null;
  try {
    siteNewsItems = await fetchPublicNews(apiBaseUrl);
  } catch (e) {
    newsLoadError = e.message || String(e);
  }

  let specialists = [];
  let specialistsLoadError = null;
  try {
    specialists = await fetchSpecialists(apiBaseUrl, apiSecret);
  } catch (e) {
    specialistsLoadError = e.message || String(e);
  }

  const slotsArrays = await Promise.all(
    specialists.map((sp) =>
      fetchSlots(apiBaseUrl, apiSecret, sp.id).catch(() => []),
    ),
  );

  const specLines = specialists.map((sp, i) => {
    const ln = sp.lastName || "";
    const fn = sp.firstName || "";
    const slotsText = formatSlotsForLlm(slotsArrays[i]);
    return `- ${ln} ${fn} (id: ${sp.id}) — свободные слоты: ${slotsText}`;
  });

  const orgSection = homeLoadError
    ? `Тексты главной страницы сайта не загрузились (${homeLoadError}). Ориентируйся на блок «О центре» выше; юридический адрес не выдумывай — см. примечание про реквизиты.`
    : homeContentText;

  const newsSection = newsLoadError
    ? `Ошибка загрузки новостей с сервера: ${newsLoadError}. Списка новостей нет — не выдумывай заголовки.`
    : formatNewsForLlm(siteNewsItems);

  const specSection = specialistsLoadError
    ? `Ошибка загрузки специалистов: ${specialistsLoadError}. Не придумывай врачей и расписание.`
    : specLines.length
      ? specLines.join("\n")
      : "Специалистов в выгрузке нет.";

  const bookingNote =
    "Записи по Telegram user id в базе не привязаны: запись через бота — гостевая, без личного кабинета. " +
    "На вопросы «какие у меня записи» отвечай, что точный список — в личном кабинете на сайте или по контактам клиники; не придумывай записи.";

  const dataContext = [
    "=== Данные из системы (опирайся только на них для фактов о центре) ===",
    "",
    TELEGRAM_BOT_PURPOSE_RU,
    "",
    CENTER_MISSION_RU,
    "",
    LEGAL_FACTS_NOTICE_RU,
    "",
    "Тексты с главной страницы сайта (публичные, подставляются из админки):",
    orgSection,
    "",
    "Новости:",
    newsSection,
    "",
    "Специалисты и актуальные свободные слоты:",
    specSection,
    "",
    bookingNote,
  ].join("\n");

  return { dataContext, siteNewsItems, newsLoadError };
}
