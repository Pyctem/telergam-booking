import { DateTime } from 'luxon';

export interface CalendarDay {
  date: string; // "YYYY-MM-DD"
  enabled: boolean;
}

export type CalendarWeek = (CalendarDay | null)[]; // always length 7, Monday-first; null = padding

// Monday of the ISO week containing dt, computed from Luxon's locale-independent
// `weekday` (1=Mon..7=Sun) rather than `startOf('week')`, whose first-day-of-week
// depends on the active locale and is not something to assume without checking.
function mondayOf(dt: DateTime): DateTime {
  return dt.startOf('day').minus({ days: dt.weekday - 1 });
}

export function generateCalendarWeeks(todayISO: string, horizonDays: number): CalendarWeek[] {
  const today = DateTime.fromISO(todayISO).startOf('day');
  const lastEnabled = today.plus({ days: horizonDays - 1 });

  const gridStart = today.startOf('month');
  const gridEnd = lastEnabled.endOf('month').startOf('day');

  const weeks: CalendarWeek[] = [];
  let cursor = mondayOf(gridStart);
  const lastWeekStart = mondayOf(gridEnd);

  while (cursor <= lastWeekStart) {
    const week: CalendarWeek = [];
    for (let i = 0; i < 7; i++) {
      if (cursor < gridStart || cursor > gridEnd) {
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
