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

  return (
    <List>
      <Section header="Today's Bookings">
        <Input
          type="date"
          header="Date"
          aria-label="Date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        {bookings?.length === 0 && <Placeholder description="No bookings for this date" />}
        {bookings?.map((booking) => (
          <Cell
            key={booking.id}
            subtitle={DateTime.fromISO(booking.startsAt).setZone(settings.timezone).toFormat('HH:mm')}
          >
            {`${booking.clientFirstName ?? booking.clientUsername ?? '—'} · ${booking.serviceName}`}
          </Cell>
        ))}
      </Section>
    </List>
  );
}
