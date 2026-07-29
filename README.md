# Book Me — Telegram Booking Mini App

Telegram Mini App for booking services at a single salon/barbershop.

- [`backend/`](backend/README.md) — Express + TypeScript API, Supabase Postgres.
- [`frontend/`](frontend/README.md) — React + TypeScript Mini App.
- [`docs/superpowers/specs/2026-07-29-telegram-booking-miniapp-design.md`](docs/superpowers/specs/2026-07-29-telegram-booking-miniapp-design.md) — full design spec.

## Quick start

1. Follow `backend/README.md` to stand up Postgres, run migrations, and start the API on port 3001.
2. Follow `frontend/README.md` to start the Vite dev server on port 5173.
3. To test inside real Telegram, tunnel port 5173 and register the URL as your bot's Mini App (see frontend README).
