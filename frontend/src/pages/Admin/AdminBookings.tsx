import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { List, Section, Cell, Input, Placeholder, Spinner } from '@telegram-apps/telegram-ui';
import { getAdminBookings } from '../../api/admin';
import { useBusinessSettings } from '../../hooks/useBusinessSettings';

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

  const { data: bookings } = useQuery({
    queryKey: ['adminBookings', date],
    queryFn: () => getAdminBookings(date!),
    enabled: date !== null,
  });

  if (settingsPending || !settings || date === null) {
    return (
      <Placeholder header="Loading...">
        <Spinner size="m" />
      </Placeholder>
    );
  }

  // Built as a filtered array (instead of `{cond && <Placeholder/>}` inline
  // among siblings) because Section inserts a Divider between children using
  // Children.map/Children.count, which counts a bare `false` as a child
  // slot — that would render a stray divider whenever the empty-state
  // Placeholder doesn't render (i.e. whenever there are 1+ bookings, or
  // while `bookings` is still undefined during the initial fetch).
  const sectionChildren = [
    <Input
      key="date"
      type="date"
      header="Date"
      aria-label="Date"
      value={date}
      onChange={(e) => setDate(e.target.value)}
    />,
    bookings?.length === 0 && <Placeholder key="empty" description="No bookings for this date" />,
    ...(bookings?.map((booking) => (
      <Cell
        key={booking.id}
        subtitle={DateTime.fromISO(booking.startsAt).setZone(settings.timezone).toFormat('HH:mm')}
      >
        {`${booking.clientFirstName ?? booking.clientUsername ?? '—'} · ${booking.serviceName}`}
      </Cell>
    )) ?? []),
  ].filter((cell): cell is JSX.Element => Boolean(cell));

  return (
    <List>
      <Section header="Today's Bookings">{sectionChildren}</Section>
    </List>
  );
}
