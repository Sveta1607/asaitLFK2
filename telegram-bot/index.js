/**
 * Точка входа: загрузка .env из папки telegram-bot, проверка токена, запуск long polling.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { createBot } from "./src/bot.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Поддержка .env.txt: на Windows часто сохраняют так по ошибке вместо .env
const envPath = path.join(__dirname, ".env");
const envTxtPath = path.join(__dirname, ".env.txt");
const envFile = fs.existsSync(envPath)
  ? envPath
  : fs.existsSync(envTxtPath)
    ? envTxtPath
    : envPath;
dotenv.config({ path: envFile });

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
if (!token) {
  console.error(
    "Задайте TELEGRAM_BOT_TOKEN в файле .env в папке telegram-bot (одна строка: TELEGRAM_BOT_TOKEN=токен). Если файл назван .env.txt — переименуйте в .env.",
  );
  process.exit(1);
}

const { bot } = createBot(token);

bot.launch().then(() => {
  console.log("Telegram-бот запущен (long polling)");
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
