/**
 * Этот модуль создаётся, чтобы подтянуть заголовки открытых публикаций (RSS Google News)
 * и передать их в LLM — без собственного «придумывания» новостей.
 */

import Parser from "rss-parser";

/** User-Agent браузера — часть RSS-серверов отдаёт пустой ответ без «нормального» клиента. */
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

/**
 * Этот блок собирает поисковую строку: формулировка пользователя плюс опорные термины темы центра.
 */
function buildRssSearchQuery(userText) {
  const base = (userText || "").replace(/\s+/g, " ").trim().slice(0, 120);
  const tail = "дети ЛФК реабилитация физическая терапия";
  if (!base) {
    return tail;
  }
  return `${base} ${tail}`;
}

/**
 * Этот блок загружает RSS и формирует текстовый блок для контекста модели (заголовки, ссылки, краткие подписи).
 */
export async function fetchInternetNewsContextForLlm(userText) {
  const q = buildRssSearchQuery(userText);
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=ru&gl=RU&ceid=RU:ru`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": BROWSER_UA,
      Accept: "application/rss+xml, application/xml, text/xml, */*",
    },
  });
  if (!res.ok) {
    throw new Error(`Не удалось загрузить ленту новостей (код ${res.status}).`);
  }
  const xml = await res.text();
  const parser = new Parser({ timeout: 20000 });
  const feed = await parser.parseString(xml);
  const items = (feed.items || []).slice(0, 10);
  if (!items.length) {
    return "В выгрузке RSS сейчас нет материалов по этому запросу. Не придумывай статьи и ссылки.";
  }
  const lines = items.map((it, i) => {
    const title = (it.title || "").replace(/\s+/g, " ").trim();
    const link = (it.link || "").trim();
    const pub = (it.pubDate || it.isoDate || "").trim();
    const snip = (it.contentSnippet || it.summary || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 450);
    const snipLine = snip ? `\nПодпись: ${snip}` : "";
    return `[${i + 1}] ${pub} | ${title}\nURL: ${link}${snipLine}`;
  });
  return [
    "Источник агрегатора: Google News (RSS). Это открытые заголовки и ссылки, не сайт клиники.",
    "",
    ...lines,
  ].join("\n\n");
}
