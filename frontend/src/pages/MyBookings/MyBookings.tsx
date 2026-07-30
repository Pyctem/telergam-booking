import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { List, Section, Cell, Badge, Caption, Button, Placeholder, Spinner } from '@telegram-apps/telegram-ui';
import { getMyBookings, cancelBooking } from '../../api/bookings';
import { useBackButton } from '../../hooks/useBackButton';
import { useBusinessSettings } from '../../hooks/useBusinessSettings';
import { useNavigate } from 'react-router-dom';

export function MyBookings() {
  const navigate = useNavigate();
  useBackButton(() => navigate('/'));

  const queryClient = useQueryClient();
  const { data: bookings } = useQuery({ queryKey: ['myBookings'], queryFn: getMyBookings });
  const { data: settings, isPending: settingsPending } = useBusinessSettings();

  const cancelMutation = useMutation({
    mutationFn: (id: number) => cancelBooking(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['myBookings'] }),
  });

  if (settingsPending || !settings) {
    return (
      <Placeholder header="Загрузка...">
        <Spinner size="m" />
      </Placeholder>
    );
  }

  return (
    <List>
      <Section header="Мои записи">
        {bookings?.map((booking) => {
          const dt = DateTime.fromISO(booking.startsAt).setZone(settings.timezone);
          const isConfirmed = booking.status === 'confirmed';
          return (
            <Cell
              key={booking.id}
              subtitle={`${dt.toFormat('dd.MM.yyyy')} в ${dt.toFormat('HH:mm')}`}
              after={
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Badge type="dot" mode={isConfirmed ? 'primary' : 'gray'} />
                    <Caption weight="2">{isConfirmed ? 'Подтверждена' : 'Отменена'}</Caption>
                  </span>
                  {isConfirmed && (
                    <Button size="s" mode="outline" onClick={() => cancelMutation.mutate(booking.id)}>
                      Отменить
                    </Button>
                  )}
                </span>
              }
            >
              {booking.serviceName}
            </Cell>
          );
        })}
      </Section>
    </List>
  );
}
