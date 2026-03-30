/**
 * Этот модуль создаётся, чтобы:
 * - ходить в FastAPI с заголовком секрета и получать тех же специалистов и слоты, что на сайте;
 * - создавать запись в общей таблице bookings.
 */

/** Разворачивает причину «fetch failed» (ECONNREFUSED и т.д.) в понятный текст для пользователя */
function explainNetworkError(err, requestUrl) {
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
    r = await fetch(url, { ...options, headers });
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
  // Приведение к нижнему регистру: на сервере токен хранится как от secrets.token_hex (a-f, 0-9).
  const normalized = String(token || "").trim().toLowerCase();
  return apiFetch(apiBaseUrl, apiSecret, "/api/telegram/link-chat", {
    method: "POST",
    body: JSON.stringify({ token: normalized, chatId: String(chatId) }),
  });
}
