import { DateTime } from 'luxon';
import { config } from '../config.js';
import type { Booking } from '../types.js';

function formatBookingText(booking: Booking, timezone: string): string {
  const dt = DateTime.fromISO(booking.startsAt).setZone(timezone);
  return `${booking.serviceName}, ${dt.toFormat('dd.MM.yyyy')} at ${dt.toFormat('HH:mm')}`;
}

async function sendTelegramMessage(
  chatId: number,
  text: string,
  button?: { text: string; path: string }
): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        // A message whose only reply markup is a single inline button gets
        // that button surfaced directly on the chat's row in the chat list
        // (replacing the text preview), so a tap opens the Mini App without
        // opening the chat first. web_app buttons require an https URL,
        // which is why this is skipped entirely when frontendUrl isn't set.
        ...(button && config.frontendUrl
          ? {
              reply_markup: {
                inline_keyboard: [[{ text: button.text, web_app: { url: `${config.frontendUrl}${button.path}` } }]],
              },
            }
          : {}),
      }),
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
  await sendTelegramMessage(
    clientTelegramId,
    `You're booked for ${formatBookingText(booking, timezone)}`,
    { text: 'My Bookings', path: '/my-bookings' }
  );
  if (ownerChatId !== null) {
    const name = clientName ?? 'Client';
    await sendTelegramMessage(
      ownerChatId,
      `New booking: ${name}, ${formatBookingText(booking, timezone)}`,
      { text: 'Admin Panel', path: '/admin' }
    );
  }
}
