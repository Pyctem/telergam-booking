import { DateTime } from 'luxon';

export interface CalendarDay {
  date: string; // "YYYY-MM-DD"
  enabled: boolean;
}

export type CalendarWeek = (CalendarDay | null)[]; // always length 7, Monday-first; null = padding

export interface CalendarMonth {
  monthISO: string; // "YYYY-MM"
  monthLabel: string; // English month name + year, e.g. "August 2026"
  weeks: CalendarWeek[];
}

// Monday of the ISO week containing dt, computed from Luxon's locale-independent
// `weekday` (1=Mon..7=Sun) rather than `startOf('week')`, whose first-day-of-week
// depends on the active locale and is not something to assume without checking.
function mondayOf(dt: DateTime): DateTime {
  return dt.startOf('day').minus({ days: dt.weekday - 1 });
}

// English month name, capitalized (e.g. "August 2026"). The explicit
// capitalization is defensive — Luxon's 'en' locale already capitalizes
// 'LLLL', unlike 'ru' where the standalone form is lowercase — but this
// keeps the function correct even if the locale changes again later.
function monthLabelOf(monthStart: DateTime): string {
  const raw = monthStart.setLocale('en').toFormat('LLLL yyyy');
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

// Builds a complete Monday-first week grid for a single calendar month,
// padded with `null` before the 1st and after the last day so every week is
// exactly 7 cells. Kept as a standalone month grid (rather than a
// continuous range that can straddle a month boundary mid-week) precisely
// so a caller can render one unambiguous month caption above each block:
// a week that mixed, say, the last two days of August with the first five
// of September would make "which month is this row?" ambiguous at exactly
// the boundary, defeating the point of labelling months at all.
function buildMonthWeeks(monthStart: DateTime, monthEnd: DateTime, today: DateTime, lastEnabled: DateTime): CalendarWeek[] {
  const weeks: CalendarWeek[] = [];
  let cursor = mondayOf(monthStart);
  const lastWeekStart = mondayOf(monthEnd);

  while (cursor <= lastWeekStart) {
    const week: CalendarWeek = [];
    for (let i = 0; i < 7; i++) {
      if (cursor < monthStart || cursor > monthEnd) {
        week.push(null);
      } else {
        week.push({
          date: cursor.toISODate()!,
          enabled: cursor >= today && cursor <= lastEnabled,
        });
      }
      cursor = cursor.plus({ days: 1 });
    }
    weeks.push(week);
  }
  return weeks;
}

/**
 * Generates the booking calendar grid, grouped by calendar month so each
 * month can be rendered under its own label. Always includes the full
 * current month (even the already-past days before "today", padded and
 * disabled) through the full month in which the booking horizon ends.
 */
export function generateCalendarMonths(todayISO: string, horizonDays: number): CalendarMonth[] {
  const today = DateTime.fromISO(todayISO).startOf('day');
  const lastEnabled = today.plus({ days: horizonDays - 1 });

  const firstMonthStart = today.startOf('month');
  const lastMonthStart = lastEnabled.startOf('month');

  const months: CalendarMonth[] = [];
  let monthCursor = firstMonthStart;
  while (monthCursor <= lastMonthStart) {
    const monthStart = monthCursor.startOf('month');
    const monthEnd = monthCursor.endOf('month').startOf('day');
    months.push({
      monthISO: monthStart.toFormat('yyyy-MM'),
      monthLabel: monthLabelOf(monthStart),
      weeks: buildMonthWeeks(monthStart, monthEnd, today, lastEnabled),
    });
    monthCursor = monthCursor.plus({ months: 1 });
  }
  return months;
}

/** Flattens grouped months back into a plain list of weeks, in order. */
export function flattenCalendarMonths(months: CalendarMonth[]): CalendarWeek[] {
  return months.flatMap((month) => month.weeks);
}
