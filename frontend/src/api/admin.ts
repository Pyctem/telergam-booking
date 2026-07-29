import { apiFetch } from './client';
import type { Service, BusinessSettings } from '../types';

export interface AdminBooking {
  id: number;
  clientFirstName: string | null;
  clientUsername: string | null;
  serviceName: string;
  startsAt: string;
  endsAt: string;
  status: 'confirmed' | 'cancelled';
}

export function getAdminBookings(date: string): Promise<AdminBooking[]> {
  return apiFetch<AdminBooking[]>(`/api/admin/bookings?date=${date}`);
}

export function getAdminServices(): Promise<Service[]> {
  return apiFetch<Service[]>('/api/admin/services');
}

export function createAdminService(input: {
  name: string;
  description?: string;
  price: number;
  durationMinutes: number;
}): Promise<{ id: number }> {
  return apiFetch<{ id: number }>('/api/admin/services', { method: 'POST', body: JSON.stringify(input) });
}

export function deleteAdminService(id: number): Promise<void> {
  return apiFetch<void>(`/api/admin/services/${id}`, { method: 'DELETE' });
}

export function getAdminSettings(): Promise<BusinessSettings> {
  return apiFetch<BusinessSettings>('/api/admin/settings');
}

export function updateAdminSettings(input: Partial<BusinessSettings>): Promise<BusinessSettings> {
  return apiFetch<BusinessSettings>('/api/admin/settings', { method: 'PATCH', body: JSON.stringify(input) });
}
