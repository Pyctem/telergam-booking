export interface Service {
  id: number;
  name: string;
  description: string | null;
  price: number;
  durationMinutes: number;
  isActive: boolean;
}

export interface TimeSlot {
  startsAt: string;
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
  start?: string;
  end?: string;
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

// Subset of BusinessSettings returned by the public GET /api/settings route.
// That route deliberately omits workingHours/ownerChatId (admin-only, served
// via /api/admin/settings) — keep this type in sync with the real response
// shape rather than widening it back to the full BusinessSettings.
export type PublicBusinessSettings = Pick<BusinessSettings, 'timezone' | 'bookingHorizonDays'>;
