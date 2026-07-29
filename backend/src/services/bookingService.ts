import { pool } from '../db.js';
import type { Booking } from '../types.js';

interface CreateBookingParams {
  userId: number;
  serviceId: number;
  startsAt: string; // ISO
}

type CreateBookingResult =
  | { ok: true; booking: Booking }
  | { ok: false; reason: 'conflict' | 'not_found' };

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
