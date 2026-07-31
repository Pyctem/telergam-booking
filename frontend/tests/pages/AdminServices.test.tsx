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

  it('hides inactive services and removes a service from the list once it is deleted', async () => {
    // The admin GET endpoint deliberately returns every service including
    // soft-deleted ones (is_active = false); the second mock response
    // simulates what a real refetch would return after a successful delete.
    const getAdminServicesMock = vi
      .spyOn(adminApi, 'getAdminServices')
      .mockResolvedValueOnce([
        { id: 1, name: 'Haircut', description: null, price: 1500, durationMinutes: 30, isActive: true },
        { id: 2, name: 'Retired combo', description: null, price: 2000, durationMinutes: 45, isActive: false },
      ])
      .mockResolvedValueOnce([
        { id: 1, name: 'Haircut', description: null, price: 1500, durationMinutes: 30, isActive: false },
      ]);
    const deleteMock = vi.spyOn(adminApi, 'deleteAdminService').mockResolvedValue(undefined);

    renderWithProviders(<AdminServices />);

    await waitFor(() => expect(screen.getByText('Haircut')).toBeInTheDocument());
    expect(screen.queryByText('Retired combo')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /delete/i })).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: /delete/i }));

    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith(1));
    await waitFor(() => expect(screen.queryByText('Haircut')).not.toBeInTheDocument());
    expect(getAdminServicesMock).toHaveBeenCalledTimes(2);
  });

  it('disables the Delete button while the deletion request is in flight', async () => {
    vi.spyOn(adminApi, 'getAdminServices').mockResolvedValue([
      { id: 1, name: 'Haircut', description: null, price: 1500, durationMinutes: 30, isActive: true },
    ]);
    let resolveDelete!: () => void;
    vi.spyOn(adminApi, 'deleteAdminService').mockReturnValue(
      new Promise((resolve) => {
        resolveDelete = resolve;
      })
    );

    renderWithProviders(<AdminServices />);

    await waitFor(() => expect(screen.getByText('Haircut')).toBeInTheDocument());
    const deleteButton = screen.getByRole('button', { name: /delete/i }) as HTMLButtonElement;

    fireEvent.click(deleteButton);

    await waitFor(() => expect(deleteButton.disabled).toBe(true));

    resolveDelete();

    await waitFor(() => expect(deleteButton.disabled).toBe(false));
  });

  it('disables the Add button until every field is filled', async () => {
    vi.spyOn(adminApi, 'getAdminServices').mockResolvedValue([]);

    renderWithProviders(<AdminServices />);

    const addButton = await screen.findByRole('button', { name: /add/i });
    expect(addButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Beard trim' } });
    expect(addButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/price/i), { target: { value: '800' } });
    expect(addButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/duration/i), { target: { value: '20' } });
    expect(addButton).not.toBeDisabled();
  });
});
