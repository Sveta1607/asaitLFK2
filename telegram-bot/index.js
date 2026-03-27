/**
 * Точка входа: загрузка .env, проверка токена и секрета API, запуск Telegraf.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { createBot } from "./src/bot.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
if (!token) {
  console.error("Задайте TELEGRAM_BOT_TOKEN в файле telegram-bot/.env");
  process.exit(1);
}

const apiSecret = process.env.TELEGRAM_BOT_API_SECRET?.trim();
if (!apiSecret) {
  console.error(
    "Задайте TELEGRAM_BOT_API_SECRET в telegram-bot/.env (тот же секрет, что TELEGRAM_BOT_API_SECRET в backend/.env)",
  );
  process.exit(1);
}

const apiBaseUrl = (process.env.API_BASE_URL || "http://127.0.0.1:3000").trim();

const { bot } = createBot(token, { apiBaseUrl, apiSecret });

bot.launch().then(() => {
  console.log("Telegram-бот запущен (long polling)");
  console.log(`API: ${apiBaseUrl}`);
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
