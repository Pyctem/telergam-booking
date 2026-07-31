import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { List, Section, Cell, Badge, Caption, Button } from '@telegram-apps/telegram-ui';
import { getMyBookings, cancelBooking } from '../../api/bookings';
import { useBackButton } from '../../hooks/useBackButton';
import { useBusinessSettings } from '../../hooks/useBusinessSettings';
import { useNavigate } from 'react-router-dom';
import { SkeletonRows } from '../../components/SkeletonRows';

export function MyBookings() {
  const navigate = useNavigate();
  useBackButton(() => navigate('/'));

  const queryClient = useQueryClient();
  const { data: bookings, isPending: bookingsPending } = useQuery({ queryKey: ['myBookings'], queryFn: getMyBookings });
  const { data: settings, isPending: settingsPending } = useBusinessSettings();

  const cancelMutation = useMutation({
    mutationFn: (id: number) => cancelBooking(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['myBookings'] }),
  });

  if (settingsPending || !settings) {
    return (
      <List>
        <Section header="My Bookings">
          <SkeletonRows label="Loading bookings" />
        </Section>
      </List>
    );
  }

  // Settings and bookings load in parallel and don't always resolve
  // together — without this, settings landing first left the section
  // sitting empty (no skeleton, no data) until bookings caught up.
  if (bookingsPending) {
    return (
      <List>
        <Section header="My Bookings">
          <SkeletonRows label="Loading bookings" />
        </Section>
      </List>
    );
  }

  return (
    <List>
      <Section header="My Bookings">
        {bookings?.map((booking) => {
          const dt = DateTime.fromISO(booking.startsAt).setZone(settings.timezone);
          const isConfirmed = booking.status === 'confirmed';
          const isCancelling = cancelMutation.isPending && cancelMutation.variables === booking.id;
          return (
            <Cell
              key={booking.id}
              subtitle={`${dt.toFormat('dd.MM.yyyy')} at ${dt.toFormat('HH:mm')}`}
              after={
                // Matches the Cell's own middle-content vertical padding
                // (--tgui--cell--middle--padding: 16px 0) — the `after` slot
                // has none of its own, so once this column got taller than a
                // single badge (badge row + gap + Cancel button), Cell's
                // align-items: center left the Cancel button flush against
                // the bottom edge instead of matching the top gap.
                <span
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: 6,
                    padding: '16px 0',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Badge type="dot" mode={isConfirmed ? 'primary' : 'gray'} />
                    <Caption weight="2">{isConfirmed ? 'Confirmed' : 'Cancelled'}</Caption>
                  </span>
                  {isConfirmed && (
                    <Button
                      size="s"
                      mode="outline"
                      loading={isCancelling}
                      disabled={isCancelling}
                      onClick={() => cancelMutation.mutate(booking.id)}
                    >
                      Cancel
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
