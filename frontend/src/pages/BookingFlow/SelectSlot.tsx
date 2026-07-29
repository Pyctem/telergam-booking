import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { getServices } from '../../api/services';
import { getSlots } from '../../api/slots';
import { useBackButton } from '../../hooks/useBackButton';

const DAYS_AHEAD = 14;

export function SelectSlot() {
  const { serviceId } = useParams<{ serviceId: string }>();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(() => DateTime.now().toISODate()!);

  useBackButton(() => navigate('/'));

  const { data: services } = useQuery({ queryKey: ['services'], queryFn: getServices });
  const service = services?.find((s) => s.id === Number(serviceId));

  const { data: slots } = useQuery({
    queryKey: ['slots', serviceId, selectedDate],
    queryFn: () => getSlots(Number(serviceId), selectedDate),
    enabled: Boolean(serviceId),
  });

  const dateOptions = useMemo(
    () => Array.from({ length: DAYS_AHEAD }, (_, i) => DateTime.now().plus({ days: i }).toISODate()!),
    []
  );

  function pickSlot(startsAt: string) {
    navigate(`/booking/${serviceId}/confirm?startsAt=${encodeURIComponent(startsAt)}`);
  }

  return (
    <div>
      <h1>{service?.name ?? 'Выбор времени'}</h1>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
        {dateOptions.map((date) => (
          <button key={date} onClick={() => setSelectedDate(date)} aria-pressed={date === selectedDate}>
            {DateTime.fromISO(date).toFormat('dd.MM')}
          </button>
        ))}
      </div>
      <div>
        {slots?.length === 0 && <p>Нет свободных слотов на эту дату</p>}
        {slots?.map((slot) => {
          const label = DateTime.fromISO(slot.startsAt).setZone('Europe/Moscow').toFormat('HH:mm');
          return (
            <button key={slot.startsAt} onClick={() => pickSlot(slot.startsAt)}>
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
