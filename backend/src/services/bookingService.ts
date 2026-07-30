import { DateTime } from 'luxon';
import { pool } from '../db.js';
import { generateSlots } from '../lib/slotGenerator.js';
import type { Booking, WorkingHours } from '../types.js';

interface CreateBookingParams {
  userId: number;
  serviceId: number;
  startsAt: string; // ISO
}

type CreateBookingResult =
  | { ok: true; booking: Booking }
  | { ok: false; reason: 'conflict' | 'not_found' | 'invalid_slot' };

const EXCLUSION_VIOLATION = '23P01';

export async function createBooking(params: CreateBookingParams): Promise<CreateBookingResult> {
  const serviceResult = await pool.query(
    'SELECT name, duration_minutes FROM services WHERE id = $1 AND is_active = true',
    [params.serviceId]
  );
  if (serviceResult.rows.length === 0) {
    return { ok: false, reason: 'not_found' };
  }
  const { name: serviceName, duration_minutes: durationMinutes } = serviceResult.rows[0];

  const settingsResult = await pool.query('SELECT * FROM business_settings WHERE id = 1');
  const settings = settingsResult.rows[0];

  // Interpret the requested instant in the business's configured timezone so
  // the "day" (and therefore the working-hours window and slot grid) matches
  // what GET /api/slots computed it as. `startsAt` always carries its own
  // offset (validated upstream as a full ISO datetime), so this just changes
  // the zone used for *display*/day-bucketing, not the underlying instant.
  const startsAtDt = DateTime.fromISO(params.startsAt, { zone: settings.timezone });
  if (!startsAtDt.isValid) {
    return { ok: false, reason: 'invalid_slot' };
  }
  const date = startsAtDt.toISODate()!;

  // Same UTC-range query pattern as GET /api/slots and GET /api/admin/bookings
  // use (timezone-correct day boundaries, not a bare `::date` cast).
  const dayStart = startsAtDt.startOf('day');
  const dayEnd = dayStart.plus({ days: 1 });
  const bookingsResult = await pool.query(
    `SELECT starts_at, ends_at FROM bookings
     WHERE status = 'confirmed' AND starts_at >= $1 AND starts_at < $2`,
    [dayStart.toUTC().toISO(), dayEnd.toUTC().toISO()]
  );

  const slots = generateSlots({
    date,
    workingHours: settings.working_hours as WorkingHours,
    slotIntervalMinutes: settings.slot_interval_minutes,
    serviceDurationMinutes: durationMinutes,
    existingBookings: bookingsResult.rows.map((row) => ({
      startsAt: new Date(row.starts_at),
      endsAt: new Date(row.ends_at),
    })),
    timezone: settings.timezone,
    now: new Date(),
  });

  const requestedSlotIso = startsAtDt.toUTC().toISO({ suppressMilliseconds: false });
  if (!slots.includes(requestedSlotIso!)) {
    return { ok: false, reason: 'invalid_slot' };
  }

  try {
    const result = await pool.query(
      `INSERT INTO bookings (user_id, service_id, starts_at, ends_at)
       VALUES ($1, $2, $3::timestamptz, $3::timestamptz + ($4 || ' minutes')::interval)
       RETURNING id, user_id, service_id, starts_at, ends_at, status, created_at`,
      [params.userId, params.serviceId, params.startsAt, durationMinutes]
    );
    const row = result.rows[0];
    return {
      ok: true,
      booking: {
        id: row.id,
        userId: row.user_id,
        serviceId: row.service_id,
        serviceName,
        startsAt: row.starts_at.toISOString(),
        endsAt: row.ends_at.toISOString(),
        status: row.status,
        createdAt: row.created_at.toISOString(),
      },
    };
  } catch (err) {
    const pgError = err as { code?: string };
    if (pgError.code === EXCLUSION_VIOLATION) {
      return { ok: false, reason: 'conflict' };
    }
    throw err;
  }
}
