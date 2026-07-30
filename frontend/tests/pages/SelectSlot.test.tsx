import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { Route, Routes } from 'react-router-dom';
import { Settings } from 'luxon';
import { SelectSlot } from '../../src/pages/BookingFlow/SelectSlot';
import * as slotsApi from '../../src/api/slots';
import * as servicesApi from '../../src/api/services';
import * as settingsApi from '../../src/api/settings';
import { renderWithProviders } from '../testUtils';

function availableFn<T extends (...args: never[]) => unknown>(impl?: T) {
  const fn = vi.fn(impl);
  return Object.assign(fn, { isAvailable: () => true });
}

vi.mock('../../src/api/slots');
vi.mock('../../src/api/services');
vi.mock('../../src/api/settings');
vi.mock('@telegram-apps/sdk-react', () => ({
  mainButton: {
    mount: availableFn(),
    isMounted: vi.fn(() => false),
    setParams: availableFn(),
    onClick: availableFn(),
    offClick: availableFn(),
  },
  backButton: {
    mount: availableFn(),
    isMounted: vi.fn(() => false),
    show: availableFn(),
    hide: availableFn(),
    onClick: availableFn(),
    offClick: availableFn(),
  },
}));

// renderWithProviders only supplies <MemoryRouter>; SelectSlot needs a
// matched <Route path="/booking/:serviceId"> above it to populate the
// serviceId param via useParams, and the confirm route below lets the
// navigation test observe where the app actually lands.
function routedSelectSlot() {
  return (
    <Routes>
      <Route path="/booking/:serviceId" element={<SelectSlot />} />
      <Route path="/booking/:serviceId/confirm" element={<div>Confirm screen</div>} />
    </Routes>
  );
}

// Freeze "now" so the calendar grid (built from DateTime.now()) is
// deterministic across test runs instead of depending on whatever day the
// suite happens to execute on. 2099-06-01 in Europe/Moscow is a Monday
// (DateTime.fromISO('2099-06-01').weekday === 1), so it lands exactly on the
// grid's first cell with no leading padding, making the enabled/disabled
// cell layout easy to reason about by hand.
const FIXED_NOW = '2099-06-01T00:00:00.000+03:00';

beforeEach(() => {
  Settings.now = () => new Date(FIXED_NOW).valueOf();
});

afterEach(() => {
  Settings.now = () => Date.now();
});

describe('SelectSlot', () => {
  it('shows the service name and lists available slots for the selected date, navigating to confirm on pick', async () => {
    vi.spyOn(servicesApi, 'getServices').mockResolvedValue([
      { id: 1, name: 'Haircut', description: null, price: 1500, durationMinutes: 30, isActive: true },
    ]);
    vi.spyOn(slotsApi, 'getSlots').mockResolvedValue([{ startsAt: '2099-06-01T06:00:00.000Z' }]);
    vi.spyOn(settingsApi, 'getSettings').mockResolvedValue({ timezone: 'Europe/Moscow', bookingHorizonDays: 3 });
    const queryClient = new QueryClient();

    renderWithProviders(routedSelectSlot(), { queryClient, initialEntries: ['/booking/1'] });

    await waitFor(() => expect(screen.getByText('Haircut')).toBeInTheDocument());

    // 06:00 UTC is 09:00 in Europe/Moscow (UTC+3, no DST) — this proves the
    // label is converted to the business's local timezone, not left in raw
    // UTC. Chip renders as a <div> by default (ChipProps.Component defaults
    // to 'div', not 'button'), so there is no button role to query here —
    // the click target is found by its text content instead.
    const slotChip = await screen.findByText('09:00');
    fireEvent.click(slotChip);

    await waitFor(() => expect(screen.getByText('Confirm screen')).toBeInTheDocument());
  });

  it('renders one enabled calendar day chip per day of the fetched booking horizon, not a hardcoded count', async () => {
    vi.spyOn(servicesApi, 'getServices').mockResolvedValue([
      { id: 1, name: 'Haircut', description: null, price: 1500, durationMinutes: 30, isActive: true },
    ]);
    vi.spyOn(slotsApi, 'getSlots').mockResolvedValue([]);
    // A distinct, small value proves the count tracks the fetched setting
    // rather than any hardcoded constant, and keeps the fixture's calendar
    // month mostly made of disabled (out-of-horizon) cells.
    vi.spyOn(settingsApi, 'getSettings').mockResolvedValue({ timezone: 'Europe/Moscow', bookingHorizonDays: 3 });
    const queryClient = new QueryClient();

    const { container } = renderWithProviders(routedSelectSlot(), {
      queryClient,
      initialEntries: ['/booking/1'],
    });

    await waitFor(() => expect(screen.getByText('Нет свободных слотов на эту дату')).toBeInTheDocument());

    const enabledDays = container.querySelectorAll('[aria-disabled="false"]');
    expect(enabledDays).toHaveLength(3);

    // The rest of June 2099's grid (30 days total) is rendered but disabled
    // — proving the component draws the full month, not just the horizon
    // window.
    const disabledDays = container.querySelectorAll('[aria-disabled="true"]');
    expect(disabledDays.length).toBeGreaterThan(0);
  });

  it('clicking an enabled day chip updates the selected date and re-fetches slots for that date', async () => {
    vi.spyOn(servicesApi, 'getServices').mockResolvedValue([
      { id: 1, name: 'Haircut', description: null, price: 1500, durationMinutes: 30, isActive: true },
    ]);
    const getSlotsMock = vi.spyOn(slotsApi, 'getSlots').mockResolvedValue([]);
    vi.spyOn(settingsApi, 'getSettings').mockResolvedValue({ timezone: 'Europe/Moscow', bookingHorizonDays: 3 });
    const queryClient = new QueryClient();

    const { container } = renderWithProviders(routedSelectSlot(), {
      queryClient,
      initialEntries: ['/booking/1'],
    });

    // Initial fetch is for "today" (2099-06-01, the frozen date).
    await waitFor(() => expect(getSlotsMock).toHaveBeenCalledWith(1, '2099-06-01'));

    const enabledDays = container.querySelectorAll('[aria-disabled="false"]');
    expect(enabledDays).toHaveLength(3); // 06-01, 06-02, 06-03, in chronological DOM order
    const [todayChip, tomorrowChip] = Array.from(enabledDays);
    expect(todayChip.getAttribute('aria-pressed')).toBe('true');
    expect(tomorrowChip.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(tomorrowChip);

    await waitFor(() => expect(getSlotsMock).toHaveBeenCalledWith(1, '2099-06-02'));
    expect(tomorrowChip.getAttribute('aria-pressed')).toBe('true');
  });

  it('does not select or re-fetch when clicking a disabled (out-of-horizon) day chip', async () => {
    vi.spyOn(servicesApi, 'getServices').mockResolvedValue([
      { id: 1, name: 'Haircut', description: null, price: 1500, durationMinutes: 30, isActive: true },
    ]);
    const getSlotsMock = vi.spyOn(slotsApi, 'getSlots').mockResolvedValue([]);
    vi.spyOn(settingsApi, 'getSettings').mockResolvedValue({ timezone: 'Europe/Moscow', bookingHorizonDays: 3 });
    const queryClient = new QueryClient();

    const { container } = renderWithProviders(routedSelectSlot(), {
      queryClient,
      initialEntries: ['/booking/1'],
    });

    await waitFor(() => expect(getSlotsMock).toHaveBeenCalledWith(1, '2099-06-01'));
    const callCountBefore = getSlotsMock.mock.calls.length;

    // 2099-06-04 is inside the same rendered month but past the 3-day
    // horizon, so it must be disabled: present in the grid, dimmed, and
    // genuinely unclickable (no onClick handler attached, not just
    // visually suppressed with a handler still wired up).
    const disabledDays = container.querySelectorAll('[aria-disabled="true"]');
    expect(disabledDays.length).toBeGreaterThan(0);
    fireEvent.click(disabledDays[0]);

    // Give react-query a tick to prove nothing fired, rather than asserting
    // immediately after a synchronous click. waitFor (unlike a bare
    // setTimeout) wraps each poll in act(), so this doesn't trip React's
    // "update not wrapped in act" warning if anything did change.
    await waitFor(() => expect(getSlotsMock.mock.calls.length).toBe(callCountBefore));
  });
});
