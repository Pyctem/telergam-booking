import { describe, it, expect } from 'vitest';
import { generateSlots } from '../../src/lib/slotGenerator.js';

const WORKING_HOURS = {
  mon: { start: '09:00', end: '11:00' },
  sun: { isClosed: true },
};

describe('generateSlots', () => {
  it('generates slots across the working window at the given interval', () => {
    // 2024-01-01 is a Monday
    const slots = generateSlots({
      date: '2024-01-01',
      workingHours: WORKING_HOURS,
      slotIntervalMinutes: 30,
      serviceDurationMinutes: 30,
      existingBookings: [],
      timezone: 'UTC',
      now: new Date('2023-12-01T00:00:00Z'),
    });

    expect(slots).toEqual([
      '2024-01-01T09:00:00.000Z',
      '2024-01-01T09:30:00.000Z',
      '2024-01-01T10:00:00.000Z',
      '2024-01-01T10:30:00.000Z',
    ]);
  });

  it('excludes slots that would run past the working window given the service duration', () => {
    const slots = generateSlots({
      date: '2024-01-01',
      workingHours: WORKING_HOURS,
      slotIntervalMinutes: 30,
      serviceDurationMinutes: 90,
      existingBookings: [],
      timezone: 'UTC',
      now: new Date('2023-12-01T00:00:00Z'),
    });

    // Only a 90-minute service starting at 09:00 or 09:30 fits before 11:00
    expect(slots).toEqual(['2024-01-01T09:00:00.000Z', '2024-01-01T09:30:00.000Z']);
  });

  it('excludes slots that overlap an existing booking', () => {
    const slots = generateSlots({
      date: '2024-01-01',
      workingHours: WORKING_HOURS,
      slotIntervalMinutes: 30,
      serviceDurationMinutes: 30,
      existingBookings: [
        { startsAt: new Date('2024-01-01T09:30:00.000Z'), endsAt: new Date('2024-01-01T10:00:00.000Z') },
      ],
      timezone: 'UTC',
      now: new Date('2023-12-01T00:00:00Z'),
    });

    expect(slots).toEqual([
      '2024-01-01T09:00:00.000Z',
      '2024-01-01T10:00:00.000Z',
      '2024-01-01T10:30:00.000Z',
    ]);
  });

  it('excludes slots that are already in the past relative to now', () => {
    const slots = generateSlots({
      date: '2024-01-01',
      workingHours: WORKING_HOURS,
      slotIntervalMinutes: 30,
      serviceDurationMinutes: 30,
      existingBookings: [],
      timezone: 'UTC',
      now: new Date('2024-01-01T09:45:00.000Z'),
    });

    expect(slots).toEqual(['2024-01-01T10:00:00.000Z', '2024-01-01T10:30:00.000Z']);
  });

  it('returns an empty array for a closed day', () => {
    // 2023-12-31 is a Sunday
    const slots = generateSlots({
      date: '2023-12-31',
      workingHours: WORKING_HOURS,
      slotIntervalMinutes: 30,
      serviceDurationMinutes: 30,
      existingBookings: [],
      timezone: 'UTC',
      now: new Date('2023-12-01T00:00:00Z'),
    });

    expect(slots).toEqual([]);
  });
});
