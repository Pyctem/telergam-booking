import { apiFetch } from './client';
import type { TimeSlot } from '../types';

export function getSlots(serviceId: number, date: string): Promise<TimeSlot[]> {
  return apiFetch<TimeSlot[]>(`/api/slots?service_id=${serviceId}&date=${date}`);
}
