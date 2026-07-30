import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AppRoot } from '@telegram-apps/telegram-ui';

export interface RenderWithProvidersOptions {
  queryClient?: QueryClient;
  initialEntries?: string[];
}

export function renderWithProviders(
  ui: ReactElement,
  options?: RenderWithProvidersOptions
) {
  const queryClient = options?.queryClient ?? new QueryClient();
  const initialEntries = options?.initialEntries ?? ['/'];

  return render(
    <AppRoot>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
          initialEntries={initialEntries}
        >
          {ui}
        </MemoryRouter>
      </QueryClientProvider>
    </AppRoot>
  );
}
