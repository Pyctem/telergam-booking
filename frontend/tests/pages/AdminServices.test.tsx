import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AdminServices } from '../../src/pages/Admin/AdminServices';
import * as adminApi from '../../src/api/admin';

vi.mock('../../src/api/admin');

describe('AdminServices', () => {
  it('lists services and creates a new one from the form', async () => {
    vi.spyOn(adminApi, 'getAdminServices').mockResolvedValue([
      { id: 1, name: 'Haircut', description: null, price: 1500, durationMinutes: 30, isActive: true },
    ]);
    const createMock = vi.spyOn(adminApi, 'createAdminService').mockResolvedValue({ id: 2 });

    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AdminServices />
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getByText('Haircut')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Beard trim' } });
    fireEvent.change(screen.getByLabelText(/price/i), { target: { value: '800' } });
    fireEvent.change(screen.getByLabelText(/duration/i), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: /add/i }));

    await waitFor(() =>
      expect(createMock).toHaveBeenCalledWith({ name: 'Beard trim', price: 800, durationMinutes: 20 })
    );
  });
});
