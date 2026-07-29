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
