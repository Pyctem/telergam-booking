import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { Section, Chip, Placeholder, Spinner, Text } from '@telegram-apps/telegram-ui';
import { getServices } from '../../api/services';
import { getSlots } from '../../api/slots';
import { useBackButton } from '../../hooks/useBackButton';
import { useBusinessSettings } from '../../hooks/useBusinessSettings';
import { generateCalendarMonths } from '../../lib/calendarGrid';

const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

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

  const months = useMemo(() => {
    if (!settings) return [];
    const today = DateTime.now().setZone(settings.timezone).toISODate()!;
    return generateCalendarMonths(today, settings.bookingHorizonDays);
  }, [settings]);

  function pickSlot(startsAt: string) {
    navigate(`/booking/${serviceId}/confirm?startsAt=${encodeURIComponent(startsAt)}`);
  }

  if (settingsPending || selectedDate === null) {
    return (
      <Placeholder header="Загрузка...">
        <Spinner size="m" />
      </Placeholder>
    );
  }

  return (
    <div>
      <Text weight="2" style={{ display: 'block', padding: '12px 16px' }}>
        {service?.name ?? 'Выбор времени'}
      </Text>

      <div style={{ padding: '0 16px' }}>
        {months.map((month) => (
          <div key={month.monthISO} style={{ marginBottom: 8 }}>
            <Text weight="2" style={{ display: 'block', margin: '8px 0 4px', fontSize: 14 }}>
              {month.monthLabel}
            </Text>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
              {WEEKDAY_LABELS.map((label) => (
                <Text key={label} weight="3" style={{ textAlign: 'center', fontSize: 12, opacity: 0.6 }}>
                  {label}
                </Text>
              ))}
            </div>
            {month.weeks.map((week, weekIndex) => (
              <div
                key={weekIndex}
                style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}
              >
                {week.map((day, dayIndex) =>
                  day === null ? (
                    <div key={dayIndex} />
                  ) : (
                    <Chip
                      key={day.date}
                      Component="button"
                      type="button"
                      mode="outline"
                      aria-pressed={day.date === selectedDate}
                      aria-disabled={!day.enabled}
                      disabled={!day.enabled}
                      onClick={day.enabled ? () => setSelectedDate(day.date) : undefined}
                      style={{
                        justifyContent: 'center',
                        // `mode="elevated"` (telegram-ui's own "selected" look) uses
                        // --tgui--surface_primary, which in dark theme is nearly the
                        // same lightness as the page background (~9% vs ~13%) — the
                        // selected day was invisible against a dark background. Use
                        // the Telegram button accent color instead: it's designed to
                        // always contrast with both the light and dark theme backgrounds.
                        ...(day.date === selectedDate
                          ? { backgroundColor: 'var(--tg-theme-button-color)', color: 'var(--tg-theme-button-text-color)' }
                          : {}),
                        ...(day.enabled ? {} : { opacity: 0.35, pointerEvents: 'none' }),
                      }}
                    >
                      {DateTime.fromISO(day.date).day}
                    </Chip>
                  )
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      <Section header="Свободное время">
        {slots?.length === 0 ? (
          <Placeholder description="Нет свободных слотов на эту дату" />
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '0 16px 16px' }}>
            {slots?.map((slot) => {
              const label = DateTime.fromISO(slot.startsAt).setZone(settings!.timezone).toFormat('HH:mm');
              return (
                <Chip key={slot.startsAt} Component="button" type="button" mode="outline" onClick={() => pickSlot(slot.startsAt)}>
                  {label}
                </Chip>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}
