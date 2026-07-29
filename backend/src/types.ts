export interface Service {
  id: number;
  name: string;
  description: string | null;
  price: number;
  durationMinutes: number;
  isActive: boolean;
}

export interface TimeSlot {
  startsAt: string; // ISO 8601 UTC
}

export interface Booking {
  id: number;
  userId: number;
  serviceId: number;
  serviceName: string;
  startsAt: string;
  endsAt: string;
  status: 'confirmed' | 'cancelled';
  createdAt: string;
}

export interface DayWorkingHours {
  start?: string; // "HH:mm"
  end?: string; // "HH:mm"
  isClosed?: boolean;
}

export type WorkingHours = Partial<
  Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', DayWorkingHours>
>;

export interface BusinessSettings {
  workingHours: WorkingHours;
  slotIntervalMinutes: number;
  bookingHorizonDays: number;
  ownerChatId: number | null;
  timezone: string;
}

export interface AuthenticatedUser {
  id: number;
  telegramId: number;
  role: 'client' | 'admin';
  firstName: string | null;
}
