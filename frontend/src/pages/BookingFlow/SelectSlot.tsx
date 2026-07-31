import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DateTime } from 'luxon';
import { Section, Chip, Placeholder, Spinner, Text } from '@telegram-apps/telegram-ui';
import { getServices } from '../../api/services';
import { getSlots } from '../../api/slots';
import { useBackButton } from '../../hooks/useBackButton';
import { useBusinessSettings } from '../../hooks/useBusinessSettings';
import { generateCalendarMonths } from '../../lib/calendarGrid';

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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

  const { data: slots = [], isPending: slotsPending } = useQuery({
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
      <Placeholder header="Loading...">
        <Spinner size="m" />
      </Placeholder>
    );
  }

  return (
    <div>
      <Text weight="2" style={{ display: 'block', padding: '12px 16px' }}>
        {service?.name ?? 'Select a time'}
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
                      style={
                        {
                          justifyContent: 'center',
                          // Every day cell gets the same explicit box regardless of
                          // digit count (1 vs 31) or selected state — without this,
                          // a <button>'s intrinsic content-based sizing can make cells
                          // drift out of alignment with their grid column/row, which
                          // read as "the backing behind the date shifted" on a real
                          // device even though the grid gap itself was already uniform.
                          width: '100%',
                          height: 40,
                          boxSizing: 'border-box',
                          padding: 0,
                          // Component="button" (added for keyboard accessibility) makes
                          // this a real <button>, which on iOS Safari picks up the
                          // system's default button chrome (a filled gray face, plus
                          // its own low-contrast text dimming on :disabled) UNLESS the
                          // native appearance is explicitly reset — that native styling
                          // was fighting telegram-ui's own "outline"/disabled look and
                          // made the disabled day numbers nearly invisible on iPhone.
                          WebkitAppearance: 'none',
                          appearance: 'none',
                          // Chip's `mode="outline"` border is a near-invisible
                          // `box-shadow: 0 0 0 1px rgba(0,0,0,.05)` (telegram-ui's
                          // own default) — on its own that's not enough to tell a
                          // tappable day from a disabled one, especially now that
                          // the page itself sits on --tg-theme-secondary-bg-color
                          // (see theme.css). `backgroundColor` (not the `background`
                          // shorthand) throughout, and always set — mixing the
                          // shorthand and longhand across the selected/unselected
                          // branches made React warn about a "conflicting property"
                          // on rerender and risked stale styles.
                          // - Selected: Telegram's button accent color. `mode="elevated"`
                          //   (telegram-ui's own "selected" look) uses --tgui--surface_primary,
                          //   which in dark theme is nearly the same lightness as the page
                          //   background (~9% vs ~13%) and was invisible there — the accent
                          //   color is designed to contrast with both themes.
                          // - Enabled, unselected: an explicit --tg-theme-bg-color fill so
                          //   it reads as a distinct "card" against the page, the same
                          //   page-vs-card contrast pattern used everywhere else (Section,
                          //   Input).
                          // - Disabled: --tgui--outline, a barely-there theme-aware overlay
                          //   (5% black in light theme, 10% white in dark), so the cell
                          //   reads as "here, but not tappable" instead of fusing invisibly
                          //   into the page like fully transparent did.
                          backgroundColor:
                            day.date === selectedDate
                              ? 'var(--tg-theme-button-color)'
                              : day.enabled
                                ? 'var(--tg-theme-bg-color)'
                                : 'var(--tgui--outline)',
                          // The chip's label renders through telegram-ui's Subheadline,
                          // whose own CSS sets `color: var(--tgui--plain_foreground)`
                          // directly on that element — an inherited `color` set here on
                          // the outer button is not enough, that explicit rule on the
                          // descendant wins regardless (this is exactly why an earlier
                          // attempt at `color: var(--tg-theme-button-text-color)` here had
                          // no visible effect: black-on-blue on the selected day). Override
                          // the custom property itself instead — Subheadline's `var(...)`
                          // then resolves to whatever we set here, since custom properties
                          // inherit down through the tree.
                          ...(day.date === selectedDate
                            ? { '--tgui--plain_foreground': 'var(--tg-theme-button-text-color)' }
                            : {}),
                          // Disabled (out-of-horizon) days: de-emphasize with Telegram's
                          // own "secondary text" color instead of `opacity`, which would
                          // dim an already-subtle outline chip into illegibility on a
                          // dark background (see the iOS native-button note above — this
                          // combined with that to make disabled numbers unreadable). Same
                          // custom-property override as the selected state above, for the
                          // same reason (a plain `color` here doesn't reach the label).
                          ...(day.enabled
                            ? {}
                            : { '--tgui--plain_foreground': 'var(--tg-theme-hint-color)', pointerEvents: 'none' }),
                        } as CSSProperties
                      }
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

      <Section header="Available times">
        {slotsPending ? (
          <Placeholder>
            <Spinner size="s" />
          </Placeholder>
        ) : slots.length === 0 ? (
          <Placeholder description="No available slots for this date" />
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 16 }}>
            {slots.map((slot) => {
              const label = DateTime.fromISO(slot.startsAt).setZone(settings!.timezone).toFormat('HH:mm');
              return (
                <Chip
                  key={slot.startsAt}
                  Component="button"
                  type="button"
                  mode="outline"
                  onClick={() => pickSlot(slot.startsAt)}
                  style={{
                    // Labels are always "HH:mm" (5 chars), but a chip that
                    // sizes to content still varies slightly between them —
                    // most fonts render "1" narrower than digits like "0" or
                    // "9", so e.g. "11:30" comes out visibly thinner than
                    // "09:00" without an explicit fixed width.
                    justifyContent: 'center',
                    width: 60,
                    boxSizing: 'border-box',
                    // Chip's own class sets padding: 8px 12px; that plus the
                    // default 15-16px label text left too little room at a
                    // fixed width and "HH:mm" got ellipsis-truncated. Shrink
                    // both padding and font size, the latter via the same
                    // CSS custom properties telegram-ui's Subheadline reads
                    // internally (font-size/line-height), which cascade down
                    // to it since they're only overridden on this chip.
                    padding: '6px 4px',
                    '--tgui--subheadline1--font_size': '13px',
                    '--tgui--subheadline1--line_height': '16px',
                    '--tgui--subheadline2--font_size': '13px',
                    '--tgui--subheadline2--line_height': '16px',
                    WebkitAppearance: 'none',
                    appearance: 'none',
                    // Same reasoning as the calendar day chips above: Chip's
                    // `mode="outline"` border alone (a near-invisible 5%-opacity
                    // box-shadow) isn't enough contrast against the page's
                    // --tg-theme-secondary-bg-color background — give every
                    // slot an explicit --tg-theme-bg-color fill so it reads as
                    // a distinct, tappable "card". `backgroundColor`, not the
                    // `background` shorthand — see the calendar chip comment.
                    backgroundColor: 'var(--tg-theme-bg-color)',
                  } as CSSProperties}
                >
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
