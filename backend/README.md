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
