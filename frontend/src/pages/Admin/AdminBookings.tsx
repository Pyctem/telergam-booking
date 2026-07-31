import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { List, Section, Cell, Input, Placeholder } from '@telegram-apps/telegram-ui';
import { getAdminBookings } from '../../api/admin';
import { useBusinessSettings } from '../../hooks/useBusinessSettings';
import { SkeletonRows } from '../../components/SkeletonRows';

export function AdminBookings() {
  const { data: settings, isPending: settingsPending } = useBusinessSettings();

  // Same reasoning as SelectSlot: "today" depends on the business's
  // timezone, which isn't known until settings load, so date starts out
  // unknown rather than defaulting to the device's local "today".
  const [date, setDate] = useState<string | null>(null);

  useEffect(() => {
    if (settings && date === null) {
      setDate(DateTime.now().setZone(settings.timezone).toISODate()!);
    }
  }, [settings, date]);

  const { data: bookings, isPending: bookingsPending } = useQuery({
    queryKey: ['adminBookings', date],
    queryFn: () => getAdminBookings(date!),
    enabled: date !== null,
  });

  if (settingsPending || !settings || date === null) {
    return (
      <List>
        <Section header="Today's Bookings">
          <SkeletonRows label="Loading bookings" />
        </Section>
      </List>
    );
  }

  // Built as a plain array of real elements, pushed conditionally, rather
  // than inline `{cond && <X/>}` JSX among siblings — Section inserts a
  // Divider between its own direct children using Children.map/Children.count,
  // which counts a bare `false` slot as a child too and would render a
  // stray divider for it.
  const rows: JSX.Element[] = [
    <Input
      key="date"
      type="date"
      header="Date"
      aria-label="Date"
      value={date}
      onChange={(e) => setDate(e.target.value)}
    />,
  ];
  // `date` is part of the query key, so picking a new date always starts a
  // fresh isPending: true (react-query treats it as a different query).
  // Without tracking that, the list rendered nothing for the old date's
  // now-stale `bookings` and then flashed the "no bookings" empty state
  // before the new date's rows arrived — a visible jump on every date change.
  if (bookingsPending) {
    rows.push(<SkeletonRows key="skeleton" label="Loading bookings" />);
  } else if (bookings?.length === 0) {
    rows.push(<Placeholder key="empty" description="No bookings for this date" />);
  } else {
    bookings?.forEach((booking) => {
      rows.push(
        <Cell
          key={booking.id}
          subtitle={DateTime.fromISO(booking.startsAt).setZone(settings.timezone).toFormat('HH:mm')}
        >
          {`${booking.clientFirstName ?? booking.clientUsername ?? '—'} · ${booking.serviceName}`}
        </Cell>
      );
    });
  }

  return (
    <List>
      <Section header="Today's Bookings">{rows}</Section>
    </List>
  );
}
