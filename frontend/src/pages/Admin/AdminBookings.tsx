import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { getAdminBookings } from '../../api/admin';

export function AdminBookings() {
  const [date, setDate] = useState(() => DateTime.now().toISODate()!);
  const { data: bookings } = useQuery({ queryKey: ['adminBookings', date], queryFn: () => getAdminBookings(date) });

  return (
    <div>
      <h2>Записи на день</h2>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <table>
        <thead>
          <tr><th>Время</th><th>Клиент</th><th>Услуга</th></tr>
        </thead>
        <tbody>
          {bookings?.map((booking) => (
            <tr key={booking.id}>
              <td>{DateTime.fromISO(booking.startsAt).setZone('Europe/Moscow').toFormat('HH:mm')}</td>
              <td>{booking.clientFirstName ?? booking.clientUsername ?? '—'}</td>
              <td>{booking.serviceName}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
