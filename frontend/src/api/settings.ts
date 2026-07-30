import { apiFetch } from './client';
import type { PublicBusinessSettings } from '../types';

export function getSettings(): Promise<PublicBusinessSettings> {
  return apiFetch<PublicBusinessSettings>('/api/settings');
}
