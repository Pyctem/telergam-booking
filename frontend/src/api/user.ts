import { apiFetch } from './client';

export interface WhoAmI {
  id: number;
  telegramId: number;
  role: 'client' | 'admin';
  firstName: string | null;
}

export function getWhoAmI(): Promise<WhoAmI> {
  return apiFetch<WhoAmI>('/api/whoami');
}
