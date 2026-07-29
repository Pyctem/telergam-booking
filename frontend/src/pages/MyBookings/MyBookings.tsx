import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { getMyBookings, cancelBooking } from '../../api/bookings';
import { useBackButton } from '../../hooks/useBackButton';
import { useNavigate } from 'react-router-dom';

export function MyBookings() {
  const navigate = useNavigate();
  useBackButton(() => navigate('/'));

  const queryClient = useQueryClient();
  const { data: bookings } = useQuery({ queryKey: ['myBookings'], queryFn: getMyBookings });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => cancelBooking(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['myBookings'] }),
  });

  return (
    <div>
      <h1>Мои записи</h1>
      {bookings?.map((booking) => {
        const dt = DateTime.fromISO(booking.startsAt).setZone('Europe/Moscow');
        return (
          <div key={booking.id}>
            <div>{booking.serviceName}</div>
            <div>{dt.toFormat('dd.MM.yyyy')} в {dt.toFormat('HH:mm')}</div>
            <div>{booking.status === 'confirmed' ? 'Подтверждена' : 'Отменена'}</div>
            {booking.status === 'confirmed' && (
              <button onClick={() => cancelMutation.mutate(booking.id)}>Отменить</button>
            )}
          </div>
        );
      })}
    </div>
  );
}
