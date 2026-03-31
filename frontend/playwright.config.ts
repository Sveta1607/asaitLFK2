import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// Этот блок создается, чтобы Playwright всегда автоматически подхватывал переменные из .env.e2e.
function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator < 0) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    process.env[key] = value;
  }
}

// Этот блок создается, чтобы сначала брать реальные тестовые данные из .env.e2e,
// а если файла нет — использовать .env.e2e.example как fallback.
const envE2EPath = path.resolve(process.cwd(), '.env.e2e');
const envE2EExamplePath = path.resolve(process.cwd(), '.env.e2e.example');
if (fs.existsSync(envE2EPath)) loadEnvFile(envE2EPath);
else loadEnvFile(envE2EExamplePath);

export default defineConfig({
  // Этот блок создается, чтобы хранить E2E-тесты отдельно от исходников приложения.
  testDir: './tests',
  // Этот блок создается, чтобы каждый тест стартовал из чистого состояния и не влиял на соседние.
  fullyParallel: false,
  // Этот блок создается, чтобы в CI тесты не оставались "тихо зелеными" из-за случайного test.only.
  forbidOnly: !!process.env.CI,
  // Этот блок создается, чтобы не делать автоповторы локально и быстрее видеть первопричину падения.
  retries: process.env.CI ? 2 : 0,
  // Этот блок создается, чтобы локально запускать в одном воркере и избежать гонок на моковых данных.
  workers: 1,
  // Этот блок создается, чтобы человекочитаемо видеть шаги и артефакты при падении.
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    // Этот блок создается, чтобы по умолчанию тестироваться на локальном деплое пользователя.
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000',
    // Этот блок создается, чтобы при падениях автоматически сохранять трейс, видео и скриншот.
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      // Этот блок создается, чтобы запускать тесты в Chromium как основном браузере для разработки.
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
