import { DateTime } from 'luxon';
import type { WorkingHours } from '../types.js';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export interface GenerateSlotsParams {
  date: string; // "YYYY-MM-DD"
  workingHours: WorkingHours;
  slotIntervalMinutes: number;
  serviceDurationMinutes: number;
  existingBookings: { startsAt: Date; endsAt: Date }[];
  timezone: string;
  now: Date;
}

export function generateSlots(params: GenerateSlotsParams): string[] {
  const { date, workingHours, slotIntervalMinutes, serviceDurationMinutes, existingBookings, timezone, now } =
    params;

  const dayStart = DateTime.fromISO(date, { zone: timezone }).startOf('day');
  const dayKey = DAY_KEYS[dayStart.weekday % 7];
  const hours = workingHours[dayKey];
  if (!hours || hours.isClosed || !hours.start || !hours.end) return [];

  const [startH, startM] = hours.start.split(':').map(Number);
  const [endH, endM] = hours.end.split(':').map(Number);
  const windowStart = dayStart.set({ hour: startH, minute: startM });
  const windowEnd = dayStart.set({ hour: endH, minute: endM });
  const nowDt = DateTime.fromJSDate(now);

  const slots: string[] = [];
  let cursor = windowStart;
  while (cursor.plus({ minutes: serviceDurationMinutes }) <= windowEnd) {
    const slotStart = cursor;
    const slotEnd = cursor.plus({ minutes: serviceDurationMinutes });

    const isPast = slotStart <= nowDt;
    const overlaps = existingBookings.some((booking) => {
      const bookingStart = DateTime.fromJSDate(booking.startsAt);
      const bookingEnd = DateTime.fromJSDate(booking.endsAt);
      return slotStart < bookingEnd && bookingStart < slotEnd;
    });

    if (!isPast && !overlaps) {
      slots.push(slotStart.toUTC().toISO({ suppressMilliseconds: false })!);
    }
    cursor = cursor.plus({ minutes: slotIntervalMinutes });
  }

  return slots;
}
