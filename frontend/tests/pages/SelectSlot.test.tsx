import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SelectSlot } from '../../src/pages/BookingFlow/SelectSlot';
import * as slotsApi from '../../src/api/slots';
import * as servicesApi from '../../src/api/services';

function availableFn<T extends (...args: never[]) => unknown>(impl?: T) {
  const fn = vi.fn(impl);
  return Object.assign(fn, { isAvailable: () => true });
}

vi.mock('../../src/api/slots');
vi.mock('../../src/api/services');
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

describe('SelectSlot', () => {
  it('lists available slots for the selected date and navigates to confirm on pick', async () => {
    vi.spyOn(servicesApi, 'getServices').mockResolvedValue([
      { id: 1, name: 'Haircut', description: null, price: 1500, durationMinutes: 30, isActive: true },
    ]);
    vi.spyOn(slotsApi, 'getSlots').mockResolvedValue([{ startsAt: '2099-01-01T09:00:00.000Z' }]);
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
          initialEntries={['/booking/1']}
        >
          <Routes>
            <Route path="/booking/:serviceId" element={<SelectSlot />} />
            <Route path="/booking/:serviceId/confirm" element={<div>Confirm screen</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    const slotButton = await screen.findByRole('button', { name: /09:00/ });
    fireEvent.click(slotButton);

    await waitFor(() => expect(screen.getByText('Confirm screen')).toBeInTheDocument());
  });
});
