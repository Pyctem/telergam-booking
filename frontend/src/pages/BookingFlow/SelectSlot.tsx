import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { getServices } from '../../api/services';
import { getSlots } from '../../api/slots';
import { useBackButton } from '../../hooks/useBackButton';
import { useBusinessSettings } from '../../hooks/useBusinessSettings';

export function SelectSlot() {
  const { serviceId } = useParams<{ serviceId: string }>();
  const navigate = useNavigate();
  const { data: settings, isPending: settingsPending } = useBusinessSettings();

  // selectedDate starts out unknown (not "today in the device's timezone")
  // because "today" depends on the business's timezone, which isn't known
  // until settings load. It's filled in by the effect below as soon as
  // settings arrive.
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useBackButton(() => navigate('/'));

  useEffect(() => {
    if (settings && selectedDate === null) {
      setSelectedDate(DateTime.now().setZone(settings.timezone).toISODate()!);
    }
  }, [settings, selectedDate]);

  const { data: services } = useQuery({ queryKey: ['services'], queryFn: getServices });
  const service = services?.find((s) => s.id === Number(serviceId));

  const { data: slots } = useQuery({
    queryKey: ['slots', serviceId, selectedDate],
    queryFn: () => getSlots(Number(serviceId), selectedDate!),
    enabled: Boolean(serviceId) && selectedDate !== null,
  });

  const dateOptions = useMemo(() => {
    if (!settings) return [];
    const zone = settings.timezone;
    return Array.from({ length: settings.bookingHorizonDays }, (_, i) =>
      DateTime.now().setZone(zone).plus({ days: i }).toISODate()!
    );
  }, [settings]);

  function pickSlot(startsAt: string) {
    navigate(`/booking/${serviceId}/confirm?startsAt=${encodeURIComponent(startsAt)}`);
  }

  if (settingsPending || selectedDate === null) return <p>Загрузка...</p>;

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
          const label = DateTime.fromISO(slot.startsAt).setZone(settings!.timezone).toFormat('HH:mm');
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
