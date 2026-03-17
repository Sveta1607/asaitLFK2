-- RLS-политики для Postgres
-- Этот файл создаётся, чтобы:
-- - документировать способ передачи текущего пользователя в Postgres (session variables);
-- - описать политики RLS для таблиц users, slots, bookings, news;
-- - использовать структуру из db_models (id VARCHAR, clerk_id, role, user_id/specialist_id в bookings).

-- Перед выполнением убедитесь, что таблицы созданы (через SQLAlchemy create_all или schema_postgres.sql).
-- Структура users: id VARCHAR PRIMARY KEY, clerk_id VARCHAR, email, username, role, ...

-- 1. Создаём schema app для хранения функций (если её нет)
CREATE SCHEMA IF NOT EXISTS app;

-- 2. Функция для получения текущего user_id из session variable
-- Backend перед запросами вызывает: SELECT set_config('app.current_user_id', 'u-1', true);
-- и set_config('app.current_role', 'user', true);
CREATE OR REPLACE FUNCTION app.current_user_id() RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '');
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION app.current_role() RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('app.current_role', true), '');
$$ LANGUAGE sql STABLE;

-- 3. RLS для таблицы users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Пользователь может читать только свой профиль; admin — всех
DROP POLICY IF EXISTS users_select_policy ON users;
CREATE POLICY users_select_policy ON users FOR SELECT
  USING (
    id = app.current_user_id()
    OR app.current_role() = 'superuser'
  );

-- Пользователь может обновлять только свой профиль (кроме role)
DROP POLICY IF EXISTS users_update_policy ON users;
CREATE POLICY users_update_policy ON users FOR UPDATE
  USING (id = app.current_user_id())
  WITH CHECK (id = app.current_user_id());

-- Superuser может всё
DROP POLICY IF EXISTS users_admin_policy ON users;
CREATE POLICY users_admin_policy ON users FOR ALL
  USING (app.current_role() = 'superuser');

-- 4. RLS для таблицы slots
ALTER TABLE slots ENABLE ROW LEVEL SECURITY;

-- Пользователь видит слоты (пациент — все, специалист — свои)
DROP POLICY IF EXISTS slots_select_policy ON slots;
CREATE POLICY slots_select_policy ON slots FOR SELECT
  USING (
    app.current_role() = 'superuser'
    OR specialist_id = app.current_user_id()
    OR app.current_user_id() IS NOT NULL
  );

-- Только специалист может создавать/обновлять/удалять свои слоты
DROP POLICY IF EXISTS slots_insert_policy ON slots;
CREATE POLICY slots_insert_policy ON slots FOR INSERT
  WITH CHECK (
    app.current_role() IN ('specialist', 'superuser')
    AND (specialist_id = app.current_user_id() OR app.current_role() = 'superuser')
  );

DROP POLICY IF EXISTS slots_update_delete_policy ON slots;
CREATE POLICY slots_update_delete_policy ON slots FOR ALL
  USING (
    app.current_role() = 'superuser'
    OR (app.current_role() = 'specialist' AND specialist_id = app.current_user_id())
  );

-- 5. RLS для таблицы bookings
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Пациент видит свои записи; специалист — записи к себе; admin — всё
DROP POLICY IF EXISTS bookings_select_policy ON bookings;
CREATE POLICY bookings_select_policy ON bookings FOR SELECT
  USING (
    app.current_role() = 'superuser'
    OR user_id = app.current_user_id()
    OR specialist_id = app.current_user_id()
  );

-- Пациент создаёт запись с user_id = current_user; специалист создаёт без user_id
DROP POLICY IF EXISTS bookings_insert_policy ON bookings;
CREATE POLICY bookings_insert_policy ON bookings FOR INSERT
  WITH CHECK (
    app.current_role() = 'superuser'
    OR (user_id = app.current_user_id() AND app.current_role() = 'user')
    OR (specialist_id = app.current_user_id() AND app.current_role() = 'specialist')
  );

DROP POLICY IF EXISTS bookings_update_policy ON bookings;
CREATE POLICY bookings_update_policy ON bookings FOR UPDATE
  USING (
    app.current_role() = 'superuser'
    OR user_id = app.current_user_id()
    OR specialist_id = app.current_user_id()
  );

-- 6. RLS для таблицы news
ALTER TABLE news ENABLE ROW LEVEL SECURITY;

-- Публичное чтение новостей
DROP POLICY IF EXISTS news_select_policy ON news;
CREATE POLICY news_select_policy ON news FOR SELECT
  USING (true);

-- Только специалист может создавать/редактировать свои новости
DROP POLICY IF EXISTS news_insert_policy ON news;
CREATE POLICY news_insert_policy ON news FOR INSERT
  WITH CHECK (
    app.current_role() IN ('specialist', 'superuser')
    AND (specialist_id = app.current_user_id() OR app.current_role() = 'superuser')
  );

DROP POLICY IF EXISTS news_update_delete_policy ON news;
CREATE POLICY news_update_delete_policy ON news FOR ALL
  USING (
    app.current_role() = 'superuser'
    OR specialist_id = app.current_user_id()
  );

-- ВАЖНО: backend должен вызывать перед выполнением запросов для авторизованного пользователя:
--   db.execute(text("SELECT set_config('app.current_user_id', :uid, true)"), {"uid": str(user.id)})
--   db.execute(text("SELECT set_config('app.current_role', :role, true)"), {"role": user.role})
-- (применяется в auth_deps.get_current_user и пробрасывается в обработчики)
