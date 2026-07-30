import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DateTime } from 'luxon';
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

  if (settingsPending || !settings || date === null) return <p>Loading...</p>;

  return (
    <div>
      <h2>Today's Bookings</h2>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <table>
        <thead>
          <tr><th>Time</th><th>Client</th><th>Service</th></tr>
        </thead>
        <tbody>
          {bookings?.map((booking) => (
            <tr key={booking.id}>
              <td>{DateTime.fromISO(booking.startsAt).setZone(settings.timezone).toFormat('HH:mm')}</td>
              <td>{booking.clientFirstName ?? booking.clientUsername ?? '—'}</td>
              <td>{booking.serviceName}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
