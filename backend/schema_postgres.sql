-- Тип перечисления для ролей пользователей (гарантирует фиксированный набор ролей patient/specialist)
CREATE TYPE user_role AS ENUM ('patient', 'specialist');

-- Тип перечисления для статуса слота (управляет жизненным циклом временного интервала приёма)
CREATE TYPE slot_status AS ENUM ('open', 'booked', 'cancelled', 'closed');

-- Тип перечисления для статуса бронирования (отслеживает состояние записи пациента на приём)
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');

-- Таблица пользователей (пациенты и специалисты в одной сущности с разделением по роли)
CREATE TABLE users (
    id            BIGSERIAL   PRIMARY KEY,
    email         VARCHAR(255) NOT NULL UNIQUE,
    phone         VARCHAR(32),
    password_hash TEXT        NOT NULL,
    full_name     VARCHAR(255) NOT NULL,
    role          user_role   NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Индексы по пользователям (ускоряют выборки по роли и email)
CREATE INDEX idx_users_role ON users (role);

-- Таблица новостей, привязанная к специалисту (для публикаций и анонсов от конкретного врача ЛФК)
CREATE TABLE news (
    id            BIGSERIAL   PRIMARY KEY,
    specialist_id BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title         VARCHAR(255) NOT NULL,
    body          TEXT        NOT NULL,
    published_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Индексы по новостям (быстрый доступ к новостям специалиста и сортировка по дате)
CREATE INDEX idx_news_specialist_id ON news (specialist_id);
CREATE INDEX idx_news_published_at ON news (published_at DESC);

-- Таблица слотов приёма (временные интервалы, в которые специалист доступен для записи)
CREATE TABLE slots (
    id            BIGSERIAL   PRIMARY KEY,
    specialist_id BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    start_time    TIMESTAMPTZ NOT NULL,
    end_time      TIMESTAMPTZ NOT NULL,
    status        slot_status NOT NULL DEFAULT 'open',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (end_time > start_time)
);

-- Ограничение уникальности слотов (не допускает дубликаты временных интервалов одного специалиста)
ALTER TABLE slots
    ADD CONSTRAINT uq_slots_specialist_time UNIQUE (specialist_id, start_time, end_time);

-- Индексы по слотам (ускоряют выборку слотов по специалисту и дате начала)
CREATE INDEX idx_slots_specialist_start ON slots (specialist_id, start_time);

-- Таблица бронирований (конкретные записи пациентов на выбранные слоты)
CREATE TABLE bookings (
    id          BIGSERIAL      PRIMARY KEY,
    slot_id     BIGINT         NOT NULL REFERENCES slots (id) ON DELETE CASCADE,
    patient_id  BIGINT         NOT NULL REFERENCES users (id),
    status      booking_status NOT NULL DEFAULT 'pending',
    comment     TEXT,
    created_at  TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ    NOT NULL DEFAULT now(),
    UNIQUE (slot_id)
);

-- Индексы по бронированиям (быстрый поиск записей по пациенту и статусу)
CREATE INDEX idx_bookings_patient_id ON bookings (patient_id);
CREATE INDEX idx_bookings_status ON bookings (status);

