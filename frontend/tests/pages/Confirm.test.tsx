import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor, act } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '../testUtils';
import { Confirm } from '../../src/pages/BookingFlow/Confirm';
import * as servicesApi from '../../src/api/services';
import * as bookingsApi from '../../src/api/bookings';
import * as userApi from '../../src/api/user';
import * as settingsApi from '../../src/api/settings';
import { ApiError } from '../../src/api/client';

function availableFn<T extends (...args: never[]) => unknown>(impl?: T) {
  const fn = vi.fn(impl);
  return Object.assign(fn, { isAvailable: () => true });
}

vi.mock('../../src/api/services');
vi.mock('../../src/api/bookings');
vi.mock('../../src/api/user');
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

describe('Confirm', () => {
  it('shows the client name, chosen service and time, and submits the booking on main button click', async () => {
    vi.spyOn(servicesApi, 'getServices').mockResolvedValue([
      { id: 1, name: 'Haircut', description: null, price: 1500, durationMinutes: 30, isActive: true },
    ]);
    vi.spyOn(userApi, 'getWhoAmI').mockResolvedValue({ id: 1, telegramId: 10, role: 'client', firstName: 'Ann' });
    vi.spyOn(settingsApi, 'getSettings').mockResolvedValue({ timezone: 'Europe/Moscow', bookingHorizonDays: 14 });
    const createBookingMock = vi.spyOn(bookingsApi, 'createBooking').mockResolvedValue({
      id: 1, userId: 1, serviceId: 1, serviceName: 'Haircut',
      startsAt: '2099-01-01T09:00:00.000Z', endsAt: '2099-01-01T09:30:00.000Z',
      status: 'confirmed', createdAt: '2098-01-01T00:00:00.000Z',
    });
    const queryClient = new QueryClient();
    const { mainButton } = await import('@telegram-apps/sdk-react');

    renderWithProviders(
      <Routes>
        <Route path="/booking/:serviceId/confirm" element={<Confirm />} />
        <Route path="/my-bookings" element={<div>My bookings screen</div>} />
      </Routes>,
      {
        queryClient,
        initialEntries: ['/booking/1/confirm?startsAt=2099-01-01T09%3A00%3A00.000Z'],
      }
    );

    await waitFor(() => expect(screen.getByText('Haircut')).toBeInTheDocument());
    expect(screen.getByText(/Ann/)).toBeInTheDocument();

    const onClickCall = (mainButton.onClick as ReturnType<typeof vi.fn>).mock.calls.at(-1)![0];
    await act(async () => {
      await onClickCall();
    });

    expect(createBookingMock).toHaveBeenCalledWith({ serviceId: 1, startsAt: '2099-01-01T09:00:00.000Z' });
    await waitFor(() => expect(screen.getByText('My bookings screen')).toBeInTheDocument());
  });

  it('shows a conflict message and stays on screen when the slot was already booked (409)', async () => {
    vi.spyOn(servicesApi, 'getServices').mockResolvedValue([
      { id: 1, name: 'Haircut', description: null, price: 1500, durationMinutes: 30, isActive: true },
    ]);
    vi.spyOn(userApi, 'getWhoAmI').mockResolvedValue({ id: 1, telegramId: 10, role: 'client', firstName: 'Ann' });
    vi.spyOn(settingsApi, 'getSettings').mockResolvedValue({ timezone: 'Europe/Moscow', bookingHorizonDays: 14 });
    vi.spyOn(bookingsApi, 'createBooking').mockRejectedValue(new ApiError(409, 'Slot already booked'));
    const queryClient = new QueryClient();
    const { mainButton } = await import('@telegram-apps/sdk-react');

    renderWithProviders(
      <Routes>
        <Route path="/booking/:serviceId/confirm" element={<Confirm />} />
        <Route path="/booking/:serviceId" element={<div>Select slot screen</div>} />
        <Route path="/my-bookings" element={<div>My bookings screen</div>} />
      </Routes>,
      {
        queryClient,
        initialEntries: ['/booking/1/confirm?startsAt=2099-01-01T09%3A00%3A00.000Z'],
      }
    );

    await waitFor(() => expect(screen.getByText('Haircut')).toBeInTheDocument());

    const onClickCall = (mainButton.onClick as ReturnType<typeof vi.fn>).mock.calls.at(-1)![0];
    await act(async () => {
      await onClickCall();
    });

    // The error must be visible and the component must NOT have navigated away —
    // if handleConfirm still called navigate(-1), Confirm would unmount and this
    // assertion (and the surrounding screen) would be gone.
    await waitFor(() =>
      expect(screen.getByText('Этот слот только что заняли, выберите другое время')).toBeInTheDocument()
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Этот слот только что заняли, выберите другое время');
    expect(screen.getByText('Haircut')).toBeInTheDocument();
    expect(screen.queryByText('Select slot screen')).not.toBeInTheDocument();
    expect(screen.queryByText('My bookings screen')).not.toBeInTheDocument();
  });

  it('does not render a stray divider at the top of the Section when the client has no firstName', async () => {
    // Regression test: `{me?.firstName && <Cell.../>}` as a bare sibling
    // child of Section evaluates to `false` (not omitted) whenever
    // firstName is absent, and Section counts every child slot — including
    // `false` — when deciding where to insert an <hr> divider. That must no
    // longer produce a leading divider.
    vi.spyOn(servicesApi, 'getServices').mockResolvedValue([
      { id: 1, name: 'Haircut', description: null, price: 1500, durationMinutes: 30, isActive: true },
    ]);
    vi.spyOn(userApi, 'getWhoAmI').mockResolvedValue({ id: 1, telegramId: 10, role: 'client', firstName: null });
    vi.spyOn(settingsApi, 'getSettings').mockResolvedValue({ timezone: 'Europe/Moscow', bookingHorizonDays: 14 });
    const queryClient = new QueryClient();

    const { container } = renderWithProviders(
      <Routes>
        <Route path="/booking/:serviceId/confirm" element={<Confirm />} />
      </Routes>,
      {
        queryClient,
        initialEntries: ['/booking/1/confirm?startsAt=2099-01-01T09%3A00%3A00.000Z'],
      }
    );

    await waitFor(() => expect(screen.getByText('Haircut')).toBeInTheDocument());

    // Exactly 2 real Cells remain (datetime, price) — 1 divider between
    // them, 0 leading dividers.
    const section = screen.getByText('Haircut').closest('section')!;
    expect(section.querySelectorAll('hr')).toHaveLength(1);
  });
});
