import { apiFetch } from './client';
import type { Booking } from '../types';

export function createBooking(input: { serviceId: number; startsAt: string }): Promise<Booking> {
  return apiFetch<Booking>('/api/bookings', { method: 'POST', body: JSON.stringify(input) });
}

export function getMyBookings(): Promise<Booking[]> {
  return apiFetch<Booking[]>('/api/bookings/my');
}

export function cancelBooking(id: number): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/api/bookings/${id}/cancel`, { method: 'PATCH' });
}
