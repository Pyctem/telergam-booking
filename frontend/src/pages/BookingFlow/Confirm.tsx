import { useState } from 'react';
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

  const { data: services } = useQuery({ queryKey: ['services'], queryFn: getServices });
  const service = services?.find((s) => s.id === Number(serviceId));
  const { data: me } = useQuery({ queryKey: ['whoami'], queryFn: getWhoAmI });
  const { data: settings, isPending: settingsPending } = useBusinessSettings();

  useBackButton(() => navigate(-1));

  async function handleConfirm() {
    setError(null);
    try {
      await createBooking({ serviceId: Number(serviceId), startsAt });
      navigate('/my-bookings');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('Этот слот только что заняли, выберите другое время');
      } else {
        setError('Не удалось создать запись, попробуйте ещё раз');
      }
    }
  }

  useMainButton({ text: 'Записаться', onClick: handleConfirm, enabled: Boolean(service) });

  if (!service || settingsPending || !settings) {
    return (
      <Placeholder header="Загрузка...">
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
    me?.firstName && <Cell key="name" subtitle="Записываем">{me.firstName}</Cell>,
    <Cell key="datetime" subtitle="Дата и время">{`${dt.toFormat('dd.MM.yyyy')} в ${dt.toFormat('HH:mm')}`}</Cell>,
    <Cell key="price" subtitle="Стоимость">{`${service.price} ₽ · ${service.durationMinutes} мин`}</Cell>,
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
