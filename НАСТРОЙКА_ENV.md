# Пошаговая настройка .env (фронтенд и бэкенд)

Инструкция для новичков: что вписать в файлы окружения для работы с Clerk.

---

## Часть 1. Получить данные из Clerk Dashboard

1. Откройте в браузере: **https://dashboard.clerk.com**
2. Войдите или зарегистрируйтесь.
3. Выберите своё приложение (или создайте новое: **Create application**).
4. В левом меню откройте **Configure** → **API Keys** (или сразу **API Keys**).
5. На странице найдите и скопируйте:
   - **Publishable key** — строка вида `pk_test_...` или `pk_live_...`
   - **Frontend API URL** — ссылка вида `https://что-то.clerk.accounts.dev` (может быть в том же блоке или в Domains).

Если **Frontend API URL** не видно:
   - Зайдите в **Configure** → **Domains** и посмотрите домен приложения.
   - Или скопируйте домен из самой строки Publishable key (иногда там видно имя инстанса).

6. Сформируйте JWKS-ссылку для бэкенда:
   - Возьмите Frontend API URL, например: `https://expert-fowl-90.clerk.accounts.dev`
   - Добавьте в конец: `/.well-known/jwks.json`
   - Итого: `https://expert-fowl-90.clerk.accounts.dev/.well-known/jwks.json` — это и есть **CLERK_JWKS_URL**.

---

## Часть 2. Фронтенд (папка `frontend`)

1. Откройте файл **`frontend/.env`** в редакторе.
2. Должны быть строки:

```env
# URL бэкенда API
VITE_API_URL=http://127.0.0.1:3000/api

# Ключ Clerk: вставьте сюда Publishable key из Clerk Dashboard (API Keys)
VITE_CLERK_PUBLISHABLE_KEY=pk_test_XXXXXXXXXXXX
```

3. Вместо `pk_test_XXXXXXXXXXXX` вставьте **свой** Publishable key из шага 1 (целиком, без пробелов).
4. Сохраните файл.

**Итого во фронтенде нужно:**
- `VITE_API_URL` — уже стоит, не трогайте, если бэкенд на порту 3000.
- `VITE_CLERK_PUBLISHABLE_KEY` — один ключ из Clerk (Publishable key).

---

## Часть 3. Бэкенд (папка `backend`)

1. Откройте файл **`backend/.env`** в редакторе.
2. В конец файла добавьте две строки (подставьте свой JWKS URL и свой домен Clerk):

```env
# Clerk: ссылка на ключи для проверки JWT (получите в Dashboard → API Keys / Domains)
CLERK_JWKS_URL=https://ВАШ-ДОМЕН.clerk.accounts.dev/.well-known/jwks.json

# Домен Clerk (как в JWKS URL, но без пути) — опционально
CLERK_ISSUER=https://ВАШ-ДОМЕН.clerk.accounts.dev
```

3. Замените **`ВАШ-ДОМЕН`** на реальный домен из Clerk.  
   Пример: если у вас `https://expert-fowl-90.clerk.accounts.dev`, то:
   - `CLERK_JWKS_URL=https://expert-fowl-90.clerk.accounts.dev/.well-known/jwks.json`
   - `CLERK_ISSUER=https://expert-fowl-90.clerk.accounts.dev`
4. Сохраните файл.

**Итого в бэкенде нужно:**
- `CLERK_JWKS_URL` — обязательная строка (Frontend API URL + `/.well-known/jwks.json`).
- `CLERK_ISSUER` — желательная (тот же URL без пути).

---

## Часть 4. Проверка

1. Не коммитьте файлы **`.env`** в git (они уже в .gitignore).
2. Перезапустите бэкенд и фронтенд.
3. Откройте сайт, нажмите «Войти» или «Регистрация» — должна открыться форма Clerk.

Если что-то не работает:
- Проверьте, что во фронтенде переменная называется именно **VITE_CLERK_PUBLISHABLE_KEY** (не NEXT_PUBLIC_...).
- Проверьте, что в **CLERK_JWKS_URL** нет лишних пробелов и путь заканчивается на `/.well-known/jwks.json`.
