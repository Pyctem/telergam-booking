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
