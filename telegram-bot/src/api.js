/**
 * Этот модуль создаётся, чтобы:
 * - ходить в FastAPI с заголовком секрета и получать тех же специалистов и слоты, что на сайте;
 * - создавать запись в общей таблице bookings.
 */

/** Таймаут HTTP к бэкенду (мс): без этого «вечный» fetch блокирует /start без ответа в чате. */
const FETCH_TIMEOUT_MS = Math.max(
  5000,
  Number.parseInt(process.env.API_FETCH_TIMEOUT_MS || "25000", 10) || 25000,
);

/**
 * Этот блок создаётся, чтобы обёртка fetch прерывалась по таймауту и пользователь получал текст ошибки, а не тишину.
 */
async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(tid);
  }
}

/** Разворачивает причину «fetch failed» (ECONNREFUSED и т.д.) в понятный текст для пользователя */
function explainNetworkError(err, requestUrl) {
  if (err?.name === "AbortError") {
    return `Таймаут запроса (${FETCH_TIMEOUT_MS} мс): ${requestUrl}`;
  }
  const cause = err?.cause;
  const code = cause?.code || err?.code;
  const baseHint =
    "Запустите API в отдельном окне: cd backend → python -m uvicorn main:app --host 127.0.0.1 --port 3000";
  if (code === "ECONNREFUSED") {
    return `Сервер не запущен или другой порт. ${baseHint}. В telegram-bot/.env укажите API_BASE_URL=http://127.0.0.1:ПОРТ (как в backend/.env PORT). Запрос: ${requestUrl}`;
  }
  if (code === "ENOTFOUND") {
    return `Неверный адрес в API_BASE_URL: ${requestUrl}`;
  }
  if (code === "ETIMEDOUT") {
    return `Таймаут соединения с ${requestUrl}`;
  }
  return `${err?.message || "fetch failed"}${code ? ` [${code}]` : ""} → ${requestUrl}`;
}

/** Общий fetch к API бота: один секрет в заголовке, как ожидает require_telegram_bot_secret */
async function apiFetch(apiBaseUrl, apiSecret, path, options = {}) {
  const base = apiBaseUrl.replace(/\/$/, "");
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = {
    "X-Telegram-Bot-Secret": apiSecret,
    "Content-Type": "application/json",
    ...options.headers,
  };
  let r;
  try {
    r = await fetchWithTimeout(url, { ...options, headers });
  } catch (err) {
    throw new Error(explainNetworkError(err, url));
  }
  const text = await r.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!r.ok) {
    let detail = text;
    if (data && typeof data === "object" && data.detail !== undefined) {
      const d = data.detail;
      detail =
        typeof d === "string"
          ? d
          : d?.detail ?? JSON.stringify(d);
      // Подсказка с сервера (например, про повторный запрос ссылки или разные БД у бота и сайта).
      if (typeof d === "object" && d?.hint) {
        detail = `${detail} — ${d.hint}`;
      }
    }
    throw new Error(`${r.status}: ${detail}`);
  }
  return data;
}

/**
 * Этот блок создаётся, чтобы загрузить тексты главной страницы с сайта (GET /api/site-content/home) —
 * без секрета бота, для ответов ассистента про организацию и направления центра.
 */
export async function fetchPublicHomeContent(apiBaseUrl) {
  const base = apiBaseUrl.replace(/\/$/, "");
  const url = `${base}/api/site-content/home`;
  let r;
  try {
    r = await fetchWithTimeout(url, { headers: { Accept: "application/json" } });
  } catch (err) {
    throw new Error(explainNetworkError(err, url));
  }
  const text = await r.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }
  if (!r.ok) {
    throw new Error(`${r.status}: ${text || "home content request failed"}`);
  }
  return typeof data === "object" && data !== null ? data : {};
}

/**
 * Этот блок создаётся, чтобы подтянуть новости центра без секрета бота (публичный GET /api/news).
 */
export async function fetchPublicNews(apiBaseUrl) {
  const base = apiBaseUrl.replace(/\/$/, "");
  const url = `${base}/api/news`;
  let r;
  try {
    r = await fetchWithTimeout(url, { headers: { Accept: "application/json" } });
  } catch (err) {
    throw new Error(explainNetworkError(err, url));
  }
  const text = await r.text();
  let data;
  try {
    data = text ? JSON.parse(text) : [];
  } catch {
    data = [];
  }
  if (!r.ok) {
    throw new Error(`${r.status}: ${text || "news request failed"}`);
  }
  return Array.isArray(data) ? data : [];
}

/** Список одобренных специалистов (как на сайте) */
export function fetchSpecialists(apiBaseUrl, apiSecret) {
  return apiFetch(apiBaseUrl, apiSecret, "/api/telegram/specialists");
}

/** Свободные слоты; date — опционально YYYY-MM-DD */
export function fetchSlots(apiBaseUrl, apiSecret, specialistId, date) {
  const q = new URLSearchParams({ specialistId });
  if (date) q.set("date", date);
  return apiFetch(apiBaseUrl, apiSecret, `/api/telegram/slots?${q}`);
}

/** Создание записи гостя (user_id NULL в БД) */
export function createBooking(apiBaseUrl, apiSecret, body) {
  return apiFetch(apiBaseUrl, apiSecret, "/api/telegram/bookings", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * Привязка личного чата специалиста к профилю после deep link ?start=link_<token>.
 * Вызывается из обработчика /start, чтобы сервер записал telegram_chat_id у специалиста.
 */
export function linkTelegramChat(apiBaseUrl, apiSecret, token, chatId) {
  // Hex-токен из БД — только a-f; подписанный токен (base64url) чувствителен к регистру.
  const raw = String(token || "").trim();
  const bodyToken = /^[a-fA-F0-9]{32}$/.test(raw) ? raw.toLowerCase() : raw;
  return apiFetch(apiBaseUrl, apiSecret, "/api/telegram/link-chat", {
    method: "POST",
    body: JSON.stringify({ token: bodyToken, chatId: String(chatId) }),
  });
}
