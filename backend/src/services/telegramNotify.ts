import { DateTime } from 'luxon';
import { config } from '../config.js';
import type { Booking } from '../types.js';

function formatBookingText(booking: Booking, timezone: string): string {
  const dt = DateTime.fromISO(booking.startsAt).setZone(timezone);
  return `${booking.serviceName}, ${dt.toFormat('dd.MM.yyyy')} at ${dt.toFormat('HH:mm')}`;
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
  ownerChatId: number | null,
  timezone: string,
  clientName: string | null
): Promise<void> {
  await sendTelegramMessage(clientTelegramId, `You're booked for ${formatBookingText(booking, timezone)}`);
  if (ownerChatId !== null) {
    const name = clientName ?? 'Client';
    await sendTelegramMessage(ownerChatId, `New booking: ${name}, ${formatBookingText(booking, timezone)}`);
  }
}
