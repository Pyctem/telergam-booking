import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AdminLayout } from '../../src/pages/Admin/AdminLayout';
import * as userApi from '../../src/api/user';
import * as settingsApi from '../../src/api/settings';
import * as adminApi from '../../src/api/admin';

vi.mock('../../src/api/user');
vi.mock('../../src/api/settings');
vi.mock('../../src/api/admin');

afterEach(() => {
  // See ServicesList.test.tsx: onlineManager is a module-level singleton for
  // this test file, reset it so a failing assertion in the offline
  // regression test below can't leave later tests permanently "offline".
  onlineManager.setOnline(true);
});

function renderAdmin() {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />} />
          <Route path="/" element={<div>Home screen</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('AdminLayout', () => {
  it('redirects a client (non-admin) to /', async () => {
    vi.spyOn(userApi, 'getWhoAmI').mockResolvedValue({ id: 1, telegramId: 10, role: 'client', firstName: 'Ann' });

    renderAdmin();

    await waitFor(() => expect(screen.getByText('Home screen')).toBeInTheDocument());
  });

  it('renders the admin bookings tab for an admin', async () => {
    vi.spyOn(userApi, 'getWhoAmI').mockResolvedValue({ id: 1, telegramId: 10, role: 'admin', firstName: 'Boss' });
    vi.spyOn(settingsApi, 'getSettings').mockResolvedValue({ timezone: 'Europe/Moscow', bookingHorizonDays: 14 });
    vi.spyOn(adminApi, 'getAdminBookings').mockResolvedValue([]);

    renderAdmin();

    await waitFor(() => expect(screen.getByText('Записи на день')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Услуги' })).toBeInTheDocument();
    expect(screen.queryByText('Home screen')).not.toBeInTheDocument();
  });

  // Regression test for the isPending-vs-isLoading bug fixed in AdminLayout:
  // `isLoading` is `isPending && isFetching`, so it can read `false` while
  // `me` is still undefined. We reproduce that exact react-query state
  // deterministically by flipping the query client offline before mount —
  // react-query dispatches its "fetch" action but (being offline) never
  // actually calls the queryFn, so fetchStatus goes straight to 'paused'
  // instead of 'fetching' and stays there: `me` remains undefined
  // indefinitely with isPending: true, isLoading: false. (A plain
  // never-resolving promise would NOT distinguish the two flags: fetchStatus
  // would stay 'fetching' forever, so isLoading would also stay true, and
  // the test would pass under both the correct and the buggy code — proving
  // nothing.)
  //
  // Under the current source (`if (isPending) return <p>Загрузка...</p>;`)
  // this renders the loading state and never evaluates
  // `me?.role !== 'admin'`. If AdminLayout were reverted to checking
  // `isLoading` instead, this exact state (isPending: true, isLoading:
  // false) would skip the loading return and hit
  // `me?.role !== 'admin'` with `me === undefined`, which reads as `true`
  // ("not admin") and would flash-redirect a real admin to "/" — which this
  // test would catch as "Home screen" rendering instead of "Загрузка...".
  it('shows the loading state, not a premature redirect, while no data has arrived and isLoading is already false (isPending regression)', async () => {
    onlineManager.setOnline(false);
    const getWhoAmIMock = vi.spyOn(userApi, 'getWhoAmI').mockImplementation(() => new Promise(() => {}));

    renderAdmin();

    await waitFor(() => expect(screen.getByText('Загрузка...')).toBeInTheDocument());
    expect(screen.queryByText('Home screen')).not.toBeInTheDocument();
    // While offline/paused, react-query never even calls the queryFn.
    expect(getWhoAmIMock).not.toHaveBeenCalled();

    onlineManager.setOnline(true);
  });
});
