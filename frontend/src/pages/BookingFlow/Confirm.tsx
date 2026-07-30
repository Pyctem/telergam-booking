import { useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { List, Section, Cell, Banner, Placeholder, Spinner } from '@telegram-apps/telegram-ui';
import { getServices } from '../../api/services';
import { createBooking } from '../../api/bookings';
import { getWhoAmI } from '../../api/user';
import { ApiError } from '../../api/client';
import { useMainButton } from '../../hooks/useMainButton';
import { useBackButton } from '../../hooks/useBackButton';
import { useBusinessSettings } from '../../hooks/useBusinessSettings';

export function Confirm() {
  const { serviceId } = useParams<{ serviceId: string }>();
  const [searchParams] = useSearchParams();
  const startsAt = searchParams.get('startsAt')!;
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // `isSubmitting` state drives the UI (MainButton disabled + loader), but
  // it's not a safe re-entrancy guard on its own: if two taps happen close
  // enough together that both invoke `handleConfirm` before React re-renders
  // (and MainButton's onClick handler gets re-registered with a fresh
  // closure), both calls would read the same stale `isSubmitting === false`
  // from the closure they were created with. A ref is mutated in place and
  // read fresh on every access regardless of which render's closure is
  // calling it, so it can't go stale between two synchronous-ish calls.
  const isSubmittingRef = useRef(false);

  const { data: services } = useQuery({ queryKey: ['services'], queryFn: getServices });
  const service = services?.find((s) => s.id === Number(serviceId));
  const { data: me } = useQuery({ queryKey: ['whoami'], queryFn: getWhoAmI });
  const { data: settings, isPending: settingsPending } = useBusinessSettings();

  useBackButton(() => navigate(-1));

  async function handleConfirm() {
    // The ref is the actual re-entrancy guard (see comment above); MainButton
    // being visually disabled during `isSubmitting` is a UI hint, not a lock.
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setError(null);
    setIsSubmitting(true);
    try {
      await createBooking({ serviceId: Number(serviceId), startsAt });
      navigate('/my-bookings');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('This slot was just taken, please choose another time');
      } else {
        setError("Couldn't create the booking, please try again");
      }
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  useMainButton({
    text: 'Book',
    onClick: handleConfirm,
    enabled: Boolean(service),
    loading: isSubmitting,
  });

  if (!service || settingsPending || !settings) {
    return (
      <Placeholder header="Loading...">
        <Spinner size="m" />
      </Placeholder>
    );
  }

  const dt = DateTime.fromISO(startsAt, { zone: 'utc' }).setZone(settings.timezone);

  // Built as a filtered array (instead of `{cond && <Cell/>}` inline among
  // siblings) because Section inserts a Divider between children using
  // Children.map/Children.count, which counts a bare `false` as a child
  // slot — that would render a stray divider at the top of the section
  // whenever me?.firstName is absent.
  const detailCells = [
    me?.firstName && <Cell key="name" subtitle="Booking for">{me.firstName}</Cell>,
    <Cell key="datetime" subtitle="Date & time">{`${dt.toFormat('dd.MM.yyyy')} at ${dt.toFormat('HH:mm')}`}</Cell>,
    <Cell key="price" subtitle="Price">{`${service.price} ₽ · ${service.durationMinutes} min`}</Cell>,
  ].filter((cell): cell is JSX.Element => Boolean(cell));

  return (
    <div>
      <List>
        <Section header={service.name}>{detailCells}</Section>
      </List>
      {error && (
        <div role="alert">
          <Banner type="inline" header={error} />
        </div>
      )}
    </div>
  );
}
