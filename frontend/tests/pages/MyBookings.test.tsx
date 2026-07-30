import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { MyBookings } from '../../src/pages/MyBookings/MyBookings';
import * as bookingsApi from '../../src/api/bookings';
import * as settingsApi from '../../src/api/settings';
import { renderWithProviders } from '../testUtils';

function availableFn<T extends (...args: never[]) => unknown>(impl?: T) {
  const fn = vi.fn(impl);
  return Object.assign(fn, { isAvailable: () => true });
}

vi.mock('../../src/api/bookings');
vi.mock('../../src/api/settings');
vi.mock('@telegram-apps/sdk-react', () => ({
  backButton: {
    mount: availableFn(),
    isMounted: vi.fn(() => false),
    show: availableFn(),
    hide: availableFn(),
    onClick: availableFn(),
    offClick: availableFn(),
  },
}));

describe('MyBookings', () => {
  it('lists bookings and cancels a confirmed one on button click', async () => {
    const getMyBookingsMock = vi.spyOn(bookingsApi, 'getMyBookings').mockResolvedValue([
      {
        id: 1, userId: 1, serviceId: 1, serviceName: 'Haircut',
        startsAt: '2099-01-01T09:00:00.000Z', endsAt: '2099-01-01T09:30:00.000Z',
        status: 'confirmed', createdAt: '2098-01-01T00:00:00.000Z',
      },
    ]);
    const cancelMock = vi.spyOn(bookingsApi, 'cancelBooking').mockResolvedValue({ ok: true });
    vi.spyOn(settingsApi, 'getSettings').mockResolvedValue({ timezone: 'Europe/Moscow', bookingHorizonDays: 14 });
    const queryClient = new QueryClient();

    renderWithProviders(<MyBookings />, { queryClient });

    await waitFor(() => expect(screen.getByText('Haircut')).toBeInTheDocument());
    expect(screen.getByText('Подтверждена')).toBeInTheDocument();

    // Regression test: the cancel button used to be nested inside Cell's
    // title slot, which Cell renders as an <h6> (via Subheadline) with
    // text-truncation styling — so a screen reader announced the button as
    // part of the heading, and it sat inside an overflow:hidden span. The
    // button must be a sibling of the title, not a descendant of the <h6>.
    const cancelButton = screen.getByRole('button', { name: /отменить/i });
    expect(cancelButton.closest('h6')).toBeNull();

    fireEvent.click(cancelButton);

    await waitFor(() => expect(cancelMock).toHaveBeenCalledWith(1));
    // Cache invalidation triggers a refetch of the bookings query.
    await waitFor(() => expect(getMyBookingsMock).toHaveBeenCalledTimes(2));
  });

  it('does not show a cancel button for an already cancelled booking', async () => {
    vi.spyOn(bookingsApi, 'getMyBookings').mockResolvedValue([
      {
        id: 2, userId: 1, serviceId: 1, serviceName: 'Haircut',
        startsAt: '2020-01-01T09:00:00.000Z', endsAt: '2020-01-01T09:30:00.000Z',
        status: 'cancelled', createdAt: '2019-01-01T00:00:00.000Z',
      },
    ]);
    vi.spyOn(settingsApi, 'getSettings').mockResolvedValue({ timezone: 'Europe/Moscow', bookingHorizonDays: 14 });

    renderWithProviders(<MyBookings />);

    await waitFor(() => expect(screen.getByText('Haircut')).toBeInTheDocument());
    expect(screen.getByText('Отменена')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /отменить/i })).not.toBeInTheDocument();
  });
});
