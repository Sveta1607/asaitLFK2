/**
 * Точка входа: загрузка .env, проверка токена и секрета API, проверка Telegram (getMe), запуск Telegraf.
 */

import fs from "fs";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { createBot } from "./src/bot.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Этот блок поднимает GET /health на 0.0.0.0 — на Amvera/Kubernetes часто обязательна «проба» по порту;
 * без слушающего сокета контейнер с long polling может бесконечно перезапускаться и «не отвечать» в Telegram.
 */
function startProbeHttpServer(port) {
  const server = http.createServer((req, res) => {
    const pathname = req.url?.split("?")[0] || "/";
    if (pathname === "/health" || pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("ok");
      return;
    }
    res.writeHead(404);
    res.end();
  });
  server.listen(port, "0.0.0.0", () => {
    console.log(`[telegram-bot] HTTP для пробы: http://0.0.0.0:${port}/health`);
  });
  server.on("error", (e) => {
    console.error("[telegram-bot] Не удалось открыть порт для пробы:", e.message);
    process.exit(1);
  });
}

/**
 * Читает .env в UTF-8 или UTF-16 (часто «Блокнот» сохраняет UTF-16 — тогда dotenv не видит переменные).
 */
function readEnvFileRaw(buf) {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return buf.slice(2).toString("utf16le");
  }
  let t = buf.toString("utf8");
  if (t.charCodeAt(0) === 0xfeff) {
    t = t.slice(1);
  }
  return t;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return false;
  }
  const parsed = dotenv.parse(readEnvFileRaw(fs.readFileSync(filePath)));
  Object.assign(process.env, parsed);
  return true;
}

const envPath = path.join(__dirname, ".env");
const envTxtPath = path.join(__dirname, ".env.txt");
if (!loadEnvFile(envPath)) {
  loadEnvFile(envTxtPath);
}

// Этот блок включается на хостингах с обязательной пробой порта — задайте BOT_HEALTH_PORT=8080 как в telegram-bot/amvera.yaml.
const probePortRaw = (process.env.BOT_HEALTH_PORT || "").trim();
if (probePortRaw) {
  const port = Number.parseInt(probePortRaw, 10);
  if (Number.isFinite(port) && port > 0 && port <= 65535) {
    startProbeHttpServer(port);
  }
}

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
if (!token) {
  console.error(
    "Задайте TELEGRAM_BOT_TOKEN (файл telegram-bot/.env локально или переменные окружения на Amvera).",
  );
  process.exit(1);
}

const apiSecret = process.env.TELEGRAM_BOT_API_SECRET?.trim();
if (!apiSecret) {
  console.error(
    "Задайте TELEGRAM_BOT_API_SECRET (тот же секрет, что TELEGRAM_BOT_API_SECRET в backend/.env) — в .env или в настройках приложения на хостинге.",
  );
  process.exit(1);
}

const apiBaseUrl = (process.env.API_BASE_URL || "http://127.0.0.1:3000").trim();

/** Ключ OpenAI для ассистента в чате (опционально: без него работает только запись /start). */
const openAiApiKey = (process.env.OPENAI_API_KEY || "").trim();
if (!openAiApiKey) {
  console.warn(
    "[telegram-bot] OPENAI_API_KEY не задан — ответы ассистента на свободные сообщения отключены.",
  );
}

const { bot } = createBot(token, { apiBaseUrl, apiSecret, openAiApiKey });

/**
 * Этот блок различает «битый токен» и обрыв сети до api.telegram.org — текст ошибки у fetch часто общий и вводит в заблуждение.
 */
function formatGetMeFailureHelp(err) {
  const raw = `${err?.message || err}${err?.response?.description || ""}`.toLowerCase();
  const isNetworkLikely =
    /tls|socket|disconnect|econnreset|etimedout|enotfound|network|timed out|fetch failed/i.test(raw) ||
    /before secure/i.test(raw);
  const isUnauthorized =
    /401|unauthorized|not valid/i.test(raw);

  let hint =
    "[telegram-bot] getMe не прошёл.\n" +
    "Техническое сообщение: " +
    String(err?.message || err).trim();
  if (isUnauthorized) {
    hint +=
      "\n\nПохоже на неверный или отозванный TELEGRAM_BOT_TOKEN (проверь в @BotFather).";
  } else if (isNetworkLikely) {
    hint +=
      "\n\nПохоже на проблему СЕТИ до api.telegram.org (обрыв на этапе TLS), а не обязательно на токене: " +
      "часто так бывает при блокировках, антивирусе, корпоративном фаерволе или нестабильном канале.\n" +
      "Что попробовать: другой Wi‑Fi/мобильный интернет, VPN, отключить лишние фильтры HTTPS, " +
      "или запустить бота на VPS за пределами блокировки. Клиент Telegram в браузере/телефоне к api.telegram.org не ходит — его работоспособность тут ни о чём не говорит.";
  } else {
    hint +=
      "\n\nЕсли есть VPN — включи и перезапусти бота. Если без VPN иногда доступен Telegram в приложении, бот всё равно ходит на api.telegram.org с твоего ПК — возможны блокировки только для API.";
  }
  return hint;
}

/**
 * Этот блок собирается в async: до polling проверить токен и сеть к Telegram иначе /start «мёртв» без понятной причины.
 */
async function startBot() {
  console.log("[telegram-bot] Проверка связи с Telegram (getMe)…");
  try {
    const me = await bot.telegram.getMe();
    console.log(`[telegram-bot] Токен ок: @${me.username ?? "(нет username)"} (${me.first_name ?? "bot"})`);
  } catch (e) {
    console.error(formatGetMeFailureHelp(e));
    process.exit(1);
  }

  // Этот блок снимает webhook вручную: при конфликте с другим хостингом long polling может не получать апдейты.
  try {
    const whBefore = await bot.telegram.getWebhookInfo();
    await bot.telegram.deleteWebhook({ drop_pending_updates: false });
    if ((whBefore?.url || "").trim()) {
      console.log(`[telegram-bot] Снят webhook (был: ${whBefore.url}). Используется long polling.`);
    }
  } catch (e) {
    console.warn("[telegram-bot] deleteWebhook:", e.message || e);
  }

  await bot.launch();
}

startBot()
  .then(async () => {
    console.log("Telegram-бот запущен (long polling)");
    console.log(`API: ${apiBaseUrl}`);

    try {
      const wh = await bot.telegram.getWebhookInfo();
      if ((wh?.url || "").trim()) {
        console.warn(
          `[telegram-bot] После удаления webhook URL всё ещё указан (${wh.url}) — возможен другой активный процесс с этим же токеном.`,
        );
      }
      if ((wh.pending_update_count ?? 0) > 0) {
        console.warn(`[telegram-bot] Необработанных апдейтов в очереди Telegram: ${wh.pending_update_count}`);
      }
    } catch (e) {
      console.warn("[telegram-bot] getWebhookInfo:", e.message || e);
    }

    const low = apiBaseUrl.toLowerCase();
    if (low.includes("127.0.0.1") || low.includes("localhost")) {
      console.warn(
        "[telegram-bot] API_BASE_URL указывает на эту машину. Если ссылку «Получить ссылку» выдаёт сайт на хостинге, " +
          "токен записан в БД на сервере, а бот ищет его здесь → в чате будет «ссылка недействительна». " +
          "Поставьте URL продакшен-API (как у nginx proxy к бэкенду).",
      );
    }
  })
  .catch((err) => {
    console.error("[telegram-bot] Не удалось запустить:", err.message || err);
    process.exit(1);
  });

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
