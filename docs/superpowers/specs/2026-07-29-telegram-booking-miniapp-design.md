# Telegram Mini App для записи клиентов — дизайн

Дата: 2026-07-29
Статус: черновик, ожидает ревью пользователя

## 1. Контекст и рамки MVP

Одна Telegram Mini App для одного барбершопа/салона (не мультитенант). Единый общий график без привязки услуг/записей к конкретному мастеру (в этой версии — нет сущности "мастер"). Клиент выбирает услугу → дату/время → подтверждает запись. Клиент может сам отменить свою запись. Владелец бизнеса получает уведомления о новых записях в отдельный чат и управляет услугами/просматривает записи через админ-панель внутри той же Mini App (доступ по роли).

Стек: React + TypeScript + Vite + `@telegram-apps/sdk-react` (frontend); Node.js + Express + TypeScript (backend); Supabase Postgres (БД); Vercel + Railway/Render (хостинг, деплой пользователь делает сам).

Вне рамок MVP: мультитенантность, несколько мастеров/сотрудников, онлайн-оплата, UI-управление ролями (роль администратора выставляется вручную в БД), push-напоминания о предстоящей записи (только уведомление в момент создания).

## 2. Архитектура и поток данных

Telegram Mini App открывается внутри клиента Telegram → SDK отдаёт `initDataRaw` и `themeParams` → фронтенд шлёт `initDataRaw` в заголовке с каждым запросом к backend → backend валидирует HMAC-SHA256 подпись `initData` секретом бота на **каждый** запрос (сессий/JWT нет — Telegram переподписывает initData при каждом открытии, этого достаточно для MVP) → после валидации backend делает upsert пользователя в `users` по `telegram_id` и кладёт `req.user` (id, role) в контекст запроса → backend читает/пишет в Supabase Postgres напрямую через `pg` (без ORM — нужен явный контроль над транзакциями и EXCLUDE constraint) → уведомления о новой записи отправляются через Telegram Bot API (`sendMessage`) синхронно в рамках запроса создания брони, ошибки отправки не откатывают бронь (best-effort, логируются).

Фронтенд не передаёт `user_id`/имя с клиента напрямую в теле запроса брони — backend берёт их только из провалидированного `initData`.

## 3. Схема данных (Supabase Postgres)

Расширение `btree_gist` включается в миграции (`CREATE EXTENSION IF NOT EXISTS btree_gist;`) — нужно для EXCLUDE constraint на диапазоны времени.

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  username TEXT,
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE services (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  duration_minutes INT NOT NULL CHECK (duration_minutes > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE business_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- ровно одна строка
  working_hours JSONB NOT NULL, -- {"mon": {"start":"09:00","end":"20:00"}, "sun": {"is_closed": true}, ...}
  slot_interval_minutes INT NOT NULL DEFAULT 30,
  booking_horizon_days INT NOT NULL DEFAULT 14, -- на сколько дней вперёд открыт календарь
  owner_chat_id BIGINT, -- куда слать уведомления о новых записях
  timezone TEXT NOT NULL DEFAULT 'Europe/Moscow',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE bookings (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  service_id BIGINT NOT NULL REFERENCES services(id),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT no_overlapping_bookings EXCLUDE USING gist (
    tstzrange(starts_at, ends_at) WITH &&
  ) WHERE (status = 'confirmed')
);

-- обязательный seed: без этой строки /api/slots не сможет работать
INSERT INTO business_settings (id, working_hours, slot_interval_minutes, booking_horizon_days, timezone)
VALUES (
  1,
  '{"mon":{"start":"09:00","end":"20:00"},"tue":{"start":"09:00","end":"20:00"},"wed":{"start":"09:00","end":"20:00"},"thu":{"start":"09:00","end":"20:00"},"fri":{"start":"09:00","end":"20:00"},"sat":{"start":"10:00","end":"18:00"},"sun":{"is_closed":true}}'::jsonb,
  30,
  14,
  'Europe/Moscow'
)
ON CONFLICT (id) DO NOTHING;
```

`owner_chat_id` в seed сознательно не указан (`NULL`) — его подставит пользователь после того, как узнает свой `chat_id` через `getUpdates` (см. раздел 7); пока он `NULL`, отправка уведомления владельцу просто пропускается (best-effort).

`ends_at` фиксируется на момент создания брони как `starts_at + duration_minutes` услуги, действовавшей на тот момент (не пересчитывается, если позже поменяют цену/длительность услуги — это ожидаемо, историческая запись не должна "плыть").

## 4. Backend API

Middleware `validateInitData` применяется ко всем `/api/*` роутам:
1. Достаёт `initData` из заголовка `Authorization: tma <initDataRaw>` (формат, рекомендованный Telegram).
2. Проверяет HMAC-SHA256 подпись секретом, производным от `BOT_TOKEN`.
3. Отклоняет (401), если подпись неверна или `auth_date` старше 24 часов (защита от replay).
4. Делает upsert в `users` по `telegram_id`, кладёт `req.user`.

Роуты:

| Метод | Путь | Доступ | Назначение |
|---|---|---|---|
| GET | `/api/services` | любой валидный пользователь | список активных услуг |
| GET | `/api/slots?date=&service_id=` | любой валидный пользователь | доступные слоты на дату для услуги (генерация на лету) |
| POST | `/api/bookings` | любой валидный пользователь | создать бронь; 409 при конфликте слота (EXCLUDE constraint) |
| GET | `/api/bookings/my` | любой валидный пользователь | список своих броней |
| PATCH | `/api/bookings/:id/cancel` | владелец брони | отменить свою бронь (`status → 'cancelled'`) |
| GET | `/api/admin/bookings?date=` | role=admin | все брони на дату |
| POST/PATCH/DELETE | `/api/admin/services` | role=admin | CRUD услуг (DELETE = `is_active=false`) |
| GET/PATCH | `/api/admin/settings` | role=admin | рабочие часы, `owner_chat_id`, интервал слотов |

**Генерация слотов** (`GET /api/slots`): взять `working_hours` для дня недели даты → сгенерировать сетку стартов с шагом `slot_interval_minutes` в границах рабочего окна → отфильтровать те, для которых `[start, start + service.duration_minutes)` пересекается с существующей `confirmed`-бронью, выходит за рабочее окно, или уже в прошлом (для сегодняшней даты). Слоты не хранятся в БД — считаются на каждый запрос из `business_settings` + `bookings`.

**Уведомления** (`services/telegramNotify.ts`): после успешного `INSERT` в `bookings` — `sendMessage` клиенту (`users.telegram_id`) с текстом "Вы записаны на {услуга} {дата} {время}" и `sendMessage` в `business_settings.owner_chat_id` с деталями новой записи и именем клиента. Обе отправки оборачиваются в try/catch — сбой Telegram API логируется, но не влияет на HTTP-ответ клиенту (бронь уже создана).

## 5. Frontend

Инициализация SDK в корне приложения: чтение `initDataRaw` (хранится для использования в заголовках запросов) и `themeParams` → проброс в CSS-переменные (`--tg-theme-bg-color`, `--tg-theme-text-color`, ...), вся вёрстка использует их вместо хардкод-цветов.

Навигация — React Router, стек экранов с `BackButton` из SDK вместо кастомных кнопок "назад"; `MainButton` используется для основных действий на экране (когда уместно) вместо кастомных primary-кнопок.

Экраны:
1. `/` — список услуг (карточки: название, цена, длительность). `MainButton` скрыт.
2. `/booking/:serviceId` — календарь на `booking_horizon_days` дней + сетка слотов на выбранную дату. `BackButton` активен. `MainButton` = "Продолжить" (активна при выбранном слоте).
3. `/booking/:serviceId/confirm` — подтверждение: имя из initData (нередактируемо), услуга, дата/время. `MainButton` = "Записаться" → `POST /api/bookings`; при 409 — уведомление и возврат к выбору времени; при успехе — переход на `/my-bookings`.
4. `/my-bookings` — список своих броней (будущие/прошедшие), кнопка "Отменить" на будущих `confirmed`.
5. `/admin` — только если `role === 'admin'` (иначе редирект на `/`): вкладки "Записи на день" (таблица броней по дате) и "Услуги" (CRUD).

Data-fetching через `@tanstack/react-query` (кэш, инвалидация после мутаций вместо ручных useState/useEffect).

## 6. Структура проекта

```
backend/
├── src/
│   ├── index.ts
│   ├── db.ts
│   ├── config.ts
│   ├── middleware/
│   │   ├── validateInitData.ts
│   │   └── requireAdmin.ts
│   ├── routes/
│   │   ├── services.ts
│   │   ├── slots.ts
│   │   ├── bookings.ts
│   │   └── admin/
│   │       ├── bookings.ts
│   │       ├── services.ts
│   │       └── settings.ts
│   ├── services/
│   │   ├── slotGenerator.ts
│   │   ├── bookingService.ts
│   │   └── telegramNotify.ts
│   └── types.ts
├── migrations/
│   └── 001_init.sql
├── .env.example
├── package.json
└── tsconfig.json

frontend/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── api/
│   │   ├── client.ts
│   │   ├── services.ts
│   │   ├── bookings.ts
│   │   └── admin.ts
│   ├── hooks/
│   │   ├── useTelegramTheme.ts
│   │   ├── useMainButton.ts
│   │   └── useBackButton.ts
│   ├── pages/
│   │   ├── ServicesList/
│   │   ├── BookingFlow/
│   │   ├── MyBookings/
│   │   └── Admin/
│   │       ├── AdminBookings/
│   │       └── AdminServices/
│   ├── components/
│   ├── types.ts
│   └── theme.css
├── .env.example
├── package.json
├── vite.config.ts
└── tsconfig.json
```

`types.ts` дублируется между frontend и backend (без общего shared-пакета) — сознательное упрощение для MVP.

## 7. Локальный запуск и деплой

Реальный деплой на Vercel/Railway/Supabase и создание бота через BotFather выполняет пользователь самостоятельно — у ассистента нет доступа к его аккаунтам. План работ включает:
- README с пошаговыми инструкциями: создание бота в BotFather, получение `owner_chat_id` (через `getUpdates` после отправки любого сообщения боту), настройка Supabase-проекта и применение `migrations/001_init.sql`, настройка `.env` для backend и frontend, деплой backend на Railway/Render и frontend на Vercel, настройка Mini App URL в BotFather (`/setmenubutton` или `/newapp`).
- Помощь с локальным запуском (`npm install`, dev-сервер backend и frontend) для проверки работы до деплоя — здесь возможна практическая проверка функционала.

## 8. Защита от гонок при бронировании

Вариант с проверкой пересечений на уровне приложения (SELECT → INSERT) отклонён из-за теоретической гонки при параллельных запросах на один слот. Вместо этого — `EXCLUDE USING gist` constraint на `bookings` (раздел 3): база физически не допускает пересекающиеся `confirmed`-брони, INSERT падает с ошибкой уникальности, которую backend превращает в HTTP 409.
