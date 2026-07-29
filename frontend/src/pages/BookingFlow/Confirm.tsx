import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { getServices } from '../../api/services';
import { createBooking } from '../../api/bookings';
import { getWhoAmI } from '../../api/user';
import { ApiError } from '../../api/client';
import { useMainButton } from '../../hooks/useMainButton';
import { useBackButton } from '../../hooks/useBackButton';

export function Confirm() {
  const { serviceId } = useParams<{ serviceId: string }>();
  const [searchParams] = useSearchParams();
  const startsAt = searchParams.get('startsAt')!;
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const { data: services } = useQuery({ queryKey: ['services'], queryFn: getServices });
  const service = services?.find((s) => s.id === Number(serviceId));
  const { data: me } = useQuery({ queryKey: ['whoami'], queryFn: getWhoAmI });

  useBackButton(() => navigate(-1));

  async function handleConfirm() {
    setError(null);
    try {
      await createBooking({ serviceId: Number(serviceId), startsAt });
      navigate('/my-bookings');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('Этот слот только что заняли, выберите другое время');
        navigate(-1);
      } else {
        setError('Не удалось создать запись, попробуйте ещё раз');
      }
    }
  }

  useMainButton({ text: 'Записаться', onClick: handleConfirm, enabled: Boolean(service) });

  if (!service) return <p>Загрузка...</p>;

  const dt = DateTime.fromISO(startsAt, { zone: 'utc' }).setZone('Europe/Moscow');

  return (
    <div>
      <h1>{service.name}</h1>
      {me?.firstName && <p>Записываем: {me.firstName}</p>}
      <p>{dt.toFormat('dd.MM.yyyy')} в {dt.toFormat('HH:mm')}</p>
      <p>{service.price} ₽ · {service.durationMinutes} мин</p>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
