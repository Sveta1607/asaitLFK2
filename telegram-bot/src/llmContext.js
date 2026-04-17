/**
 * Этот модуль создаётся, чтобы собрать факты из API центра (новости, специалисты, свободные слоты)
 * и передать их модели — так она реже выдумывает расписание и заголовки новостей.
 */

import { fetchPublicNews, fetchSpecialists, fetchSlots } from "./api.js";

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
 * Этот блок собирает итоговую строку контекста: новости, врачи, слоты и правило про «мои записи».
 */
export async function buildLlmContext(apiBaseUrl, apiSecret) {
  const [news, specialists] = await Promise.all([
    fetchPublicNews(apiBaseUrl),
    fetchSpecialists(apiBaseUrl, apiSecret),
  ]);

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

  const bookingNote =
    "Записи по Telegram user id в базе не привязаны: запись через бота — гостевая, без личного кабинета. " +
    "На вопросы «какие у меня записи» отвечай, что точный список — в личном кабинете на сайте или по контактам клиники; не придумывай записи.";

  return [
    "=== Данные из системы (опирайся только на них для фактов о центре) ===",
    "",
    "Новости:",
    formatNewsForLlm(news),
    "",
    "Специалисты и актуальные свободные слоты:",
    specLines.length ? specLines.join("\n") : "Специалистов в выгрузке нет.",
    "",
    bookingNote,
  ].join("\n");
}
