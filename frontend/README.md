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
