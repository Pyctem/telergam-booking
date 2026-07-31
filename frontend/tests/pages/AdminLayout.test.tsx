import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { onlineManager } from '@tanstack/react-query';
import { Routes, Route } from 'react-router-dom';
import { AdminLayout } from '../../src/pages/Admin/AdminLayout';
import * as userApi from '../../src/api/user';
import * as settingsApi from '../../src/api/settings';
import * as adminApi from '../../src/api/admin';
import { renderWithProviders } from '../testUtils';

vi.mock('../../src/api/user');
vi.mock('../../src/api/settings');
vi.mock('../../src/api/admin');

afterEach(() => {
  onlineManager.setOnline(true);
});

function renderAdmin() {
  renderWithProviders(
    <Routes>
      <Route path="/admin" element={<AdminLayout />} />
      <Route path="/" element={<div>Home screen</div>} />
    </Routes>,
    { initialEntries: ['/admin'] }
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

    await waitFor(() => expect(screen.getByText("Today's Bookings")).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Services' })).toBeInTheDocument();
    expect(screen.queryByText('Home screen')).not.toBeInTheDocument();
  });

  it('shows the loading state, not a premature redirect, while no data has arrived and isLoading is already false (isPending regression)', async () => {
    onlineManager.setOnline(false);
    const getWhoAmIMock = vi.spyOn(userApi, 'getWhoAmI').mockImplementation(() => new Promise(() => {}));

    renderAdmin();

    await waitFor(() => expect(screen.getByText('Loading...')).toBeInTheDocument());
    expect(screen.queryByText('Home screen')).not.toBeInTheDocument();
    expect(getWhoAmIMock).not.toHaveBeenCalled();

    onlineManager.setOnline(true);
  });
});
