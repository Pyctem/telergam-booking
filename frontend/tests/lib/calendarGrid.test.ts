import { describe, it, expect } from 'vitest';
import { generateCalendarWeeks } from '../../src/lib/calendarGrid';

describe('generateCalendarWeeks', () => {
  it('generates a single-month grid when the horizon stays within one month', () => {
    // 2026-08-01 is a Saturday
    const weeks = generateCalendarWeeks('2026-08-01', 14);

    // Every week has exactly 7 slots
    weeks.forEach((week) => expect(week).toHaveLength(7));

    // First week: Mon 2026-07-27 .. Sun 2026-08-02, so the first 5 cells (Mon-Fri, July) are null padding
    expect(weeks[0].slice(0, 5)).toEqual([null, null, null, null, null]);
    expect(weeks[0][5]).toEqual({ date: '2026-08-01', enabled: true }); // Saturday
    expect(weeks[0][6]).toEqual({ date: '2026-08-02', enabled: true }); // Sunday

    // Last enabled date is 2026-08-01 + 13 days = 2026-08-14
    const flat = weeks.flat().filter((d): d is { date: string; enabled: boolean } => d !== null);
    const enabledDates = flat.filter((d) => d.enabled).map((d) => d.date);
    expect(enabledDates[0]).toBe('2026-08-01');
    expect(enabledDates[enabledDates.length - 1]).toBe('2026-08-14');
    expect(enabledDates).toHaveLength(14);

    // Days after the horizon are present (padding out August) but disabled
    const aug15 = flat.find((d) => d.date === '2026-08-15');
    expect(aug15).toEqual({ date: '2026-08-15', enabled: false });

    // Grid does not extend into September at all (horizon ends within August)
    expect(flat.some((d) => d.date.startsWith('2026-09'))).toBe(false);
  });

  it('extends the grid into the next month when the horizon crosses a month boundary', () => {
    // 2026-08-25 + 13 days = 2026-09-07
    const weeks = generateCalendarWeeks('2026-08-25', 14);
    const flat = weeks.flat().filter((d): d is { date: string; enabled: boolean } => d !== null);

    const enabledDates = flat.filter((d) => d.enabled).map((d) => d.date);
    expect(enabledDates[0]).toBe('2026-08-25');
    expect(enabledDates[enabledDates.length - 1]).toBe('2026-09-07');
    expect(enabledDates).toHaveLength(14);

    // Full August (from the 1st) and full September (through the 30th) are both present
    expect(flat.some((d) => d.date === '2026-08-01')).toBe(true);
    expect(flat.some((d) => d.date === '2026-09-30')).toBe(true);
    // Nothing from October
    expect(flat.some((d) => d.date.startsWith('2026-10'))).toBe(false);

    // A day in September after the horizon window is disabled
    const sep8 = flat.find((d) => d.date === '2026-09-08');
    expect(sep8).toEqual({ date: '2026-09-08', enabled: false });
  });

  it('handles a 1-day horizon (only today enabled)', () => {
    const weeks = generateCalendarWeeks('2026-08-10', 1);
    const flat = weeks.flat().filter((d): d is { date: string; enabled: boolean } => d !== null);
    const enabledDates = flat.filter((d) => d.enabled).map((d) => d.date);
    expect(enabledDates).toEqual(['2026-08-10']);
  });
});
