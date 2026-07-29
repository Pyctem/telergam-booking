# Telegram Booking Mini App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Telegram Mini App (React + TS frontend, Express + TS backend, Supabase Postgres) letting clients book services from a single salon/barbershop, with Telegram-verified auth, dynamic slot generation, notifications, and an admin panel.

**Architecture:** Backend validates Telegram `initData` (HMAC-SHA256) on every request, upserts the user, and serves REST endpoints backed by Postgres (`pg` driver, no ORM). Slots are computed on the fly from `business_settings.working_hours` and existing `bookings`, never stored. A Postgres `EXCLUDE` constraint (`btree_gist`) prevents overlapping bookings at the database level. Frontend is a single-page Mini App using `@telegram-apps/sdk-react` for theme/`MainButton`/`BackButton`, React Router for a screen stack, and React Query for data fetching.

**Tech Stack:** React 18, TypeScript, Vite, `@telegram-apps/sdk-react`, `@tanstack/react-query`, `react-router-dom`, Node.js, Express, `pg`, `luxon`, `zod`, Supabase Postgres, Vitest, Supertest, `@testing-library/react`.

## Global Constraints

- Backend must validate `initData` via HMAC-SHA256 on every `/api/*` request; never trust `user_id`/name from the request body (design spec §2, §4).
- `bookings.user_id` and identity always come from validated `initData`, not client-supplied fields (spec §2).
- Double-booking prevention is enforced via Postgres `EXCLUDE USING gist` on `bookings`, not application-level checks (spec §8).
- Slots are generated dynamically per request from `business_settings` + `bookings`; no slots table (spec §4).
- Frontend must read Telegram `themeParams` and drive all colors from CSS variables — no hardcoded colors (spec §5).
- Use `MainButton`/`BackButton` from the SDK for primary navigation actions on client-facing screens (spec §5); the `/admin` screen is exempt (spec §5, item 5).
- No mastering/staff entity, no multitenancy, no online payment, no UI role management in this MVP (spec §1).
- TypeScript strict mode on both frontend and backend.
- Node.js 20+.

---

## File Structure Overview

```
backend/
├── src/
│   ├── index.ts
│   ├── app.ts                   # Express app assembly (separate from listen(), for supertest)
│   ├── db.ts
│   ├── config.ts
│   ├── types.ts
│   ├── middleware/
│   │   ├── validateInitData.ts
│   │   └── requireAdmin.ts
│   ├── lib/
│   │   ├── telegramAuth.ts      # pure HMAC validation
│   │   └── slotGenerator.ts     # pure slot generation
│   ├── routes/
│   │   ├── services.ts
│   │   ├── slots.ts
│   │   ├── bookings.ts
│   │   └── admin/
│   │       ├── bookings.ts
│   │       ├── services.ts
│   │       └── settings.ts
│   └── services/
│       ├── bookingService.ts
│       └── telegramNotify.ts
├── migrations/
│   └── 001_init.sql
├── scripts/
│   └── migrate.ts
├── tests/
│   ├── setup.ts
│   ├── lib/telegramAuth.test.ts
│   ├── lib/slotGenerator.test.ts
│   ├── services/telegramNotify.test.ts
│   └── routes/*.test.ts
├── docker-compose.yml
├── .env.example
├── package.json
├── tsconfig.json
└── vitest.config.ts

frontend/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── types.ts
│   ├── api/
│   │   ├── client.ts
│   │   ├── services.ts
│   │   ├── slots.ts
│   │   ├── bookings.ts
│   │   └── admin.ts
│   ├── hooks/
│   │   ├── useTelegramTheme.ts
│   │   ├── useMainButton.ts
│   │   └── useBackButton.ts
│   ├── pages/
│   │   ├── ServicesList/ServicesList.tsx
│   │   ├── BookingFlow/SelectSlot.tsx
│   │   ├── BookingFlow/Confirm.tsx
│   │   ├── MyBookings/MyBookings.tsx
│   │   └── Admin/AdminBookings.tsx, Admin/AdminServices.tsx
│   └── theme.css
├── tests/setup.ts
├── .env.example
├── package.json
├── vite.config.ts
├── vitest.config.ts
└── tsconfig.json
```

---

## Task 1: Backend scaffolding, shared types, health check

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/vitest.config.ts`
- Create: `backend/.env.example`
- Create: `backend/src/config.ts`
- Create: `backend/src/types.ts`
- Create: `backend/src/app.ts`
- Create: `backend/src/index.ts`
- Test: `backend/tests/app.test.ts`

**Interfaces:**
- Produces: `Service`, `TimeSlot`, `Booking`, `BusinessSettings`, `AuthenticatedUser` types in `backend/src/types.ts`; `createApp(): express.Express` from `backend/src/app.ts`; `config` object from `backend/src/config.ts` with `botToken: string`, `databaseUrl: string`, `port: number`.

- [ ] **Step 1: Create `backend/package.json`**

```json
{
  "name": "book-me-backend",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "migrate": "tsx scripts/migrate.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "express": "^4.19.2",
    "pg": "^8.12.0",
    "dotenv": "^16.4.5",
    "cors": "^2.8.5",
    "luxon": "^3.5.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "typescript": "^5.5.4",
    "tsx": "^4.16.5",
    "vitest": "^2.0.5",
    "supertest": "^7.0.0",
    "@types/express": "^4.17.21",
    "@types/pg": "^8.11.6",
    "@types/cors": "^2.8.17",
    "@types/luxon": "^3.4.2",
    "@types/supertest": "^6.0.2",
    "@types/node": "^20.14.15"
  }
}
```

- [ ] **Step 2: Create `backend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `backend/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    hookTimeout: 20000,
  },
});
```

- [ ] **Step 4: Create `backend/.env.example`**

```
BOT_TOKEN=123456:ABC-DEF_your_bot_token
DATABASE_URL=postgres://postgres:postgres@localhost:5433/bookme
PORT=3001
CORS_ORIGIN=http://localhost:5173
```

- [ ] **Step 5: Create `backend/src/config.ts`**

```typescript
import 'dotenv/config';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const config = {
  botToken: requireEnv('BOT_TOKEN'),
  databaseUrl: requireEnv('DATABASE_URL'),
  port: Number(process.env.PORT ?? 3001),
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
};
```

- [ ] **Step 6: Create `backend/src/types.ts`**

```typescript
export interface Service {
  id: number;
  name: string;
  description: string | null;
  price: number;
  durationMinutes: number;
  isActive: boolean;
}

export interface TimeSlot {
  startsAt: string; // ISO 8601 UTC
}

export interface Booking {
  id: number;
  userId: number;
  serviceId: number;
  serviceName: string;
  startsAt: string;
  endsAt: string;
  status: 'confirmed' | 'cancelled';
  createdAt: string;
}

export interface DayWorkingHours {
  start?: string; // "HH:mm"
  end?: string; // "HH:mm"
  isClosed?: boolean;
}

export type WorkingHours = Partial<
  Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', DayWorkingHours>
>;

export interface BusinessSettings {
  workingHours: WorkingHours;
  slotIntervalMinutes: number;
  bookingHorizonDays: number;
  ownerChatId: number | null;
  timezone: string;
}

export interface AuthenticatedUser {
  id: number;
  telegramId: number;
  role: 'client' | 'admin';
  firstName: string | null;
}
```

- [ ] **Step 7: Create `backend/src/app.ts`**

```typescript
import express from 'express';
import cors from 'cors';
import { config } from './config.js';

export function createApp() {
  const app = express();
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  return app;
}
```

- [ ] **Step 8: Create `backend/src/index.ts`**

```typescript
import { createApp } from './app.js';
import { config } from './config.js';

const app = createApp();
app.listen(config.port, () => {
  console.log(`Backend listening on port ${config.port}`);
});
```

- [ ] **Step 9: Write the failing test — `backend/tests/app.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('GET /health', () => {
  it('returns ok: true', async () => {
    const app = createApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
```

- [ ] **Step 10: Install dependencies and run the test**

```bash
cd backend
cp .env.example .env
npm install
npm test
```
Expected: PASS (this test has no missing implementation — it validates scaffolding works end to end; if `npm install` or env loading fails, fix before proceeding).

- [ ] **Step 11: Commit**

```bash
git add backend/package.json backend/tsconfig.json backend/vitest.config.ts backend/.env.example backend/src backend/tests backend/package-lock.json
git commit -m "backend: scaffold Express app, config, shared types, health check"
```

---

## Task 2: Database schema, local Postgres, migration runner

**Files:**
- Create: `backend/docker-compose.yml`
- Create: `backend/migrations/001_init.sql`
- Create: `backend/scripts/migrate.ts`
- Create: `backend/src/db.ts`
- Test: `backend/tests/db.test.ts`

**Interfaces:**
- Consumes: `config.databaseUrl` from Task 1.
- Produces: `pool: pg.Pool` exported from `backend/src/db.ts`, used by all later DB-touching modules.

- [ ] **Step 1: Create `backend/docker-compose.yml`** (local Postgres for dev + tests, separate port from any system Postgres)

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: bookme
    ports:
      - "5433:5432"
    volumes:
      - bookme_pg_data:/var/lib/postgresql/data
volumes:
  bookme_pg_data:
```

- [ ] **Step 2: Create `backend/migrations/001_init.sql`** (full schema from the design spec, §3)

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  username TEXT,
  role TEXT NOT NULL DEFAULT 'client' CHECK (role IN ('client', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS services (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  duration_minutes INT NOT NULL CHECK (duration_minutes > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS business_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  working_hours JSONB NOT NULL,
  slot_interval_minutes INT NOT NULL DEFAULT 30,
  booking_horizon_days INT NOT NULL DEFAULT 14,
  owner_chat_id BIGINT,
  timezone TEXT NOT NULL DEFAULT 'Europe/Moscow',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bookings (
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

INSERT INTO business_settings (id, working_hours, slot_interval_minutes, booking_horizon_days, timezone)
VALUES (
  1,
  '{"mon":{"start":"09:00","end":"20:00"},"tue":{"start":"09:00","end":"20:00"},"wed":{"start":"09:00","end":"20:00"},"thu":{"start":"09:00","end":"20:00"},"fri":{"start":"09:00","end":"20:00"},"sat":{"start":"10:00","end":"18:00"},"sun":{"isClosed":true}}'::jsonb,
  30,
  14,
  'Europe/Moscow'
)
ON CONFLICT (id) DO NOTHING;
```

- [ ] **Step 3: Create `backend/scripts/migrate.ts`**

```typescript
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { config } from '../src/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const client = new pg.Client({ connectionString: config.databaseUrl });
  await client.connect();
  const sql = readFileSync(path.join(__dirname, '../migrations/001_init.sql'), 'utf-8');
  await client.query(sql);
  await client.end();
  console.log('Migration applied.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 4: Create `backend/src/db.ts`**

```typescript
import pg from 'pg';
import { config } from './config.js';

export const pool = new pg.Pool({ connectionString: config.databaseUrl });
```

- [ ] **Step 5: Write the failing test — `backend/tests/db.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { pool } from '../src/db.js';

describe('database schema', () => {
  it('has business_settings seeded with one row and the exclusion constraint on bookings', async () => {
    const settings = await pool.query('SELECT * FROM business_settings WHERE id = 1');
    expect(settings.rows).toHaveLength(1);
    expect(settings.rows[0].slot_interval_minutes).toBe(30);

    const constraint = await pool.query(
      `SELECT conname FROM pg_constraint WHERE conname = 'no_overlapping_bookings'`
    );
    expect(constraint.rows).toHaveLength(1);
  });
});
```

- [ ] **Step 6: Start local Postgres, run the migration, run the test**

```bash
cd backend
docker compose up -d
npm run migrate
npm test -- tests/db.test.ts
```
Expected: PASS. If `docker compose` is unavailable, note this in the session and ask the user how they want to provide a Postgres instance (their Supabase project connection string works too — point `DATABASE_URL` at it instead).

- [ ] **Step 7: Commit**

```bash
git add backend/docker-compose.yml backend/migrations backend/scripts backend/src/db.ts backend/tests/db.test.ts
git commit -m "backend: add DB schema migration, local Postgres compose file, db pool"
```

---

## Task 3: Telegram initData HMAC validation (pure logic)

**Files:**
- Create: `backend/src/lib/telegramAuth.ts`
- Test: `backend/tests/lib/telegramAuth.test.ts`

**Interfaces:**
- Produces: `validateInitData(initData: string, botToken: string, nowSeconds?: number): TelegramInitDataUser | null` and `TelegramInitDataUser { telegramId: number; firstName: string | null; lastName: string | null; username: string | null; }`, both exported from `backend/src/lib/telegramAuth.ts`. Used by Task 5's middleware.

- [ ] **Step 1: Write the failing test — `backend/tests/lib/telegramAuth.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { validateInitData } from '../../src/lib/telegramAuth.js';

const BOT_TOKEN = 'test-bot-token';

function signInitData(fields: Record<string, string>): string {
  const params = new URLSearchParams(fields);
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  params.set('hash', hash);
  return params.toString();
}

describe('validateInitData', () => {
  it('accepts a correctly signed initData string and extracts the user', () => {
    const nowSeconds = 1_800_000_000;
    const initData = signInitData({
      auth_date: String(nowSeconds - 10),
      query_id: 'AA',
      user: JSON.stringify({ id: 42, first_name: 'Ann', last_name: 'K', username: 'annk' }),
    });

    const result = validateInitData(initData, BOT_TOKEN, nowSeconds);

    expect(result).toEqual({ telegramId: 42, firstName: 'Ann', lastName: 'K', username: 'annk' });
  });

  it('rejects initData with a tampered hash', () => {
    const nowSeconds = 1_800_000_000;
    const initData = signInitData({
      auth_date: String(nowSeconds - 10),
      user: JSON.stringify({ id: 42, first_name: 'Ann' }),
    }).replace(/hash=[0-9a-f]+/, 'hash=' + '0'.repeat(64));

    expect(validateInitData(initData, BOT_TOKEN, nowSeconds)).toBeNull();
  });

  it('rejects initData older than 24 hours', () => {
    const nowSeconds = 1_800_000_000;
    const initData = signInitData({
      auth_date: String(nowSeconds - 25 * 3600),
      user: JSON.stringify({ id: 42, first_name: 'Ann' }),
    });

    expect(validateInitData(initData, BOT_TOKEN, nowSeconds)).toBeNull();
  });

  it('rejects initData missing the user field', () => {
    const nowSeconds = 1_800_000_000;
    const initData = signInitData({ auth_date: String(nowSeconds - 10) });

    expect(validateInitData(initData, BOT_TOKEN, nowSeconds)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd backend
npm test -- tests/lib/telegramAuth.test.ts
```
Expected: FAIL with "Cannot find module '../../src/lib/telegramAuth.js'".

- [ ] **Step 3: Create `backend/src/lib/telegramAuth.ts`**

```typescript
import crypto from 'node:crypto';

export interface TelegramInitDataUser {
  telegramId: number;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
}

const MAX_AGE_SECONDS = 24 * 60 * 60;
const HASH_HEX_LENGTH = 64;

export function validateInitData(
  initData: string,
  botToken: string,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): TelegramInitDataUser | null {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(initData);
  } catch {
    return null;
  }

  const hash = params.get('hash');
  if (!hash || hash.length !== HASH_HEX_LENGTH || !/^[0-9a-f]+$/i.test(hash)) return null;
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const valid = crypto.timingSafeEqual(Buffer.from(computedHash, 'hex'), Buffer.from(hash, 'hex'));
  if (!valid) return null;

  const authDate = Number(params.get('auth_date'));
  if (!authDate || nowSeconds - authDate > MAX_AGE_SECONDS) return null;

  const userJson = params.get('user');
  if (!userJson) return null;

  let user: { id: number; first_name?: string; last_name?: string; username?: string };
  try {
    user = JSON.parse(userJson);
  } catch {
    return null;
  }
  if (typeof user.id !== 'number') return null;

  return {
    telegramId: user.id,
    firstName: user.first_name ?? null,
    lastName: user.last_name ?? null,
    username: user.username ?? null,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- tests/lib/telegramAuth.test.ts
```
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/telegramAuth.ts backend/tests/lib/telegramAuth.test.ts
git commit -m "backend: add Telegram initData HMAC validation"
```

---

## Task 4: Slot generation (pure logic)

**Files:**
- Create: `backend/src/lib/slotGenerator.ts`
- Test: `backend/tests/lib/slotGenerator.test.ts`

**Interfaces:**
- Consumes: `WorkingHours` from `backend/src/types.ts` (Task 1).
- Produces: `generateSlots(params: GenerateSlotsParams): string[]` and `GenerateSlotsParams { date: string; workingHours: WorkingHours; slotIntervalMinutes: number; serviceDurationMinutes: number; existingBookings: { startsAt: Date; endsAt: Date }[]; timezone: string; now: Date }`, exported from `backend/src/lib/slotGenerator.ts`. Used by Task 7's `/api/slots` route.

- [ ] **Step 1: Write the failing test — `backend/tests/lib/slotGenerator.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { generateSlots } from '../../src/lib/slotGenerator.js';

const WORKING_HOURS = {
  mon: { start: '09:00', end: '11:00' },
  sun: { isClosed: true },
};

describe('generateSlots', () => {
  it('generates slots across the working window at the given interval', () => {
    // 2024-01-01 is a Monday
    const slots = generateSlots({
      date: '2024-01-01',
      workingHours: WORKING_HOURS,
      slotIntervalMinutes: 30,
      serviceDurationMinutes: 30,
      existingBookings: [],
      timezone: 'UTC',
      now: new Date('2023-12-01T00:00:00Z'),
    });

    expect(slots).toEqual([
      '2024-01-01T09:00:00.000Z',
      '2024-01-01T09:30:00.000Z',
      '2024-01-01T10:00:00.000Z',
      '2024-01-01T10:30:00.000Z',
    ]);
  });

  it('excludes slots that would run past the working window given the service duration', () => {
    const slots = generateSlots({
      date: '2024-01-01',
      workingHours: WORKING_HOURS,
      slotIntervalMinutes: 30,
      serviceDurationMinutes: 90,
      existingBookings: [],
      timezone: 'UTC',
      now: new Date('2023-12-01T00:00:00Z'),
    });

    // Only a 90-minute service starting at 09:00 or 09:30 fits before 11:00
    expect(slots).toEqual(['2024-01-01T09:00:00.000Z', '2024-01-01T09:30:00.000Z']);
  });

  it('excludes slots that overlap an existing booking', () => {
    const slots = generateSlots({
      date: '2024-01-01',
      workingHours: WORKING_HOURS,
      slotIntervalMinutes: 30,
      serviceDurationMinutes: 30,
      existingBookings: [
        { startsAt: new Date('2024-01-01T09:30:00.000Z'), endsAt: new Date('2024-01-01T10:00:00.000Z') },
      ],
      timezone: 'UTC',
      now: new Date('2023-12-01T00:00:00Z'),
    });

    expect(slots).toEqual([
      '2024-01-01T09:00:00.000Z',
      '2024-01-01T10:00:00.000Z',
      '2024-01-01T10:30:00.000Z',
    ]);
  });

  it('excludes slots that are already in the past relative to now', () => {
    const slots = generateSlots({
      date: '2024-01-01',
      workingHours: WORKING_HOURS,
      slotIntervalMinutes: 30,
      serviceDurationMinutes: 30,
      existingBookings: [],
      timezone: 'UTC',
      now: new Date('2024-01-01T09:45:00.000Z'),
    });

    expect(slots).toEqual(['2024-01-01T10:00:00.000Z', '2024-01-01T10:30:00.000Z']);
  });

  it('returns an empty array for a closed day', () => {
    // 2023-12-31 is a Sunday
    const slots = generateSlots({
      date: '2023-12-31',
      workingHours: WORKING_HOURS,
      slotIntervalMinutes: 30,
      serviceDurationMinutes: 30,
      existingBookings: [],
      timezone: 'UTC',
      now: new Date('2023-12-01T00:00:00Z'),
    });

    expect(slots).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- tests/lib/slotGenerator.test.ts
```
Expected: FAIL with "Cannot find module '../../src/lib/slotGenerator.js'".

- [ ] **Step 3: Create `backend/src/lib/slotGenerator.ts`**

```typescript
import { DateTime } from 'luxon';
import type { WorkingHours } from '../types.js';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export interface GenerateSlotsParams {
  date: string; // "YYYY-MM-DD"
  workingHours: WorkingHours;
  slotIntervalMinutes: number;
  serviceDurationMinutes: number;
  existingBookings: { startsAt: Date; endsAt: Date }[];
  timezone: string;
  now: Date;
}

export function generateSlots(params: GenerateSlotsParams): string[] {
  const { date, workingHours, slotIntervalMinutes, serviceDurationMinutes, existingBookings, timezone, now } =
    params;

  const dayStart = DateTime.fromISO(date, { zone: timezone }).startOf('day');
  const dayKey = DAY_KEYS[dayStart.weekday % 7];
  const hours = workingHours[dayKey];
  if (!hours || hours.isClosed || !hours.start || !hours.end) return [];

  const [startH, startM] = hours.start.split(':').map(Number);
  const [endH, endM] = hours.end.split(':').map(Number);
  const windowStart = dayStart.set({ hour: startH, minute: startM });
  const windowEnd = dayStart.set({ hour: endH, minute: endM });
  const nowDt = DateTime.fromJSDate(now);

  const slots: string[] = [];
  let cursor = windowStart;
  while (cursor.plus({ minutes: serviceDurationMinutes }) <= windowEnd) {
    const slotStart = cursor;
    const slotEnd = cursor.plus({ minutes: serviceDurationMinutes });

    const isPast = slotStart <= nowDt;
    const overlaps = existingBookings.some((booking) => {
      const bookingStart = DateTime.fromJSDate(booking.startsAt);
      const bookingEnd = DateTime.fromJSDate(booking.endsAt);
      return slotStart < bookingEnd && bookingStart < slotEnd;
    });

    if (!isPast && !overlaps) {
      slots.push(slotStart.toUTC().toISO({ suppressMilliseconds: false })!);
    }
    cursor = cursor.plus({ minutes: slotIntervalMinutes });
  }

  return slots;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- tests/lib/slotGenerator.test.ts
```
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/slotGenerator.ts backend/tests/lib/slotGenerator.test.ts
git commit -m "backend: add pure slot generation logic"
```

---

## Task 5: validateInitData middleware + user upsert

**Files:**
- Create: `backend/src/middleware/validateInitData.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/tests/middleware/validateInitData.test.ts`
- Test: `backend/tests/setup.ts` (truncate tables between tests)

**Interfaces:**
- Consumes: `validateInitData` from Task 3, `pool` from Task 2, `config.botToken` from Task 1.
- Produces: Express middleware attaching `req.user: AuthenticatedUser` (extends `express.Request` via module augmentation), exported as `validateInitDataMiddleware` from `backend/src/middleware/validateInitData.ts`. Used by every route from Task 6 onward.

- [ ] **Step 1: Create `backend/tests/setup.ts`** (truncates mutable tables before each test so tests are isolated; runs against the Docker Postgres from Task 2)

```typescript
import { beforeEach, afterAll } from 'vitest';
import { pool } from '../src/db.js';

beforeEach(async () => {
  await pool.query('TRUNCATE bookings, users RESTART IDENTITY CASCADE');
  await pool.query('TRUNCATE services RESTART IDENTITY CASCADE');
});

afterAll(async () => {
  await pool.end();
});
```

- [ ] **Step 2: Write the failing test — `backend/tests/middleware/validateInitData.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/db.js';
import { config } from '../../src/config.js';

function signInitData(fields: Record<string, string>): string {
  const params = new URLSearchParams(fields);
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(config.botToken).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  params.set('hash', hash);
  return params.toString();
}

describe('validateInitData middleware (via GET /api/whoami test route)', () => {
  it('rejects requests without an Authorization header', async () => {
    const app = createApp();
    const res = await request(app).get('/api/whoami');
    expect(res.status).toBe(401);
  });

  it('rejects requests with an invalid signature', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/api/whoami')
      .set('Authorization', 'tma auth_date=1&user=%7B%7D&hash=' + '0'.repeat(64));
    expect(res.status).toBe(401);
  });

  it('upserts the user and attaches req.user for a validly signed request', async () => {
    const app = createApp();
    const initData = signInitData({
      auth_date: String(Math.floor(Date.now() / 1000)),
      user: JSON.stringify({ id: 777, first_name: 'Lena' }),
    });

    const res = await request(app).get('/api/whoami').set('Authorization', `tma ${initData}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ telegramId: 777, role: 'client', firstName: 'Lena' });

    const dbUser = await pool.query('SELECT * FROM users WHERE telegram_id = 777');
    expect(dbUser.rows).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
npm test -- tests/middleware/validateInitData.test.ts
```
Expected: FAIL (404, since neither the middleware nor the `/api/whoami` test route exist yet).

- [ ] **Step 4: Create `backend/src/middleware/validateInitData.ts`**

```typescript
import type { NextFunction, Request, Response } from 'express';
import { validateInitData } from '../lib/telegramAuth.js';
import { pool } from '../db.js';
import { config } from '../config.js';
import type { AuthenticatedUser } from '../types.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function validateInitDataMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.header('Authorization');
  if (!header || !header.startsWith('tma ')) {
    return res.status(401).json({ error: 'Missing Telegram init data' });
  }

  const initData = header.slice('tma '.length);
  const parsed = validateInitData(initData, config.botToken);
  if (!parsed) {
    return res.status(401).json({ error: 'Invalid Telegram init data' });
  }

  const result = await pool.query<{ id: number; role: 'client' | 'admin'; first_name: string | null }>(
    `INSERT INTO users (telegram_id, first_name, last_name, username)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (telegram_id) DO UPDATE
       SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, username = EXCLUDED.username
     RETURNING id, role, first_name`,
    [parsed.telegramId, parsed.firstName, parsed.lastName, parsed.username]
  );

  const row = result.rows[0];
  req.user = { id: row.id, telegramId: parsed.telegramId, role: row.role, firstName: row.first_name };
  next();
}
```

- [ ] **Step 5: Wire the middleware and a temporary `/api/whoami` route into `backend/src/app.ts`** (the real routes replace this test route in later tasks; keep `/api/whoami` — it stays useful for frontend debugging)

```typescript
import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { validateInitDataMiddleware } from './middleware/validateInitData.js';

export function createApp() {
  const app = express();
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/whoami', validateInitDataMiddleware, (req, res) => {
    res.json(req.user);
  });

  return app;
}
```

- [ ] **Step 6: Run the test to verify it passes**

```bash
npm test -- tests/middleware/validateInitData.test.ts
```
Expected: PASS (3 tests). Note: this also picks up `tests/setup.ts` automatically via `vitest.config.ts`.

- [ ] **Step 7: Commit**

```bash
git add backend/src/middleware/validateInitData.ts backend/src/app.ts backend/tests/middleware backend/tests/setup.ts
git commit -m "backend: add initData validation middleware with user upsert"
```

---

## Task 6: Services routes (public list + admin CRUD)

**Files:**
- Create: `backend/src/routes/services.ts`
- Create: `backend/src/routes/admin/services.ts`
- Create: `backend/src/middleware/requireAdmin.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/tests/routes/services.test.ts`
- Test: `backend/tests/routes/adminServices.test.ts`

**Interfaces:**
- Consumes: `pool` (Task 2), `validateInitDataMiddleware` (Task 5), `Service` type (Task 1).
- Produces: Express routers `servicesRouter` and `adminServicesRouter`, mounted at `/api/services` and `/api/admin/services`; `requireAdminMiddleware` exported from `backend/src/middleware/requireAdmin.ts`, reused by Tasks 8 and 9.

- [ ] **Step 1: Create `backend/src/middleware/requireAdmin.ts`**

```typescript
import type { NextFunction, Request, Response } from 'express';

export function requireAdminMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}
```

- [ ] **Step 2: Write the failing test — `backend/tests/routes/services.test.ts`**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/db.js';
import { config } from '../../src/config.js';

function authHeaderFor(telegramId: number): string {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: telegramId, first_name: 'Client' }),
  });
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(config.botToken).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  params.set('hash', hash);
  return `tma ${params.toString()}`;
}

describe('GET /api/services', () => {
  beforeEach(async () => {
    await pool.query(
      `INSERT INTO services (name, price, duration_minutes, is_active) VALUES
       ('Haircut', 1500, 30, true),
       ('Beard trim', 800, 20, true),
       ('Retired service', 500, 15, false)`
    );
  });

  it('returns only active services', async () => {
    const app = createApp();
    const res = await request(app).get('/api/services').set('Authorization', authHeaderFor(1));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.map((s: { name: string }) => s.name).sort()).toEqual(['Beard trim', 'Haircut']);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
npm test -- tests/routes/services.test.ts
```
Expected: FAIL with 404 (route not mounted).

- [ ] **Step 4: Create `backend/src/routes/services.ts`**

```typescript
import { Router } from 'express';
import { pool } from '../db.js';
import type { Service } from '../types.js';

export const servicesRouter = Router();

servicesRouter.get('/', async (_req, res) => {
  const result = await pool.query(
    `SELECT id, name, description, price, duration_minutes, is_active
     FROM services WHERE is_active = true ORDER BY id`
  );
  const services: Service[] = result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    durationMinutes: row.duration_minutes,
    isActive: row.is_active,
  }));
  res.json(services);
});
```

- [ ] **Step 5: Mount it in `backend/src/app.ts`** (add import and `app.use('/api/services', validateInitDataMiddleware, servicesRouter);` after the `/api/whoami` route)

```typescript
import { servicesRouter } from './routes/services.js';
// ...
  app.use('/api/services', validateInitDataMiddleware, servicesRouter);
```

- [ ] **Step 6: Run the test to verify it passes**

```bash
npm test -- tests/routes/services.test.ts
```
Expected: PASS.

- [ ] **Step 7: Write the failing test — `backend/tests/routes/adminServices.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/db.js';
import { config } from '../../src/config.js';

function authHeaderFor(telegramId: number): string {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: telegramId, first_name: 'User' }),
  });
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(config.botToken).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  params.set('hash', hash);
  return `tma ${params.toString()}`;
}

describe('/api/admin/services', () => {
  it('rejects a non-admin user with 403', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/admin/services')
      .set('Authorization', authHeaderFor(1))
      .send({ name: 'Haircut', price: 1500, durationMinutes: 30 });
    expect(res.status).toBe(403);
  });

  it('allows an admin to create, list, and soft-delete a service', async () => {
    const app = createApp();
    await pool.query(`UPDATE users SET role = 'admin' WHERE telegram_id = 2`);
    // ensure the admin user row exists before promoting it
    const adminHeader = authHeaderFor(2);
    await request(app).get('/api/services').set('Authorization', adminHeader);
    await pool.query(`UPDATE users SET role = 'admin' WHERE telegram_id = 2`);

    const createRes = await request(app)
      .post('/api/admin/services')
      .set('Authorization', adminHeader)
      .send({ name: 'Haircut', price: 1500, durationMinutes: 30 });
    expect(createRes.status).toBe(201);
    const serviceId = createRes.body.id;

    const deleteRes = await request(app)
      .delete(`/api/admin/services/${serviceId}`)
      .set('Authorization', adminHeader);
    expect(deleteRes.status).toBe(204);

    const remaining = await pool.query('SELECT is_active FROM services WHERE id = $1', [serviceId]);
    expect(remaining.rows[0].is_active).toBe(false);
  });
});
```

- [ ] **Step 8: Run the test to verify it fails**

```bash
npm test -- tests/routes/adminServices.test.ts
```
Expected: FAIL (404, admin routes not mounted).

- [ ] **Step 9: Create `backend/src/routes/admin/services.ts`**

```typescript
import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../../db.js';

export const adminServicesRouter = Router();

const createServiceSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullish(),
  price: z.number().nonnegative(),
  durationMinutes: z.number().int().positive(),
});

adminServicesRouter.get('/', async (_req, res) => {
  const result = await pool.query(
    `SELECT id, name, description, price, duration_minutes, is_active FROM services ORDER BY id`
  );
  res.json(
    result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      price: Number(row.price),
      durationMinutes: row.duration_minutes,
      isActive: row.is_active,
    }))
  );
});

adminServicesRouter.post('/', async (req, res) => {
  const parsed = createServiceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { name, description, price, durationMinutes } = parsed.data;
  const result = await pool.query(
    `INSERT INTO services (name, description, price, duration_minutes)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [name, description ?? null, price, durationMinutes]
  );
  res.status(201).json({ id: result.rows[0].id });
});

const updateServiceSchema = createServiceSchema.partial();

adminServicesRouter.patch('/:id', async (req, res) => {
  const parsed = updateServiceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const id = Number(req.params.id);
  const fields = parsed.data;
  const updates: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (fields.name !== undefined) { updates.push(`name = $${i++}`); values.push(fields.name); }
  if (fields.description !== undefined) { updates.push(`description = $${i++}`); values.push(fields.description); }
  if (fields.price !== undefined) { updates.push(`price = $${i++}`); values.push(fields.price); }
  if (fields.durationMinutes !== undefined) { updates.push(`duration_minutes = $${i++}`); values.push(fields.durationMinutes); }
  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
  values.push(id);
  await pool.query(`UPDATE services SET ${updates.join(', ')} WHERE id = $${i}`, values);
  res.status(204).end();
});

adminServicesRouter.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  await pool.query('UPDATE services SET is_active = false WHERE id = $1', [id]);
  res.status(204).end();
});
```

- [ ] **Step 10: Mount it in `backend/src/app.ts`**

```typescript
import { adminServicesRouter } from './routes/admin/services.js';
import { requireAdminMiddleware } from './middleware/requireAdmin.js';
// ...
  app.use(
    '/api/admin/services',
    validateInitDataMiddleware,
    requireAdminMiddleware,
    adminServicesRouter
  );
```

- [ ] **Step 11: Run the test to verify it passes**

```bash
npm test -- tests/routes/adminServices.test.ts
```
Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add backend/src/routes/services.ts backend/src/routes/admin/services.ts backend/src/middleware/requireAdmin.ts backend/src/app.ts backend/tests/routes/services.test.ts backend/tests/routes/adminServices.test.ts
git commit -m "backend: add public and admin services routes with requireAdmin middleware"
```

---

## Task 7: Slots route

**Files:**
- Create: `backend/src/routes/slots.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/tests/routes/slots.test.ts`

**Interfaces:**
- Consumes: `generateSlots` (Task 4), `pool` (Task 2).
- Produces: `slotsRouter` mounted at `/api/slots`, returning `TimeSlot[]`.

- [ ] **Step 1: Write the failing test — `backend/tests/routes/slots.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/db.js';
import { config } from '../../src/config.js';

function authHeader(): string {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: 1, first_name: 'Client' }),
  });
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(config.botToken).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  params.set('hash', hash);
  return `tma ${params.toString()}`;
}

describe('GET /api/slots', () => {
  it('returns generated slots for a service on a given date, excluding an existing booking', async () => {
    await pool.query(
      `UPDATE business_settings SET working_hours = $1, slot_interval_minutes = 30 WHERE id = 1`,
      ['{"mon":{"start":"09:00","end":"10:00"}}']
    );
    const serviceRes = await pool.query(
      `INSERT INTO services (name, price, duration_minutes) VALUES ('Cut', 1000, 30) RETURNING id`
    );
    const serviceId = serviceRes.rows[0].id;
    const userRes = await pool.query(
      `INSERT INTO users (telegram_id) VALUES (999) RETURNING id`
    );
    await pool.query(
      `INSERT INTO bookings (user_id, service_id, starts_at, ends_at)
       VALUES ($1, $2, '2099-01-05T09:00:00Z', '2099-01-05T09:30:00Z')`,
      [userRes.rows[0].id, serviceId]
    );

    const app = createApp();
    // 2099-01-05 is a Monday
    const res = await request(app)
      .get(`/api/slots?date=2099-01-05&service_id=${serviceId}`)
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ startsAt: '2099-01-05T09:30:00.000Z' }]);
  });

  it('returns 400 for a missing service_id', async () => {
    const app = createApp();
    const res = await request(app).get('/api/slots?date=2099-01-05').set('Authorization', authHeader());
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- tests/routes/slots.test.ts
```
Expected: FAIL with 404.

- [ ] **Step 3: Create `backend/src/routes/slots.ts`**

```typescript
import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { generateSlots } from '../lib/slotGenerator.js';
import type { WorkingHours } from '../types.js';

export const slotsRouter = Router();

const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  service_id: z.coerce.number().int().positive(),
});

slotsRouter.get('/', async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { date, service_id: serviceId } = parsed.data;

  const serviceResult = await pool.query('SELECT duration_minutes FROM services WHERE id = $1 AND is_active = true', [
    serviceId,
  ]);
  if (serviceResult.rows.length === 0) {
    return res.status(404).json({ error: 'Service not found' });
  }
  const durationMinutes = serviceResult.rows[0].duration_minutes;

  const settingsResult = await pool.query('SELECT * FROM business_settings WHERE id = 1');
  const settings = settingsResult.rows[0];

  const bookingsResult = await pool.query(
    `SELECT starts_at, ends_at FROM bookings
     WHERE status = 'confirmed' AND starts_at::date = $1::date`,
    [date]
  );

  const slots = generateSlots({
    date,
    workingHours: settings.working_hours as WorkingHours,
    slotIntervalMinutes: settings.slot_interval_minutes,
    serviceDurationMinutes: durationMinutes,
    existingBookings: bookingsResult.rows.map((row) => ({
      startsAt: new Date(row.starts_at),
      endsAt: new Date(row.ends_at),
    })),
    timezone: settings.timezone,
    now: new Date(),
  });

  res.json(slots.map((startsAt) => ({ startsAt })));
});
```

- [ ] **Step 4: Mount it in `backend/src/app.ts`**

```typescript
import { slotsRouter } from './routes/slots.js';
// ...
  app.use('/api/slots', validateInitDataMiddleware, slotsRouter);
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npm test -- tests/routes/slots.test.ts
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/slots.ts backend/src/app.ts backend/tests/routes/slots.test.ts
git commit -m "backend: add /api/slots route using the pure slot generator"
```

---

## Task 8: Bookings routes (create, list mine, cancel)

**Files:**
- Create: `backend/src/services/bookingService.ts`
- Create: `backend/src/routes/bookings.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/tests/routes/bookings.test.ts`

**Interfaces:**
- Consumes: `pool` (Task 2), `Booking` type (Task 1).
- Produces: `createBooking(params): Promise<{ ok: true; booking: Booking } | { ok: false; reason: 'conflict' | 'not_found' }>` from `backend/src/services/bookingService.ts`; `bookingsRouter` mounted at `/api/bookings`. `createBooking` is consumed directly by Task 10 to trigger notifications after a successful insert.

- [ ] **Step 1: Write the failing test — `backend/tests/routes/bookings.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/db.js';
import { config } from '../../src/config.js';

function authHeaderFor(telegramId: number): string {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: telegramId, first_name: 'Client' }),
  });
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(config.botToken).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  params.set('hash', hash);
  return `tma ${params.toString()}`;
}

describe('/api/bookings', () => {
  it('creates a booking, prevents a conflicting one, lists it, then cancels it', async () => {
    const app = createApp();
    const serviceRes = await pool.query(
      `INSERT INTO services (name, price, duration_minutes) VALUES ('Cut', 1000, 30) RETURNING id`
    );
    const serviceId = serviceRes.rows[0].id;
    const header = authHeaderFor(555);

    const createRes = await request(app)
      .post('/api/bookings')
      .set('Authorization', header)
      .send({ serviceId, startsAt: '2099-02-01T09:00:00.000Z' });
    expect(createRes.status).toBe(201);
    const bookingId = createRes.body.id;

    const conflictRes = await request(app)
      .post('/api/bookings')
      .set('Authorization', authHeaderFor(556))
      .send({ serviceId, startsAt: '2099-02-01T09:15:00.000Z' });
    expect(conflictRes.status).toBe(409);

    const listRes = await request(app).get('/api/bookings/my').set('Authorization', header);
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].id).toBe(bookingId);

    const cancelRes = await request(app)
      .patch(`/api/bookings/${bookingId}/cancel`)
      .set('Authorization', header);
    expect(cancelRes.status).toBe(200);

    const afterCancel = await request(app).get('/api/bookings/my').set('Authorization', header);
    expect(afterCancel.body[0].status).toBe('cancelled');
  });

  it('rejects cancelling a booking that belongs to a different user', async () => {
    const app = createApp();
    const serviceRes = await pool.query(
      `INSERT INTO services (name, price, duration_minutes) VALUES ('Cut', 1000, 30) RETURNING id`
    );
    const serviceId = serviceRes.rows[0].id;

    const createRes = await request(app)
      .post('/api/bookings')
      .set('Authorization', authHeaderFor(1))
      .send({ serviceId, startsAt: '2099-02-02T09:00:00.000Z' });

    const cancelRes = await request(app)
      .patch(`/api/bookings/${createRes.body.id}/cancel`)
      .set('Authorization', authHeaderFor(2));
    expect(cancelRes.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- tests/routes/bookings.test.ts
```
Expected: FAIL with 404.

- [ ] **Step 3: Create `backend/src/services/bookingService.ts`**

```typescript
import { pool } from '../db.js';
import type { Booking } from '../types.js';

interface CreateBookingParams {
  userId: number;
  serviceId: number;
  startsAt: string; // ISO
}

type CreateBookingResult =
  | { ok: true; booking: Booking }
  | { ok: false; reason: 'conflict' | 'not_found' };

const EXCLUSION_VIOLATION = '23P01';

export async function createBooking(params: CreateBookingParams): Promise<CreateBookingResult> {
  const serviceResult = await pool.query(
    'SELECT name, duration_minutes FROM services WHERE id = $1 AND is_active = true',
    [params.serviceId]
  );
  if (serviceResult.rows.length === 0) {
    return { ok: false, reason: 'not_found' };
  }
  const { name: serviceName, duration_minutes: durationMinutes } = serviceResult.rows[0];

  try {
    const result = await pool.query(
      `INSERT INTO bookings (user_id, service_id, starts_at, ends_at)
       VALUES ($1, $2, $3::timestamptz, $3::timestamptz + ($4 || ' minutes')::interval)
       RETURNING id, user_id, service_id, starts_at, ends_at, status, created_at`,
      [params.userId, params.serviceId, params.startsAt, durationMinutes]
    );
    const row = result.rows[0];
    return {
      ok: true,
      booking: {
        id: row.id,
        userId: row.user_id,
        serviceId: row.service_id,
        serviceName,
        startsAt: row.starts_at.toISOString(),
        endsAt: row.ends_at.toISOString(),
        status: row.status,
        createdAt: row.created_at.toISOString(),
      },
    };
  } catch (err) {
    const pgError = err as { code?: string };
    if (pgError.code === EXCLUSION_VIOLATION) {
      return { ok: false, reason: 'conflict' };
    }
    throw err;
  }
}
```

- [ ] **Step 4: Create `backend/src/routes/bookings.ts`**

```typescript
import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { createBooking } from '../services/bookingService.js';

export const bookingsRouter = Router();

const createBookingSchema = z.object({
  serviceId: z.number().int().positive(),
  startsAt: z.string().datetime(),
});

bookingsRouter.post('/', async (req, res) => {
  const parsed = createBookingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const result = await createBooking({
    userId: req.user!.id,
    serviceId: parsed.data.serviceId,
    startsAt: parsed.data.startsAt,
  });

  if (!result.ok) {
    if (result.reason === 'conflict') return res.status(409).json({ error: 'Slot no longer available' });
    return res.status(404).json({ error: 'Service not found' });
  }

  res.status(201).json(result.booking);
});

bookingsRouter.get('/my', async (req, res) => {
  const result = await pool.query(
    `SELECT b.id, b.user_id, b.service_id, s.name AS service_name, b.starts_at, b.ends_at, b.status, b.created_at
     FROM bookings b JOIN services s ON s.id = b.service_id
     WHERE b.user_id = $1 ORDER BY b.starts_at DESC`,
    [req.user!.id]
  );
  res.json(
    result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      serviceId: row.service_id,
      serviceName: row.service_name,
      startsAt: row.starts_at.toISOString(),
      endsAt: row.ends_at.toISOString(),
      status: row.status,
      createdAt: row.created_at.toISOString(),
    }))
  );
});

bookingsRouter.patch('/:id/cancel', async (req, res) => {
  const id = Number(req.params.id);
  const result = await pool.query(
    `UPDATE bookings SET status = 'cancelled' WHERE id = $1 AND user_id = $2 AND status = 'confirmed' RETURNING id`,
    [id, req.user!.id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Booking not found' });
  }
  res.json({ ok: true });
});
```

- [ ] **Step 5: Mount it in `backend/src/app.ts`**

```typescript
import { bookingsRouter } from './routes/bookings.js';
// ...
  app.use('/api/bookings', validateInitDataMiddleware, bookingsRouter);
```

- [ ] **Step 6: Run the test to verify it passes**

```bash
npm test -- tests/routes/bookings.test.ts
```
Expected: PASS (2 tests). The 409 case exercises the `EXCLUDE` constraint from Task 2 end to end.

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/bookingService.ts backend/src/routes/bookings.ts backend/src/app.ts backend/tests/routes/bookings.test.ts
git commit -m "backend: add booking create/list/cancel routes backed by the exclusion constraint"
```

---

## Task 9: Admin bookings + settings routes

**Files:**
- Create: `backend/src/routes/admin/bookings.ts`
- Create: `backend/src/routes/admin/settings.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/tests/routes/adminBookings.test.ts`
- Test: `backend/tests/routes/adminSettings.test.ts`

**Interfaces:**
- Consumes: `pool` (Task 2), `requireAdminMiddleware` (Task 6).
- Produces: `adminBookingsRouter` at `/api/admin/bookings`, `adminSettingsRouter` at `/api/admin/settings`.

- [ ] **Step 1: Write the failing test — `backend/tests/routes/adminBookings.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/db.js';
import { config } from '../../src/config.js';
import { createBooking } from '../../src/services/bookingService.js';

function authHeaderFor(telegramId: number): string {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: telegramId, first_name: 'Admin' }),
  });
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(config.botToken).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  params.set('hash', hash);
  return `tma ${params.toString()}`;
}

describe('GET /api/admin/bookings', () => {
  it('returns confirmed bookings for the requested date only', async () => {
    const app = createApp();
    const header = authHeaderFor(1);
    await request(app).get('/api/services').set('Authorization', header); // ensures user row exists
    await pool.query(`UPDATE users SET role = 'admin' WHERE telegram_id = 1`);

    const serviceRes = await pool.query(
      `INSERT INTO services (name, price, duration_minutes) VALUES ('Cut', 1000, 30) RETURNING id`
    );
    const clientRow = await pool.query(`INSERT INTO users (telegram_id) VALUES (2) RETURNING id`);
    await createBooking({ userId: clientRow.rows[0].id, serviceId: serviceRes.rows[0].id, startsAt: '2099-03-01T09:00:00.000Z' });
    await createBooking({ userId: clientRow.rows[0].id, serviceId: serviceRes.rows[0].id, startsAt: '2099-03-02T09:00:00.000Z' });

    const res = await request(app).get('/api/admin/bookings?date=2099-03-01').set('Authorization', header);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].startsAt).toBe('2099-03-01T09:00:00.000Z');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- tests/routes/adminBookings.test.ts
```
Expected: FAIL with 404.

- [ ] **Step 3: Create `backend/src/routes/admin/bookings.ts`**

```typescript
import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../../db.js';

export const adminBookingsRouter = Router();

const querySchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

adminBookingsRouter.get('/', async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const result = await pool.query(
    `SELECT b.id, b.user_id, u.first_name, u.username, b.service_id, s.name AS service_name,
            b.starts_at, b.ends_at, b.status, b.created_at
     FROM bookings b
     JOIN services s ON s.id = b.service_id
     JOIN users u ON u.id = b.user_id
     WHERE b.status = 'confirmed' AND b.starts_at::date = $1::date
     ORDER BY b.starts_at`,
    [parsed.data.date]
  );
  res.json(
    result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      clientFirstName: row.first_name,
      clientUsername: row.username,
      serviceId: row.service_id,
      serviceName: row.service_name,
      startsAt: row.starts_at.toISOString(),
      endsAt: row.ends_at.toISOString(),
      status: row.status,
      createdAt: row.created_at.toISOString(),
    }))
  );
});
```

- [ ] **Step 4: Mount it in `backend/src/app.ts`**

```typescript
import { adminBookingsRouter } from './routes/admin/bookings.js';
// ...
  app.use(
    '/api/admin/bookings',
    validateInitDataMiddleware,
    requireAdminMiddleware,
    adminBookingsRouter
  );
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npm test -- tests/routes/adminBookings.test.ts
```
Expected: PASS.

- [ ] **Step 6: Write the failing test — `backend/tests/routes/adminSettings.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/db.js';
import { config } from '../../src/config.js';

function authHeaderFor(telegramId: number): string {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: telegramId, first_name: 'Admin' }),
  });
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(config.botToken).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  params.set('hash', hash);
  return `tma ${params.toString()}`;
}

describe('/api/admin/settings', () => {
  it('reads then updates business settings', async () => {
    const app = createApp();
    const header = authHeaderFor(1);
    await request(app).get('/api/services').set('Authorization', header);
    await pool.query(`UPDATE users SET role = 'admin' WHERE telegram_id = 1`);

    const getRes = await request(app).get('/api/admin/settings').set('Authorization', header);
    expect(getRes.status).toBe(200);
    expect(getRes.body.slotIntervalMinutes).toBe(30);

    const patchRes = await request(app)
      .patch('/api/admin/settings')
      .set('Authorization', header)
      .send({ ownerChatId: 123456 });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.ownerChatId).toBe(123456);
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

```bash
npm test -- tests/routes/adminSettings.test.ts
```
Expected: FAIL with 404.

- [ ] **Step 8: Create `backend/src/routes/admin/settings.ts`**

```typescript
import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../../db.js';

export const adminSettingsRouter = Router();

function toBusinessSettings(row: any) {
  return {
    workingHours: row.working_hours,
    slotIntervalMinutes: row.slot_interval_minutes,
    bookingHorizonDays: row.booking_horizon_days,
    ownerChatId: row.owner_chat_id !== null ? Number(row.owner_chat_id) : null,
    timezone: row.timezone,
  };
}

adminSettingsRouter.get('/', async (_req, res) => {
  const result = await pool.query('SELECT * FROM business_settings WHERE id = 1');
  res.json(toBusinessSettings(result.rows[0]));
});

const updateSettingsSchema = z.object({
  workingHours: z.record(z.string(), z.any()).optional(),
  slotIntervalMinutes: z.number().int().positive().optional(),
  bookingHorizonDays: z.number().int().positive().optional(),
  ownerChatId: z.number().int().nullable().optional(),
  timezone: z.string().optional(),
});

adminSettingsRouter.patch('/', async (req, res) => {
  const parsed = updateSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const fields = parsed.data;
  const updates: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (fields.workingHours !== undefined) { updates.push(`working_hours = $${i++}`); values.push(JSON.stringify(fields.workingHours)); }
  if (fields.slotIntervalMinutes !== undefined) { updates.push(`slot_interval_minutes = $${i++}`); values.push(fields.slotIntervalMinutes); }
  if (fields.bookingHorizonDays !== undefined) { updates.push(`booking_horizon_days = $${i++}`); values.push(fields.bookingHorizonDays); }
  if (fields.ownerChatId !== undefined) { updates.push(`owner_chat_id = $${i++}`); values.push(fields.ownerChatId); }
  if (fields.timezone !== undefined) { updates.push(`timezone = $${i++}`); values.push(fields.timezone); }
  updates.push(`updated_at = now()`);
  if (updates.length > 0) {
    await pool.query(`UPDATE business_settings SET ${updates.join(', ')} WHERE id = 1`, values);
  }
  const result = await pool.query('SELECT * FROM business_settings WHERE id = 1');
  res.json(toBusinessSettings(result.rows[0]));
});
```

- [ ] **Step 9: Mount it in `backend/src/app.ts`**

```typescript
import { adminSettingsRouter } from './routes/admin/settings.js';
// ...
  app.use(
    '/api/admin/settings',
    validateInitDataMiddleware,
    requireAdminMiddleware,
    adminSettingsRouter
  );
```

- [ ] **Step 10: Run the test to verify it passes**

```bash
npm test -- tests/routes/adminSettings.test.ts
```
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add backend/src/routes/admin/bookings.ts backend/src/routes/admin/settings.ts backend/src/app.ts backend/tests/routes/adminBookings.test.ts backend/tests/routes/adminSettings.test.ts
git commit -m "backend: add admin bookings and settings routes"
```

---

## Task 10: Telegram notifications, wired into booking creation

**Files:**
- Create: `backend/src/services/telegramNotify.ts`
- Modify: `backend/src/routes/bookings.ts`
- Test: `backend/tests/services/telegramNotify.test.ts`
- Test: `backend/tests/routes/bookingsNotify.test.ts`

**Interfaces:**
- Consumes: `config.botToken` (Task 1), `Booking` type (Task 1).
- Produces: `notifyBookingCreated(booking: Booking, clientTelegramId: number, ownerChatId: number | null): Promise<void>` exported from `backend/src/services/telegramNotify.ts`, called from the `POST /api/bookings` handler after a successful create.

- [ ] **Step 1: Write the failing test — `backend/tests/services/telegramNotify.test.ts`**

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import { notifyBookingCreated } from '../../src/services/telegramNotify.js';
import type { Booking } from '../../src/types.js';

const booking: Booking = {
  id: 1,
  userId: 10,
  serviceId: 2,
  serviceName: 'Haircut',
  startsAt: '2099-01-01T09:00:00.000Z',
  endsAt: '2099-01-01T09:30:00.000Z',
  status: 'confirmed',
  createdAt: '2098-01-01T00:00:00.000Z',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('notifyBookingCreated', () => {
  it('sends a message to the client and to the owner chat when ownerChatId is set', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal('fetch', fetchMock);

    await notifyBookingCreated(booking, 777, 999);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [clientCall, ownerCall] = fetchMock.mock.calls;
    expect(JSON.parse(clientCall[1].body).chat_id).toBe(777);
    expect(JSON.parse(clientCall[1].body).text).toContain('Haircut');
    expect(JSON.parse(ownerCall[1].body).chat_id).toBe(999);
  });

  it('skips the owner message when ownerChatId is null, and does not throw if Telegram API fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ ok: false }) });
    vi.stubGlobal('fetch', fetchMock);

    await expect(notifyBookingCreated(booking, 777, null)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- tests/services/telegramNotify.test.ts
```
Expected: FAIL with "Cannot find module '../../src/services/telegramNotify.js'".

- [ ] **Step 3: Create `backend/src/services/telegramNotify.ts`**

```typescript
import { DateTime } from 'luxon';
import { config } from '../config.js';
import type { Booking } from '../types.js';

function formatBookingText(booking: Booking): string {
  const dt = DateTime.fromISO(booking.startsAt).setZone('Europe/Moscow');
  return `${booking.serviceName}, ${dt.toFormat('dd.MM.yyyy')} в ${dt.toFormat('HH:mm')}`;
}

async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (err) {
    console.error('Failed to send Telegram notification', err);
  }
}

export async function notifyBookingCreated(
  booking: Booking,
  clientTelegramId: number,
  ownerChatId: number | null
): Promise<void> {
  await sendTelegramMessage(clientTelegramId, `Вы записаны на ${formatBookingText(booking)}`);
  if (ownerChatId !== null) {
    await sendTelegramMessage(ownerChatId, `Новая запись: ${formatBookingText(booking)}`);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- tests/services/telegramNotify.test.ts
```
Expected: PASS.

- [ ] **Step 5: Write the failing test — `backend/tests/routes/bookingsNotify.test.ts`** (confirms the route wires notification in without blocking the response on Telegram failures)

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/db.js';
import { config } from '../../src/config.js';

function authHeaderFor(telegramId: number): string {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: telegramId, first_name: 'Client' }),
  });
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(config.botToken).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  params.set('hash', hash);
  return `tma ${params.toString()}`;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('POST /api/bookings notifications', () => {
  it('still returns 201 even if the Telegram API call fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const app = createApp();
    const serviceRes = await pool.query(
      `INSERT INTO services (name, price, duration_minutes) VALUES ('Cut', 1000, 30) RETURNING id`
    );

    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', authHeaderFor(42))
      .send({ serviceId: serviceRes.rows[0].id, startsAt: '2099-04-01T09:00:00.000Z' });

    expect(res.status).toBe(201);
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

```bash
npm test -- tests/routes/bookingsNotify.test.ts
```
Expected: FAIL (currently PASSes trivially since notification isn't wired in yet, so re-check: it should already pass. Instead verify by temporarily confirming the route does NOT yet call `notifyBookingCreated` — inspect `bookings.ts`). Proceed to Step 7 regardless, then re-run in Step 8 to confirm behavior holds after wiring.

- [ ] **Step 7: Modify `backend/src/routes/bookings.ts`** — wire in notifications after successful creation. Replace the `POST '/'` handler body:

```typescript
import { notifyBookingCreated } from '../services/telegramNotify.js';
import { pool } from '../db.js';
// (keep existing imports)

bookingsRouter.post('/', async (req, res) => {
  const parsed = createBookingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const result = await createBooking({
    userId: req.user!.id,
    serviceId: parsed.data.serviceId,
    startsAt: parsed.data.startsAt,
  });

  if (!result.ok) {
    if (result.reason === 'conflict') return res.status(409).json({ error: 'Slot no longer available' });
    return res.status(404).json({ error: 'Service not found' });
  }

  res.status(201).json(result.booking);

  const settingsResult = await pool.query('SELECT owner_chat_id FROM business_settings WHERE id = 1');
  const ownerChatId = settingsResult.rows[0]?.owner_chat_id ?? null;
  void notifyBookingCreated(result.booking, req.user!.telegramId, ownerChatId ? Number(ownerChatId) : null);
});
```

Note: the response is sent before awaiting notifications (`void notifyBookingCreated(...)`), so a slow or failing Telegram API never delays or fails the booking response — consistent with the "best-effort" requirement in the spec.

- [ ] **Step 8: Run both notification tests to verify they pass**

```bash
npm test -- tests/services/telegramNotify.test.ts tests/routes/bookingsNotify.test.ts
```
Expected: PASS.

- [ ] **Step 9: Run the full backend test suite**

```bash
npm test
```
Expected: all tests PASS.

- [ ] **Step 10: Commit**

```bash
git add backend/src/services/telegramNotify.ts backend/src/routes/bookings.ts backend/tests/services/telegramNotify.test.ts backend/tests/routes/bookingsNotify.test.ts
git commit -m "backend: send Telegram notifications to client and owner on booking creation"
```

---

## Task 11: Backend README and env finalization

**Files:**
- Create: `backend/README.md`
- Modify: `backend/src/index.ts` (graceful shutdown — nice-to-have, keep minimal)

**Interfaces:**
- None (documentation task). No new exports.

- [ ] **Step 1: Create `backend/README.md`**

```markdown
# Book Me — Backend

Express + TypeScript API for the Telegram booking Mini App.

## Local setup

1. `cp .env.example .env` and fill in `BOT_TOKEN` (from @BotFather).
2. Start local Postgres: `docker compose up -d`
3. Install deps: `npm install`
4. Apply the schema: `npm run migrate`
5. Run tests: `npm test`
6. Start the dev server: `npm run dev` (listens on `PORT`, default 3001)

## Getting your bot token and owner chat id

1. Message [@BotFather](https://t.me/BotFather), send `/newbot`, follow the prompts. Copy the token into `BOT_TOKEN`.
2. To find your `owner_chat_id` (where new-booking notifications go): send any message to your new bot, then open
   `https://api.telegram.org/bot<BOT_TOKEN>/getUpdates` in a browser. Find `"chat":{"id": ...}` in the response — that
   number is your chat id. Set it via `PATCH /api/admin/settings` with `{"ownerChatId": <that number>}` once an admin
   user exists (see below), or update `business_settings.owner_chat_id` directly in Supabase's SQL editor.
3. To become an admin: after opening the Mini App once (so your `users` row exists), run in Supabase's SQL editor:
   `UPDATE users SET role = 'admin' WHERE telegram_id = <your telegram numeric id>;`

## Deploying

Point `DATABASE_URL` at your Supabase project's connection string (Project Settings → Database → Connection string,
use the "Transaction" pooler URL for serverless hosts). Run `npm run migrate` once against that database before first
deploy. Deploy `backend/` to Railway or Render as a standard Node.js service (`npm run build && npm start`), setting
`BOT_TOKEN`, `DATABASE_URL`, `CORS_ORIGIN` (your deployed frontend's origin) as environment variables.
```

- [ ] **Step 2: Commit**

```bash
git add backend/README.md
git commit -m "backend: add setup and deployment README"
```

---

## Task 12: Frontend scaffolding, theme hook

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/vitest.config.ts`
- Create: `frontend/index.html`
- Create: `frontend/.env.example`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/types.ts`
- Create: `frontend/src/theme.css`
- Create: `frontend/src/hooks/useTelegramTheme.ts`
- Create: `frontend/tests/setup.ts`
- Test: `frontend/tests/hooks/useTelegramTheme.test.tsx`

**Interfaces:**
- Produces: `Service`, `TimeSlot`, `Booking`, `BusinessSettings` types mirroring the backend (`frontend/src/types.ts`); `useTelegramTheme(): void` hook from `frontend/src/hooks/useTelegramTheme.ts`, applying `themeParams` as CSS custom properties on `document.documentElement`.

- [ ] **Step 1: Create `frontend/package.json`**

```json
{
  "name": "book-me-frontend",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0",
    "@telegram-apps/sdk-react": "^1.1.3",
    "@tanstack/react-query": "^5.51.23"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.5.4",
    "vite": "^5.4.1",
    "vitest": "^2.0.5",
    "jsdom": "^24.1.1",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.4.8",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0"
  }
}
```

- [ ] **Step 2: Create `frontend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `frontend/vite.config.ts`**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
```

- [ ] **Step 4: Create `frontend/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
  },
});
```

- [ ] **Step 5: Create `frontend/tests/setup.ts`**

```typescript
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 6: Create `frontend/index.html`**

```html
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Запись в салон</title>
    <script src="https://telegram.org/js/telegram-web-app.js"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Create `frontend/.env.example`**

```
VITE_API_BASE_URL=http://localhost:3001
```

- [ ] **Step 8: Create `frontend/src/types.ts`** (mirrors `backend/src/types.ts`)

```typescript
export interface Service {
  id: number;
  name: string;
  description: string | null;
  price: number;
  durationMinutes: number;
  isActive: boolean;
}

export interface TimeSlot {
  startsAt: string;
}

export interface Booking {
  id: number;
  userId: number;
  serviceId: number;
  serviceName: string;
  startsAt: string;
  endsAt: string;
  status: 'confirmed' | 'cancelled';
  createdAt: string;
}

export interface DayWorkingHours {
  start?: string;
  end?: string;
  isClosed?: boolean;
}

export type WorkingHours = Partial<
  Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', DayWorkingHours>
>;

export interface BusinessSettings {
  workingHours: WorkingHours;
  slotIntervalMinutes: number;
  bookingHorizonDays: number;
  ownerChatId: number | null;
  timezone: string;
}
```

- [ ] **Step 9: Write the failing test — `frontend/tests/hooks/useTelegramTheme.test.tsx`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTelegramTheme } from '../../src/hooks/useTelegramTheme';

vi.mock('@telegram-apps/sdk-react', () => ({
  useSignal: vi.fn(),
  themeParams: {
    state: () => ({
      bgColor: '#111111',
      textColor: '#eeeeee',
      buttonColor: '#2481cc',
      buttonTextColor: '#ffffff',
    }),
  },
}));

beforeEach(() => {
  document.documentElement.removeAttribute('style');
});

describe('useTelegramTheme', () => {
  it('applies Telegram theme params as CSS custom properties on the document root', async () => {
    const { useSignal } = await import('@telegram-apps/sdk-react');
    (useSignal as ReturnType<typeof vi.fn>).mockReturnValue({
      bgColor: '#111111',
      textColor: '#eeeeee',
      buttonColor: '#2481cc',
      buttonTextColor: '#ffffff',
    });

    renderHook(() => useTelegramTheme());

    expect(document.documentElement.style.getPropertyValue('--tg-theme-bg-color')).toBe('#111111');
    expect(document.documentElement.style.getPropertyValue('--tg-theme-text-color')).toBe('#eeeeee');
    expect(document.documentElement.style.getPropertyValue('--tg-theme-button-color')).toBe('#2481cc');
  });
});
```

- [ ] **Step 10: Run the test to verify it fails**

```bash
cd frontend
npm install
npm test -- tests/hooks/useTelegramTheme.test.tsx
```
Expected: FAIL with "Cannot find module '../../src/hooks/useTelegramTheme'".

- [ ] **Step 11: Create `frontend/src/hooks/useTelegramTheme.ts`**

```typescript
import { useEffect } from 'react';
import { themeParams, useSignal } from '@telegram-apps/sdk-react';

const CSS_VAR_MAP: Record<string, string> = {
  bgColor: '--tg-theme-bg-color',
  textColor: '--tg-theme-text-color',
  hintColor: '--tg-theme-hint-color',
  linkColor: '--tg-theme-link-color',
  buttonColor: '--tg-theme-button-color',
  buttonTextColor: '--tg-theme-button-text-color',
  secondaryBgColor: '--tg-theme-secondary-bg-color',
};

export function useTelegramTheme(): void {
  const theme = useSignal(themeParams.state);

  useEffect(() => {
    if (!theme) return;
    for (const [key, cssVar] of Object.entries(CSS_VAR_MAP)) {
      const value = (theme as Record<string, string | undefined>)[key];
      if (value) {
        document.documentElement.style.setProperty(cssVar, value);
      }
    }
  }, [theme]);
}
```

- [ ] **Step 12: Create `frontend/src/theme.css`** (used by `main.tsx`; consumed by every page instead of hardcoded colors)

```css
:root {
  --tg-theme-bg-color: #ffffff;
  --tg-theme-text-color: #000000;
  --tg-theme-hint-color: #999999;
  --tg-theme-link-color: #2481cc;
  --tg-theme-button-color: #2481cc;
  --tg-theme-button-text-color: #ffffff;
  --tg-theme-secondary-bg-color: #f0f0f0;
}

body {
  margin: 0;
  background: var(--tg-theme-bg-color);
  color: var(--tg-theme-text-color);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

button.primary {
  background: var(--tg-theme-button-color);
  color: var(--tg-theme-button-text-color);
  border: none;
  border-radius: 8px;
  padding: 12px 16px;
  font-size: 16px;
}
```

- [ ] **Step 13: Create `frontend/src/App.tsx`** (minimal placeholder; pages added in later tasks)

```typescript
export function App() {
  return <div>Book Me</div>;
}
```

- [ ] **Step 14: Create `frontend/src/main.tsx`**

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { init } from '@telegram-apps/sdk-react';
import { App } from './App';
import './theme.css';

init();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 15: Run the test to verify it passes**

```bash
npm test -- tests/hooks/useTelegramTheme.test.tsx
```
Expected: PASS.

- [ ] **Step 16: Commit**

```bash
git add frontend/package.json frontend/tsconfig.json frontend/vite.config.ts frontend/vitest.config.ts frontend/index.html frontend/.env.example frontend/src frontend/tests frontend/package-lock.json
git commit -m "frontend: scaffold Vite + React app with Telegram theme hook"
```

---

## Task 13: API client + React Query setup

**Files:**
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/api/services.ts`
- Create: `frontend/src/api/slots.ts`
- Create: `frontend/src/api/bookings.ts`
- Create: `frontend/src/api/user.ts`
- Create: `frontend/src/api/admin.ts`
- Modify: `frontend/src/App.tsx` (wrap in `QueryClientProvider`)
- Test: `frontend/tests/api/client.test.ts`

**Interfaces:**
- Produces: `apiFetch<T>(path: string, options?: RequestInit): Promise<T>` from `frontend/src/api/client.ts`, throwing `ApiError` (with `status: number`) on non-2xx; `getServices()`, `getSlots(serviceId, date)`, `createBooking(input)`, `getMyBookings()`, `cancelBooking(id)`, `getWhoAmI()` (returns `WhoAmI { id, telegramId, role, firstName }`), and `admin*` functions built on top of it. `getWhoAmI` is consumed by Task 15 (Confirm screen, to show the client's name) and Task 17 (admin role gate).

- [ ] **Step 1: Write the failing test — `frontend/tests/api/client.test.ts`**

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiFetch, ApiError } from '../../src/api/client';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('apiFetch', () => {
  it('sends the Telegram init data as a Bearer-style tma Authorization header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ hello: 'world' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('window', { Telegram: { WebApp: { initData: 'auth_date=1&hash=abc' } } });

    const result = await apiFetch<{ hello: string }>('/api/services');

    expect(result).toEqual({ hello: 'world' });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/services');
    expect((options.headers as Record<string, string>).Authorization).toBe('tma auth_date=1&hash=abc');
  });

  it('throws ApiError with the response status on a non-2xx response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: 'conflict' }) })
    );
    vi.stubGlobal('window', { Telegram: { WebApp: { initData: '' } } });

    await expect(apiFetch('/api/bookings')).rejects.toMatchObject({ status: 409 } satisfies Partial<ApiError>);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- tests/api/client.test.ts
```
Expected: FAIL with "Cannot find module '../../src/api/client'".

- [ ] **Step 3: Create `frontend/src/api/client.ts`**

```typescript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function getInitData(): string {
  return (window as any).Telegram?.WebApp?.initData ?? '';
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `tma ${getInitData()}`,
      ...options.headers,
    },
  });

  const body = await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new ApiError(response.status, (body as { error?: string })?.error ?? 'Request failed');
  }
  return body as T;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- tests/api/client.test.ts
```
Expected: PASS.

- [ ] **Step 5: Create `frontend/src/api/services.ts`**

```typescript
import { apiFetch } from './client';
import type { Service } from '../types';

export function getServices(): Promise<Service[]> {
  return apiFetch<Service[]>('/api/services');
}
```

- [ ] **Step 6: Create `frontend/src/api/slots.ts`**

```typescript
import { apiFetch } from './client';
import type { TimeSlot } from '../types';

export function getSlots(serviceId: number, date: string): Promise<TimeSlot[]> {
  return apiFetch<TimeSlot[]>(`/api/slots?service_id=${serviceId}&date=${date}`);
}
```

- [ ] **Step 7: Create `frontend/src/api/bookings.ts`**

```typescript
import { apiFetch } from './client';
import type { Booking } from '../types';

export function createBooking(input: { serviceId: number; startsAt: string }): Promise<Booking> {
  return apiFetch<Booking>('/api/bookings', { method: 'POST', body: JSON.stringify(input) });
}

export function getMyBookings(): Promise<Booking[]> {
  return apiFetch<Booking[]>('/api/bookings/my');
}

export function cancelBooking(id: number): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/api/bookings/${id}/cancel`, { method: 'PATCH' });
}
```

- [ ] **Step 8: Create `frontend/src/api/user.ts`** (used both by the booking confirmation screen for the client's name and by the admin role gate in Task 17)

```typescript
import { apiFetch } from './client';

export interface WhoAmI {
  id: number;
  telegramId: number;
  role: 'client' | 'admin';
  firstName: string | null;
}

export function getWhoAmI(): Promise<WhoAmI> {
  return apiFetch<WhoAmI>('/api/whoami');
}
```

- [ ] **Step 9: Create `frontend/src/api/admin.ts`**

```typescript
import { apiFetch } from './client';
import type { Service, BusinessSettings } from '../types';

export interface AdminBooking {
  id: number;
  clientFirstName: string | null;
  clientUsername: string | null;
  serviceName: string;
  startsAt: string;
  endsAt: string;
  status: 'confirmed' | 'cancelled';
}

export function getAdminBookings(date: string): Promise<AdminBooking[]> {
  return apiFetch<AdminBooking[]>(`/api/admin/bookings?date=${date}`);
}

export function getAdminServices(): Promise<Service[]> {
  return apiFetch<Service[]>('/api/admin/services');
}

export function createAdminService(input: {
  name: string;
  description?: string;
  price: number;
  durationMinutes: number;
}): Promise<{ id: number }> {
  return apiFetch<{ id: number }>('/api/admin/services', { method: 'POST', body: JSON.stringify(input) });
}

export function deleteAdminService(id: number): Promise<void> {
  return apiFetch<void>(`/api/admin/services/${id}`, { method: 'DELETE' });
}

export function getAdminSettings(): Promise<BusinessSettings> {
  return apiFetch<BusinessSettings>('/api/admin/settings');
}

export function updateAdminSettings(input: Partial<BusinessSettings>): Promise<BusinessSettings> {
  return apiFetch<BusinessSettings>('/api/admin/settings', { method: 'PATCH', body: JSON.stringify(input) });
}
```

- [ ] **Step 10: Modify `frontend/src/App.tsx`** to provide React Query (routes added in Task 14):

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div>Book Me</div>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 11: Run the full frontend test suite**

```bash
npm test
```
Expected: all PASS.

- [ ] **Step 12: Commit**

```bash
git add frontend/src/api frontend/src/App.tsx frontend/tests/api
git commit -m "frontend: add typed API client, user/services/slots/bookings/admin API modules, and React Query provider"
```

---

## Task 14: Services list page

**Files:**
- Create: `frontend/src/pages/ServicesList/ServicesList.tsx`
- Modify: `frontend/src/App.tsx` (add router + route)
- Test: `frontend/tests/pages/ServicesList.test.tsx`

**Interfaces:**
- Consumes: `getServices` (Task 13), `Service` type (Task 12).
- Produces: `ServicesList` component, default route `/`.

- [ ] **Step 1: Write the failing test — `frontend/tests/pages/ServicesList.test.tsx`**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ServicesList } from '../../src/pages/ServicesList/ServicesList';
import * as servicesApi from '../../src/api/services';

vi.mock('../../src/api/services');

describe('ServicesList', () => {
  it('renders each active service with its price and duration', async () => {
    vi.spyOn(servicesApi, 'getServices').mockResolvedValue([
      { id: 1, name: 'Haircut', description: null, price: 1500, durationMinutes: 30, isActive: true },
      { id: 2, name: 'Beard trim', description: null, price: 800, durationMinutes: 20, isActive: true },
    ]);
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ServicesList />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getByText('Haircut')).toBeInTheDocument());
    expect(screen.getByText('Beard trim')).toBeInTheDocument();
    expect(screen.getByText(/1500/)).toBeInTheDocument();
    expect(screen.getByText(/30/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- tests/pages/ServicesList.test.tsx
```
Expected: FAIL with "Cannot find module '../../src/pages/ServicesList/ServicesList'".

- [ ] **Step 3: Create `frontend/src/pages/ServicesList/ServicesList.tsx`**

```typescript
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getServices } from '../../api/services';

export function ServicesList() {
  const { data: services, isLoading, error } = useQuery({ queryKey: ['services'], queryFn: getServices });

  if (isLoading) return <p>Загрузка...</p>;
  if (error) return <p>Не удалось загрузить услуги</p>;

  return (
    <div>
      <h1>Услуги</h1>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {services!.map((service) => (
          <li key={service.id}>
            <Link to={`/booking/${service.id}`}>
              <div style={{ background: 'var(--tg-theme-secondary-bg-color)', padding: 12, borderRadius: 8, marginBottom: 8 }}>
                <div>{service.name}</div>
                <div>{service.price} ₽ · {service.durationMinutes} мин</div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <Link to="/my-bookings">Мои записи</Link>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- tests/pages/ServicesList.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Modify `frontend/src/App.tsx`** to add routing:

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ServicesList } from './pages/ServicesList/ServicesList';
import { useTelegramTheme } from './hooks/useTelegramTheme';

const queryClient = new QueryClient();

export function App() {
  useTelegramTheme();
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ServicesList />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/ServicesList frontend/src/App.tsx frontend/tests/pages/ServicesList.test.tsx
git commit -m "frontend: add services list page and routing"
```

---

## Task 15: Booking flow — select slot + confirm

**Files:**
- Create: `frontend/src/hooks/useMainButton.ts`
- Create: `frontend/src/hooks/useBackButton.ts`
- Create: `frontend/src/pages/BookingFlow/SelectSlot.tsx`
- Create: `frontend/src/pages/BookingFlow/Confirm.tsx`
- Modify: `frontend/src/App.tsx` (routes)
- Test: `frontend/tests/pages/SelectSlot.test.tsx`
- Test: `frontend/tests/pages/Confirm.test.tsx`

**Interfaces:**
- Consumes: `getServices`, `getSlots`, `createBooking`, `getWhoAmI` (Task 13); `Service`, `TimeSlot` types (Task 12).
- Produces: `useMainButton({ text, onClick, enabled }): void` and `useBackButton(onClick: () => void): void` hooks wrapping the SDK; `SelectSlot` at `/booking/:serviceId`, `Confirm` at `/booking/:serviceId/confirm` (reads the chosen slot via `useSearchParams`, so no extra state management library is needed).

- [ ] **Step 1: Create `frontend/src/hooks/useMainButton.ts`**

```typescript
import { useEffect } from 'react';
import { mainButton } from '@telegram-apps/sdk-react';

export function useMainButton(options: { text: string; onClick: () => void; enabled: boolean }): void {
  useEffect(() => {
    mainButton.setParams({ text: options.text, isEnabled: options.enabled, isVisible: true });
    mainButton.onClick(options.onClick);
    return () => {
      mainButton.offClick(options.onClick);
      mainButton.setParams({ isVisible: false });
    };
  }, [options.text, options.onClick, options.enabled]);
}
```

- [ ] **Step 2: Create `frontend/src/hooks/useBackButton.ts`**

```typescript
import { useEffect } from 'react';
import { backButton } from '@telegram-apps/sdk-react';

export function useBackButton(onClick: () => void): void {
  useEffect(() => {
    backButton.show();
    backButton.onClick(onClick);
    return () => {
      backButton.offClick(onClick);
      backButton.hide();
    };
  }, [onClick]);
}
```

- [ ] **Step 3: Write the failing test — `frontend/tests/pages/SelectSlot.test.tsx`**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRoutes, MemoryRouter, Route, Routes } from 'react-router-dom';
import { SelectSlot } from '../../src/pages/BookingFlow/SelectSlot';
import * as slotsApi from '../../src/api/slots';
import * as servicesApi from '../../src/api/services';

vi.mock('../../src/api/slots');
vi.mock('../../src/api/services');
vi.mock('@telegram-apps/sdk-react', () => ({
  mainButton: { setParams: vi.fn(), onClick: vi.fn(), offClick: vi.fn() },
  backButton: { show: vi.fn(), hide: vi.fn(), onClick: vi.fn(), offClick: vi.fn() },
}));

describe('SelectSlot', () => {
  it('lists available slots for the selected date and navigates to confirm on pick', async () => {
    vi.spyOn(servicesApi, 'getServices').mockResolvedValue([
      { id: 1, name: 'Haircut', description: null, price: 1500, durationMinutes: 30, isActive: true },
    ]);
    vi.spyOn(slotsApi, 'getSlots').mockResolvedValue([{ startsAt: '2099-01-01T09:00:00.000Z' }]);
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/booking/1']}>
          <Routes>
            <Route path="/booking/:serviceId" element={<SelectSlot />} />
            <Route path="/booking/:serviceId/confirm" element={<div>Confirm screen</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    const slotButton = await screen.findByRole('button', { name: /09:00/ });
    fireEvent.click(slotButton);

    await waitFor(() => expect(screen.getByText('Confirm screen')).toBeInTheDocument());
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

```bash
npm test -- tests/pages/SelectSlot.test.tsx
```
Expected: FAIL with "Cannot find module '../../src/pages/BookingFlow/SelectSlot'".

- [ ] **Step 5: Create `frontend/src/pages/BookingFlow/SelectSlot.tsx`**

```typescript
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { getServices } from '../../api/services';
import { getSlots } from '../../api/slots';
import { useBackButton } from '../../hooks/useBackButton';

const DAYS_AHEAD = 14;

export function SelectSlot() {
  const { serviceId } = useParams<{ serviceId: string }>();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(() => DateTime.now().toISODate()!);

  useBackButton(() => navigate('/'));

  const { data: services } = useQuery({ queryKey: ['services'], queryFn: getServices });
  const service = services?.find((s) => s.id === Number(serviceId));

  const { data: slots } = useQuery({
    queryKey: ['slots', serviceId, selectedDate],
    queryFn: () => getSlots(Number(serviceId), selectedDate),
    enabled: Boolean(serviceId),
  });

  const dateOptions = useMemo(
    () => Array.from({ length: DAYS_AHEAD }, (_, i) => DateTime.now().plus({ days: i }).toISODate()!),
    []
  );

  function pickSlot(startsAt: string) {
    navigate(`/booking/${serviceId}/confirm?startsAt=${encodeURIComponent(startsAt)}`);
  }

  return (
    <div>
      <h1>{service?.name ?? 'Выбор времени'}</h1>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
        {dateOptions.map((date) => (
          <button key={date} onClick={() => setSelectedDate(date)} aria-pressed={date === selectedDate}>
            {DateTime.fromISO(date).toFormat('dd.MM')}
          </button>
        ))}
      </div>
      <div>
        {slots?.length === 0 && <p>Нет свободных слотов на эту дату</p>}
        {slots?.map((slot) => {
          const label = DateTime.fromISO(slot.startsAt).toFormat('HH:mm');
          return (
            <button key={slot.startsAt} onClick={() => pickSlot(slot.startsAt)}>
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Run the test to verify it passes**

```bash
npm test -- tests/pages/SelectSlot.test.tsx
```
Expected: PASS.

- [ ] **Step 7: Write the failing test — `frontend/tests/pages/Confirm.test.tsx`**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Confirm } from '../../src/pages/BookingFlow/Confirm';
import * as servicesApi from '../../src/api/services';
import * as bookingsApi from '../../src/api/bookings';
import * as userApi from '../../src/api/user';

vi.mock('../../src/api/services');
vi.mock('../../src/api/bookings');
vi.mock('../../src/api/user');
vi.mock('@telegram-apps/sdk-react', () => ({
  mainButton: { setParams: vi.fn(), onClick: vi.fn(), offClick: vi.fn() },
  backButton: { show: vi.fn(), hide: vi.fn(), onClick: vi.fn(), offClick: vi.fn() },
}));

describe('Confirm', () => {
  it('shows the client name, chosen service and time, and submits the booking on main button click', async () => {
    vi.spyOn(servicesApi, 'getServices').mockResolvedValue([
      { id: 1, name: 'Haircut', description: null, price: 1500, durationMinutes: 30, isActive: true },
    ]);
    vi.spyOn(userApi, 'getWhoAmI').mockResolvedValue({ id: 1, telegramId: 10, role: 'client', firstName: 'Ann' });
    const createBookingMock = vi.spyOn(bookingsApi, 'createBooking').mockResolvedValue({
      id: 1, userId: 1, serviceId: 1, serviceName: 'Haircut',
      startsAt: '2099-01-01T09:00:00.000Z', endsAt: '2099-01-01T09:30:00.000Z',
      status: 'confirmed', createdAt: '2098-01-01T00:00:00.000Z',
    });
    const queryClient = new QueryClient();
    const { mainButton } = await import('@telegram-apps/sdk-react');

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/booking/1/confirm?startsAt=2099-01-01T09%3A00%3A00.000Z']}>
          <Routes>
            <Route path="/booking/:serviceId/confirm" element={<Confirm />} />
            <Route path="/my-bookings" element={<div>My bookings screen</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getByText('Haircut')).toBeInTheDocument());
    expect(screen.getByText(/Ann/)).toBeInTheDocument();

    const onClickCall = (mainButton.onClick as ReturnType<typeof vi.fn>).mock.calls.at(-1)![0];
    await onClickCall();

    expect(createBookingMock).toHaveBeenCalledWith({ serviceId: 1, startsAt: '2099-01-01T09:00:00.000Z' });
    await waitFor(() => expect(screen.getByText('My bookings screen')).toBeInTheDocument());
  });
});
```

- [ ] **Step 8: Run the test to verify it fails**

```bash
npm test -- tests/pages/Confirm.test.tsx
```
Expected: FAIL with "Cannot find module '../../src/pages/BookingFlow/Confirm'".

- [ ] **Step 9: Create `frontend/src/pages/BookingFlow/Confirm.tsx`**

```typescript
import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { getServices } from '../../api/services';
import { createBooking } from '../../api/bookings';
import { getWhoAmI } from '../../api/user';
import { ApiError } from '../../api/client';
import { useMainButton } from '../../hooks/useMainButton';
import { useBackButton } from '../../hooks/useBackButton';

export function Confirm() {
  const { serviceId } = useParams<{ serviceId: string }>();
  const [searchParams] = useSearchParams();
  const startsAt = searchParams.get('startsAt')!;
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const { data: services } = useQuery({ queryKey: ['services'], queryFn: getServices });
  const service = services?.find((s) => s.id === Number(serviceId));
  const { data: me } = useQuery({ queryKey: ['whoami'], queryFn: getWhoAmI });

  useBackButton(() => navigate(-1));

  async function handleConfirm() {
    setError(null);
    try {
      await createBooking({ serviceId: Number(serviceId), startsAt });
      navigate('/my-bookings');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('Этот слот только что заняли, выберите другое время');
        navigate(-1);
      } else {
        setError('Не удалось создать запись, попробуйте ещё раз');
      }
    }
  }

  useMainButton({ text: 'Записаться', onClick: handleConfirm, enabled: Boolean(service) });

  if (!service) return <p>Загрузка...</p>;

  const dt = DateTime.fromISO(startsAt).setZone('Europe/Moscow');

  return (
    <div>
      <h1>{service.name}</h1>
      {me?.firstName && <p>Записываем: {me.firstName}</p>}
      <p>{dt.toFormat('dd.MM.yyyy')} в {dt.toFormat('HH:mm')}</p>
      <p>{service.price} ₽ · {service.durationMinutes} мин</p>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 10: Run the test to verify it passes**

```bash
npm test -- tests/pages/Confirm.test.tsx
```
Expected: PASS.

- [ ] **Step 11: Modify `frontend/src/App.tsx`** to add the two routes:

```typescript
import { SelectSlot } from './pages/BookingFlow/SelectSlot';
import { Confirm } from './pages/BookingFlow/Confirm';
// ...
        <Routes>
          <Route path="/" element={<ServicesList />} />
          <Route path="/booking/:serviceId" element={<SelectSlot />} />
          <Route path="/booking/:serviceId/confirm" element={<Confirm />} />
        </Routes>
```

- [ ] **Step 12: Commit**

```bash
git add frontend/src/hooks/useMainButton.ts frontend/src/hooks/useBackButton.ts frontend/src/pages/BookingFlow frontend/src/App.tsx frontend/tests/pages/SelectSlot.test.tsx frontend/tests/pages/Confirm.test.tsx
git commit -m "frontend: add booking flow — slot selection and confirmation with MainButton/BackButton"
```

---

## Task 16: My Bookings page

**Files:**
- Create: `frontend/src/pages/MyBookings/MyBookings.tsx`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/tests/pages/MyBookings.test.tsx`

**Interfaces:**
- Consumes: `getMyBookings`, `cancelBooking` (Task 13).
- Produces: `MyBookings` component at `/my-bookings`.

- [ ] **Step 1: Write the failing test — `frontend/tests/pages/MyBookings.test.tsx`**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { MyBookings } from '../../src/pages/MyBookings/MyBookings';
import * as bookingsApi from '../../src/api/bookings';

vi.mock('../../src/api/bookings');

describe('MyBookings', () => {
  it('lists bookings and cancels a confirmed one on button click', async () => {
    vi.spyOn(bookingsApi, 'getMyBookings').mockResolvedValue([
      {
        id: 1, userId: 1, serviceId: 1, serviceName: 'Haircut',
        startsAt: '2099-01-01T09:00:00.000Z', endsAt: '2099-01-01T09:30:00.000Z',
        status: 'confirmed', createdAt: '2098-01-01T00:00:00.000Z',
      },
    ]);
    const cancelMock = vi.spyOn(bookingsApi, 'cancelBooking').mockResolvedValue({ ok: true });
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MyBookings />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getByText('Haircut')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /отменить/i }));

    await waitFor(() => expect(cancelMock).toHaveBeenCalledWith(1));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- tests/pages/MyBookings.test.tsx
```
Expected: FAIL with "Cannot find module '../../src/pages/MyBookings/MyBookings'".

- [ ] **Step 3: Create `frontend/src/pages/MyBookings/MyBookings.tsx`**

```typescript
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { getMyBookings, cancelBooking } from '../../api/bookings';
import { useBackButton } from '../../hooks/useBackButton';
import { useNavigate } from 'react-router-dom';

export function MyBookings() {
  const navigate = useNavigate();
  useBackButton(() => navigate('/'));

  const queryClient = useQueryClient();
  const { data: bookings } = useQuery({ queryKey: ['myBookings'], queryFn: getMyBookings });

  const cancelMutation = useMutation({
    mutationFn: cancelBooking,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['myBookings'] }),
  });

  return (
    <div>
      <h1>Мои записи</h1>
      {bookings?.map((booking) => {
        const dt = DateTime.fromISO(booking.startsAt).setZone('Europe/Moscow');
        return (
          <div key={booking.id}>
            <div>{booking.serviceName}</div>
            <div>{dt.toFormat('dd.MM.yyyy')} в {dt.toFormat('HH:mm')}</div>
            <div>{booking.status === 'confirmed' ? 'Подтверждена' : 'Отменена'}</div>
            {booking.status === 'confirmed' && (
              <button onClick={() => cancelMutation.mutate(booking.id)}>Отменить</button>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- tests/pages/MyBookings.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Modify `frontend/src/App.tsx`** to add the route:

```typescript
import { MyBookings } from './pages/MyBookings/MyBookings';
// ...
          <Route path="/my-bookings" element={<MyBookings />} />
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/MyBookings frontend/src/App.tsx frontend/tests/pages/MyBookings.test.tsx
git commit -m "frontend: add My Bookings page with cancel action"
```

---

## Task 17: Admin panel — bookings and services

**Files:**
- Create: `frontend/src/pages/Admin/AdminBookings.tsx`
- Create: `frontend/src/pages/Admin/AdminServices.tsx`
- Create: `frontend/src/pages/Admin/AdminLayout.tsx`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/tests/pages/AdminServices.test.tsx`

**Interfaces:**
- Consumes: `getAdminBookings`, `getAdminServices`, `createAdminService`, `deleteAdminService` (Task 13); `getWhoAmI` (Task 13, `frontend/src/api/user.ts`) for the role gate.
- Produces: `AdminLayout` (role gate + tab nav, no `MainButton`/`BackButton` per spec §5 item 5), `AdminBookings`, `AdminServices`, route `/admin`.

- [ ] **Step 1: Write the failing test — `frontend/tests/pages/AdminServices.test.tsx`**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AdminServices } from '../../src/pages/Admin/AdminServices';
import * as adminApi from '../../src/api/admin';

vi.mock('../../src/api/admin');

describe('AdminServices', () => {
  it('lists services and creates a new one from the form', async () => {
    vi.spyOn(adminApi, 'getAdminServices').mockResolvedValue([
      { id: 1, name: 'Haircut', description: null, price: 1500, durationMinutes: 30, isActive: true },
    ]);
    const createMock = vi.spyOn(adminApi, 'createAdminService').mockResolvedValue({ id: 2 });

    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AdminServices />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getByText('Haircut')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/название/i), { target: { value: 'Beard trim' } });
    fireEvent.change(screen.getByLabelText(/цена/i), { target: { value: '800' } });
    fireEvent.change(screen.getByLabelText(/длительность/i), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: /добавить/i }));

    await waitFor(() =>
      expect(createMock).toHaveBeenCalledWith({ name: 'Beard trim', price: 800, durationMinutes: 20 })
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- tests/pages/AdminServices.test.tsx
```
Expected: FAIL with "Cannot find module '../../src/pages/Admin/AdminServices'".

- [ ] **Step 3: Create `frontend/src/pages/Admin/AdminServices.tsx`**

```typescript
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getAdminServices, createAdminService, deleteAdminService } from '../../api/admin';

export function AdminServices() {
  const queryClient = useQueryClient();
  const { data: services } = useQuery({ queryKey: ['adminServices'], queryFn: getAdminServices });
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');

  const createMutation = useMutation({
    mutationFn: createAdminService,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminServices'] });
      setName('');
      setPrice('');
      setDurationMinutes('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAdminService,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['adminServices'] }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate({ name, price: Number(price), durationMinutes: Number(durationMinutes) });
  }

  return (
    <div>
      <h2>Услуги</h2>
      <ul>
        {services?.map((service) => (
          <li key={service.id}>
            {service.name} — {service.price} ₽, {service.durationMinutes} мин
            {service.isActive && <button onClick={() => deleteMutation.mutate(service.id)}>Удалить</button>}
          </li>
        ))}
      </ul>
      <form onSubmit={handleSubmit}>
        <label htmlFor="service-name">Название</label>
        <input id="service-name" value={name} onChange={(e) => setName(e.target.value)} />
        <label htmlFor="service-price">Цена</label>
        <input id="service-price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
        <label htmlFor="service-duration">Длительность</label>
        <input
          id="service-duration"
          type="number"
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(e.target.value)}
        />
        <button type="submit">Добавить</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- tests/pages/AdminServices.test.tsx
```
Expected: PASS.

- [ ] **Step 5: Create `frontend/src/pages/Admin/AdminBookings.tsx`** (not test-driven separately — same pattern as `AdminServices`, straightforward read-only list; covered by manual verification in Task 18)

```typescript
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { getAdminBookings } from '../../api/admin';

export function AdminBookings() {
  const [date, setDate] = useState(() => DateTime.now().toISODate()!);
  const { data: bookings } = useQuery({ queryKey: ['adminBookings', date], queryFn: () => getAdminBookings(date) });

  return (
    <div>
      <h2>Записи на день</h2>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <table>
        <thead>
          <tr><th>Время</th><th>Клиент</th><th>Услуга</th></tr>
        </thead>
        <tbody>
          {bookings?.map((booking) => (
            <tr key={booking.id}>
              <td>{DateTime.fromISO(booking.startsAt).setZone('Europe/Moscow').toFormat('HH:mm')}</td>
              <td>{booking.clientFirstName ?? booking.clientUsername ?? '—'}</td>
              <td>{booking.serviceName}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 6: Create `frontend/src/pages/Admin/AdminLayout.tsx`**

```typescript
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { getWhoAmI } from '../../api/user';
import { AdminBookings } from './AdminBookings';
import { AdminServices } from './AdminServices';

export function AdminLayout() {
  const { data: me, isLoading } = useQuery({ queryKey: ['whoami'], queryFn: getWhoAmI });
  const [tab, setTab] = useState<'bookings' | 'services'>('bookings');

  if (isLoading) return <p>Загрузка...</p>;
  if (me?.role !== 'admin') return <Navigate to="/" replace />;

  return (
    <div>
      <nav>
        <button onClick={() => setTab('bookings')}>Записи на день</button>
        <button onClick={() => setTab('services')}>Услуги</button>
      </nav>
      {tab === 'bookings' ? <AdminBookings /> : <AdminServices />}
    </div>
  );
}
```

- [ ] **Step 7: Modify `frontend/src/App.tsx`** to add the route:

```typescript
import { AdminLayout } from './pages/Admin/AdminLayout';
// ...
          <Route path="/admin" element={<AdminLayout />} />
```

- [ ] **Step 8: Run the full frontend test suite**

```bash
npm test
```
Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/pages/Admin frontend/src/api/admin.ts frontend/src/App.tsx frontend/tests/pages/AdminServices.test.tsx
git commit -m "frontend: add admin panel with role gate, daily bookings view, and services CRUD"
```

---

## Task 18: Root README, frontend README, end-to-end manual verification

**Files:**
- Create: `frontend/README.md`
- Create: `README.md` (repo root)
- Create: `.gitignore` (repo root)

**Interfaces:**
- None (documentation + manual verification task).

- [ ] **Step 1: Create root `.gitignore`**

```
node_modules/
dist/
.env
*.local
```

- [ ] **Step 2: Create `frontend/README.md`**

```markdown
# Book Me — Frontend

React + TypeScript Telegram Mini App.

## Local setup

1. `cp .env.example .env`, set `VITE_API_BASE_URL` to your running backend (default `http://localhost:3001`).
2. `npm install`
3. `npm test`
4. `npm run dev` — opens on `http://localhost:5173`

## Testing inside Telegram

Vite's dev server isn't reachable from Telegram's mobile clients directly. To test inside the real Telegram app:
1. Expose your local dev server with a tunnel (e.g. `ngrok http 5173`).
2. In @BotFather, run `/newapp` (or `/myapps` → your bot → Edit Web App URL) and set the HTTPS tunnel URL.
3. Open the bot in Telegram and launch the Mini App from its menu button.

For quick iteration without Telegram, you can also open `http://localhost:5173` directly in a desktop browser —
`@telegram-apps/sdk-react` falls back gracefully outside Telegram for most calls, but `initData` will be empty, so
API requests will get a 401 until you run inside Telegram or a tunnel.
```

- [ ] **Step 3: Create root `README.md`**

```markdown
# Book Me — Telegram Booking Mini App

Telegram Mini App for booking services at a single salon/barbershop.

- [`backend/`](backend/README.md) — Express + TypeScript API, Supabase Postgres.
- [`frontend/`](frontend/README.md) — React + TypeScript Mini App.
- [`docs/superpowers/specs/2026-07-29-telegram-booking-miniapp-design.md`](docs/superpowers/specs/2026-07-29-telegram-booking-miniapp-design.md) — full design spec.

## Quick start

1. Follow `backend/README.md` to stand up Postgres, run migrations, and start the API on port 3001.
2. Follow `frontend/README.md` to start the Vite dev server on port 5173.
3. To test inside real Telegram, tunnel port 5173 and register the URL as your bot's Mini App (see frontend README).
```

- [ ] **Step 4: Run both test suites one final time**

```bash
(cd backend && npm test)
(cd frontend && npm test)
```
Expected: all PASS in both.

- [ ] **Step 5: Manual end-to-end verification** (requires both dev servers running, Task 1–17 complete)

Start backend (`cd backend && npm run dev`) and frontend (`cd frontend && npm run dev`) in separate terminals, then in a browser at `http://localhost:5173`:
1. Confirm the services list renders (seed at least one service via `POST /api/admin/services` using `curl` with a hand-crafted `tma` header, or temporarily insert directly via SQL for this check).
2. Click a service, confirm the date/slot picker loads and slots reflect `business_settings.working_hours`.
3. Pick a slot, confirm the confirm screen shows correct service/date/time, submit, confirm redirect to `/my-bookings` and the new booking appears.
4. Cancel the booking from `/my-bookings`, confirm status flips to "Отменена" and the slot reopens in step 2's picker.
5. Promote your test user to `admin` via SQL, reload, confirm `/admin` is reachable and blocked for non-admins.
Note in the session which of these passed; since `initData` is empty outside real Telegram, steps 1–4 will 401 unless
you either run through a Telegram tunnel (see frontend README) or add a temporary dev bypass — flag this limitation
to the user rather than silently skipping verification.

- [ ] **Step 6: Commit**

```bash
git add README.md .gitignore frontend/README.md
git commit -m "docs: add root and frontend READMEs, gitignore"
```
