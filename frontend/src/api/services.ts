import { apiFetch } from './client';
import type { Service } from '../types';

export function getServices(): Promise<Service[]> {
  return apiFetch<Service[]>('/api/services');
}
