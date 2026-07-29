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
