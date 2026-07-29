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
