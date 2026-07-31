import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { AdminBookings } from '../../src/pages/Admin/AdminBookings';
import * as adminApi from '../../src/api/admin';
import * as settingsApi from '../../src/api/settings';
import { renderWithProviders } from '../testUtils';

vi.mock('../../src/api/admin');
vi.mock('../../src/api/settings');

describe('AdminBookings', () => {
  it('lists bookings for the current date with client, service, and time', async () => {
    vi.spyOn(settingsApi, 'getSettings').mockResolvedValue({ timezone: 'Europe/Moscow', bookingHorizonDays: 14 });
    vi.spyOn(adminApi, 'getAdminBookings').mockResolvedValue([
      {
        id: 1,
        clientFirstName: 'Ann',
        clientUsername: null,
        serviceName: 'Haircut',
        startsAt: '2026-07-31T06:00:00.000Z',
        endsAt: '2026-07-31T06:30:00.000Z',
        status: 'confirmed',
      },
    ]);

    renderWithProviders(<AdminBookings />);

    await waitFor(() => expect(screen.getByText(/Ann · Haircut/)).toBeInTheDocument());
    // 06:00 UTC -> Europe/Moscow (UTC+3, no DST) -> 09:00
    expect(screen.getByText('09:00')).toBeInTheDocument();
  });

  it('shows a placeholder when there are no bookings for the selected date', async () => {
    vi.spyOn(settingsApi, 'getSettings').mockResolvedValue({ timezone: 'Europe/Moscow', bookingHorizonDays: 14 });
    vi.spyOn(adminApi, 'getAdminBookings').mockResolvedValue([]);

    renderWithProviders(<AdminBookings />);

    await waitFor(() => expect(screen.getByText('No bookings for this date')).toBeInTheDocument());
  });

  it('shows a skeleton (not a stale empty-state flash) while a newly selected date is loading', async () => {
    vi.spyOn(settingsApi, 'getSettings').mockResolvedValue({ timezone: 'Europe/Moscow', bookingHorizonDays: 14 });
    let resolveSecondFetch!: (bookings: unknown[]) => void;
    vi.spyOn(adminApi, 'getAdminBookings')
      .mockResolvedValueOnce([])
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecondFetch = resolve;
          })
      );

    renderWithProviders(<AdminBookings />);

    await waitFor(() => expect(screen.getByText('No bookings for this date')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-08-15' } });

    // `date` is part of the query key, so picking a new date restarts
    // isPending: true for that key — regression coverage for the bug where
    // this went unhandled and briefly re-showed the previous date's
    // "no bookings" message instead of a loading state.
    await waitFor(() => expect(screen.getByRole('status', { name: 'Loading bookings' })).toBeInTheDocument());
    expect(screen.queryByText('No bookings for this date')).not.toBeInTheDocument();

    resolveSecondFetch([]);

    await waitFor(() => expect(screen.getByText('No bookings for this date')).toBeInTheDocument());
  });

  it('refetches bookings for the newly selected date', async () => {
    vi.spyOn(settingsApi, 'getSettings').mockResolvedValue({ timezone: 'Europe/Moscow', bookingHorizonDays: 14 });
    const getAdminBookingsMock = vi.spyOn(adminApi, 'getAdminBookings').mockResolvedValue([]);

    renderWithProviders(<AdminBookings />);

    await waitFor(() => expect(getAdminBookingsMock).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-08-15' } });

    await waitFor(() => expect(getAdminBookingsMock).toHaveBeenCalledWith('2026-08-15'));
  });
});
