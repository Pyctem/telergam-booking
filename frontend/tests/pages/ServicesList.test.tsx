import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { QueryClient, onlineManager } from '@tanstack/react-query';
import { ServicesList } from '../../src/pages/ServicesList/ServicesList';
import * as servicesApi from '../../src/api/services';
import { renderWithProviders } from '../testUtils';

vi.mock('../../src/api/services');

afterEach(() => {
  // Safety net: a failed assertion inside the offline regression test below
  // must not leave onlineManager stuck "offline" for every other test file
  // (query-core's onlineManager is a module-level singleton for the
  // lifetime of this test file).
  onlineManager.setOnline(true);
});

describe('ServicesList', () => {
  it('renders each active service with its price and duration', async () => {
    vi.spyOn(servicesApi, 'getServices').mockResolvedValue([
      { id: 1, name: 'Haircut', description: null, price: 1500, durationMinutes: 30, isActive: true },
      { id: 2, name: 'Beard trim', description: null, price: 800, durationMinutes: 20, isActive: true },
    ]);
    const queryClient = new QueryClient();

    renderWithProviders(<ServicesList />, { queryClient });

    await waitFor(() => expect(screen.getByText('Haircut')).toBeInTheDocument());
    expect(screen.getByText('Beard trim')).toBeInTheDocument();
    expect(screen.getByText(/1500/)).toBeInTheDocument();
    expect(screen.getByText(/30/)).toBeInTheDocument();
  });

  // Regression test for the isPending-vs-isLoading bug fixed in ServicesList:
  // `isLoading` is `isPending && isFetching`, so it can read `false` while
  // there is still no data. We reproduce that exact react-query state
  // (status: 'pending', fetchStatus: 'paused', so isFetching/isLoading are
  // both false) deterministically by flipping the query client offline
  // before mount: react-query then dispatches its "fetch" action but never
  // actually calls the queryFn (fetchStatus goes straight to 'paused'
  // instead of 'fetching'), and stays there — data remains undefined
  // indefinitely with isPending: true, isLoading: false. This is a stable,
  // waitable state, unlike the transient default-online 'idle'->'fetching'
  // flash a plain never-resolving promise would produce (which keeps
  // isFetching/isLoading true forever and would pass under either flag,
  // proving nothing).
  //
  // Under the current source (`if (isPending) return <List>...<SkeletonRows>...`)
  // this renders the loading state and never reaches `services.map(...)`.
  // If ServicesList were reverted to checking `isLoading` instead, this
  // exact state (isPending: true, isLoading: false) would skip the loading
  // return, fall through past the `error` check (error is null, not set),
  // and hit `services.map(...)` with `services === undefined`, throwing a
  // TypeError — which would make this test fail.
  it('shows the loading state, not a crash, while no data has arrived and isLoading is already false (isPending regression)', async () => {
    onlineManager.setOnline(false);
    const getServicesMock = vi.spyOn(servicesApi, 'getServices').mockImplementation(
      () => new Promise(() => {})
    );
    const queryClient = new QueryClient();

    renderWithProviders(<ServicesList />, { queryClient });

    await waitFor(() => expect(screen.getByRole('status', { name: 'Loading services' })).toBeInTheDocument());
    // While offline/paused, react-query never even calls the queryFn.
    expect(getServicesMock).not.toHaveBeenCalled();

    onlineManager.setOnline(true);
  });
});
