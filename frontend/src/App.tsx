import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppRoot } from '@telegram-apps/telegram-ui';
import { ServicesList } from './pages/ServicesList/ServicesList';
import { SelectSlot } from './pages/BookingFlow/SelectSlot';
import { Confirm } from './pages/BookingFlow/Confirm';
import { MyBookings } from './pages/MyBookings/MyBookings';
import { AdminLayout } from './pages/Admin/AdminLayout';
import { useTelegramTheme } from './hooks/useTelegramTheme';
import { useTelegramAppearance } from './hooks/useTelegramAppearance';

const queryClient = new QueryClient();

export function App() {
  useTelegramTheme();
  const appearance = useTelegramAppearance();

  return (
    <AppRoot appearance={appearance}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/" element={<ServicesList />} />
            <Route path="/booking/:serviceId" element={<SelectSlot />} />
            <Route path="/booking/:serviceId/confirm" element={<Confirm />} />
            <Route path="/my-bookings" element={<MyBookings />} />
            <Route path="/admin" element={<AdminLayout />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </AppRoot>
  );
}
