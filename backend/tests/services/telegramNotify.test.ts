import { describe, it, expect, vi, afterEach } from 'vitest';
import { notifyBookingCreated } from '../../src/services/telegramNotify.js';
import { config } from '../../src/config.js';
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
  it('sends a message to the client and to the owner chat when ownerChatId is set, including the client name', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal('fetch', fetchMock);

    await notifyBookingCreated(booking, 777, 999, 'Europe/Moscow', 'Ivan');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [clientCall, ownerCall] = fetchMock.mock.calls;
    expect(JSON.parse(clientCall[1].body).chat_id).toBe(777);
    expect(JSON.parse(clientCall[1].body).text).toContain('Haircut');
    expect(JSON.parse(clientCall[1].body).text).not.toContain('Ivan');
    expect(JSON.parse(ownerCall[1].body).chat_id).toBe(999);
    expect(JSON.parse(ownerCall[1].body).text).toContain('Ivan');
  });

  it('falls back to "Client" in the owner message when clientName is null', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal('fetch', fetchMock);

    await notifyBookingCreated(booking, 777, 999, 'Europe/Moscow', null);

    const [, ownerCall] = fetchMock.mock.calls;
    expect(JSON.parse(ownerCall[1].body).text).toContain('Client');
  });

  it('formats the notification time using the given timezone, not a hardcoded one', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal('fetch', fetchMock);

    // booking.startsAt is '2099-01-01T09:00:00.000Z'; in Europe/Moscow (+3)
    // that's 12:00, but in Asia/Tokyo (+9) it's 18:00.
    await notifyBookingCreated(booking, 777, null, 'Asia/Tokyo', null);

    const [clientCall] = fetchMock.mock.calls;
    expect(JSON.parse(clientCall[1].body).text).toContain('18:00');
  });

  it('skips the owner message when ownerChatId is null, and does not throw if Telegram API fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ ok: false }) });
    vi.stubGlobal('fetch', fetchMock);

    await expect(notifyBookingCreated(booking, 777, null, 'Europe/Moscow', 'Ivan')).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('attaches a single web_app inline button pointing into the Mini App when FRONTEND_URL is set', async () => {
    // A message with exactly one inline button gets that button surfaced
    // directly on the chat's row in the chat list - this only fires for
    // https URLs, which is why frontendUrl is unset (and this behavior
    // skipped) in every other test/local dev.
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal('fetch', fetchMock);
    config.frontendUrl = 'https://example.vercel.app';

    try {
      await notifyBookingCreated(booking, 777, 999, 'Europe/Moscow', 'Ivan');

      const [clientCall, ownerCall] = fetchMock.mock.calls;
      const clientButton = JSON.parse(clientCall[1].body).reply_markup.inline_keyboard[0][0];
      expect(clientButton).toEqual({ text: 'My Bookings', web_app: { url: 'https://example.vercel.app/my-bookings' } });
      const ownerButton = JSON.parse(ownerCall[1].body).reply_markup.inline_keyboard[0][0];
      expect(ownerButton).toEqual({ text: 'Admin Panel', web_app: { url: 'https://example.vercel.app/admin' } });
    } finally {
      config.frontendUrl = undefined;
    }
  });

  it('omits reply_markup entirely when FRONTEND_URL is not set', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal('fetch', fetchMock);

    await notifyBookingCreated(booking, 777, 999, 'Europe/Moscow', 'Ivan');

    const [clientCall] = fetchMock.mock.calls;
    expect(JSON.parse(clientCall[1].body).reply_markup).toBeUndefined();
  });
});
