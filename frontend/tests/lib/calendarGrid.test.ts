import { describe, it, expect } from 'vitest';
import { generateCalendarMonths, flattenCalendarMonths } from '../../src/lib/calendarGrid';

describe('generateCalendarMonths', () => {
  it('generates a single-month grid when the horizon stays within one month', () => {
    // 2026-08-01 is a Saturday
    const months = generateCalendarMonths('2026-08-01', 14);
    const weeks = flattenCalendarMonths(months);

    // Every week has exactly 7 slots
    weeks.forEach((week) => expect(week).toHaveLength(7));

    // Only one month block, labelled August 2026
    expect(months).toHaveLength(1);
    expect(months[0].monthISO).toBe('2026-08');
    expect(months[0].monthLabel).toBe('August 2026');

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
    const months = generateCalendarMonths('2026-08-25', 14);
    const weeks = flattenCalendarMonths(months);
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

    // Two separate month blocks, each with its own label, in chronological order
    expect(months).toHaveLength(2);
    expect(months[0].monthISO).toBe('2026-08');
    expect(months[0].monthLabel).toBe('August 2026');
    expect(months[1].monthISO).toBe('2026-09');
    expect(months[1].monthLabel).toBe('September 2026');

    // Every day belonging to August lives only in the August block's weeks
    // (and vice versa for September) — no week mixes real day-numbers from
    // both months, which is what made two adjacent months visually
    // indistinguishable before this grouping existed.
    const augDatesInAugBlock = months[0].weeks
      .flat()
      .filter((d): d is { date: string; enabled: boolean } => d !== null)
      .map((d) => d.date);
    expect(augDatesInAugBlock.every((d) => d.startsWith('2026-08'))).toBe(true);

    const sepDatesInSepBlock = months[1].weeks
      .flat()
      .filter((d): d is { date: string; enabled: boolean } => d !== null)
      .map((d) => d.date);
    expect(sepDatesInSepBlock.every((d) => d.startsWith('2026-09'))).toBe(true);
  });

  it('handles a 1-day horizon (only today enabled)', () => {
    const months = generateCalendarMonths('2026-08-10', 1);
    const weeks = flattenCalendarMonths(months);
    const flat = weeks.flat().filter((d): d is { date: string; enabled: boolean } => d !== null);
    const enabledDates = flat.filter((d) => d.enabled).map((d) => d.date);
    expect(enabledDates).toEqual(['2026-08-10']);
  });
});
