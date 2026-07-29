import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ServicesList } from './pages/ServicesList/ServicesList';
import { useTelegramTheme } from './hooks/useTelegramTheme';

const queryClient = new QueryClient();

export function App() {
  useTelegramTheme();
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/" element={<ServicesList />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
