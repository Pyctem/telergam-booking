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
  // Optional: when set, booking notifications include a web_app button
  // linking back into the Mini App. Must be an https URL — Telegram
  // rejects web_app buttons otherwise — so it's left unset in local dev.
  frontendUrl: process.env.FRONTEND_URL,
};
