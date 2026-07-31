import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { AdminServices } from '../../src/pages/Admin/AdminServices';
import * as adminApi from '../../src/api/admin';
import { renderWithProviders } from '../testUtils';

vi.mock('../../src/api/admin');

describe('AdminServices', () => {
  it('lists services and creates a new one from the form', async () => {
    vi.spyOn(adminApi, 'getAdminServices').mockResolvedValue([
      { id: 1, name: 'Haircut', description: null, price: 1500, durationMinutes: 30, isActive: true },
    ]);
    const createMock = vi.spyOn(adminApi, 'createAdminService').mockResolvedValue({ id: 2 });

    renderWithProviders(<AdminServices />);

    await waitFor(() => expect(screen.getByText('Haircut')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Beard trim' } });
    fireEvent.change(screen.getByLabelText(/price/i), { target: { value: '800' } });
    fireEvent.change(screen.getByLabelText(/duration/i), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: /add/i }));

    await waitFor(() =>
      expect(createMock).toHaveBeenCalledWith({ name: 'Beard trim', price: 800, durationMinutes: 20 })
    );
  });

  it('shows a delete button only for active services', async () => {
    vi.spyOn(adminApi, 'getAdminServices').mockResolvedValue([
      { id: 1, name: 'Haircut', description: null, price: 1500, durationMinutes: 30, isActive: true },
      { id: 2, name: 'Retired combo', description: null, price: 2000, durationMinutes: 45, isActive: false },
    ]);
    const deleteMock = vi.spyOn(adminApi, 'deleteAdminService').mockResolvedValue(undefined);

    renderWithProviders(<AdminServices />);

    await waitFor(() => expect(screen.getByText('Haircut')).toBeInTheDocument());
    expect(screen.getAllByRole('button', { name: /delete/i })).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: /delete/i }));

    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith(1));
  });
});
